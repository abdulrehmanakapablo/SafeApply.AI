// FILE: src/pages/dashboard/SubmitReview.tsx
// ROUTE: /dashboard/review  (?company=<name> prefills)
// BACKEND: POST /api/reviews
// PURPOSE: Anonymous company review. Reviewer identity is never shown
//          publicly; reviews go through moderation before they appear.

import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { StarInput } from '../../components/ui/Stars'
import { submitReview, RELATIONSHIP_LABEL, type Relationship } from '../../api/reviews'
import { Alert, Button, ButtonLink, Card, CardHeader, Field, Icon, PageContainer, PageHeader, TextArea, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Recommend = 'yes' | 'no' | 'maybe'
const MIN_TEXT = 100
const MAX_TEXT = 2000
const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABEL) as Relationship[]
const RECOMMEND: { value: Recommend; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Not sure' },
  { value: 'no', label: 'No' },
]

const toInt = (s: string) => {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

interface Form {
  company_name: string
  role_type: string
  relationship: Relationship | null
  overall: number
  culture: number
  interview: number
  recommend: Recommend | null
  text: string
  process: string
  salary_min: string
  salary_max: string
  attest: boolean
}

type Errors = Partial<Record<keyof Form, string>>

export default function SubmitReview() {
  const reduce = useReducedMotion()
  const [params] = useSearchParams()
  const initialCompany = (params.get('company') || '').slice(0, 120)
  const [f, setF] = useState<Form>({
    company_name: initialCompany,
    role_type: '',
    relationship: null,
    overall: 0,
    culture: 0,
    interview: 0,
    recommend: null,
    text: '',
    process: '',
    salary_min: '',
    salary_max: '',
    attest: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const textLen = f.text.trim().length
  const missing = useMemo(() => {
    const m: string[] = []
    if (!f.company_name.trim()) m.push('company')
    if (!f.role_type.trim()) m.push('role')
    if (!f.relationship) m.push('your connection')
    if (!f.overall || !f.culture || !f.interview) m.push('ratings')
    if (!f.recommend) m.push('recommendation')
    if (textLen < MIN_TEXT) m.push('review')
    if (!f.attest) m.push('confirmation')
    return m
  }, [f, textLen])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const next: Errors = {}
    if (!f.company_name.trim()) next.company_name = 'Company is required'
    if (!f.role_type.trim()) next.role_type = 'Role is required'
    if (!f.relationship) next.relationship = 'Pick one'
    if (!f.overall) next.overall = 'Rate overall'
    if (!f.culture) next.culture = 'Rate culture'
    if (!f.interview) next.interview = 'Rate the hiring process'
    if (!f.recommend) next.recommend = 'Pick one'
    if (textLen < MIN_TEXT) next.text = `Write at least ${MIN_TEXT} characters (${MIN_TEXT - textLen} to go)`
    if (textLen > MAX_TEXT) next.text = `Keep it under ${MAX_TEXT} characters`
    const min = toInt(f.salary_min)
    const max = toInt(f.salary_max)
    if (min && max && min > max) next.salary_max = 'Must be at least the minimum'
    if (!f.attest) next.attest = 'Confirm to continue'
    setErrors(next)
    if (Object.keys(next).length) {
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(next)[0]}"]`)
      first?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    setServerError('')
    try {
      const res = await submitReview({
        company_name: f.company_name.trim().slice(0, 120),
        relationship: f.relationship as Relationship,
        role_type: f.role_type.trim().slice(0, 100),
        overall_rating: f.overall,
        culture_rating: f.culture,
        interview_rating: f.interview,
        would_recommend: f.recommend as Recommend,
        review_text: f.text.trim(),
        interview_process: f.process.trim() || undefined,
        salary_min: min,
        salary_max: max,
      })
      if (res.success) {
        setDone(true)
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      } else setServerError(res.error || 'Couldn’t submit your review.')
    } catch (err) {
      setServerError(apiError(err, 'Couldn’t submit your review.'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <PageContainer narrow>
        <SEO title="Review submitted | SafeApply.AI" description="Thanks for your review." path="/dashboard/review" noindex />
        <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
          <Card className="text-center py-12">
            <motion.span
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
              className="mx-auto w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center"
            >
              <Icon name="check" className="text-[28px]" />
            </motion.span>
            <h1 className="mt-5 text-xl font-semibold">Thanks. Your review is in the queue.</h1>
            <p className="mt-2 text-sm text-muted max-w-sm mx-auto">We check every review before it goes live, usually within a couple of days. Your name is never shown.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <ButtonLink to="/companies" variant="secondary">
                Browse companies
              </ButtonLink>
              <Button
                onClick={() => {
                  setF((p) => ({ ...p, company_name: '', role_type: '', overall: 0, culture: 0, interview: 0, recommend: null, text: '', process: '', salary_min: '', salary_max: '', attest: false }))
                  setDone(false)
                }}
              >
                Write another
              </Button>
            </div>
          </Card>
        </motion.div>
      </PageContainer>
    )
  }

  return (
    <>
      <SEO title="Write a review | SafeApply.AI" description="Review a company you worked at or interviewed with." path="/dashboard/review" noindex />
      <PageContainer narrow>
        <PageHeader title="Write a review" description="Help the next applicant. Anonymous, and checked by a person before it’s published." />

        {serverError && <Alert>{serverError}</Alert>}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <Card>
            <CardHeader title="The company" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div data-field="company_name">
                <Field label="Company" required value={f.company_name} onChange={(e) => set('company_name', e.target.value)} maxLength={120} error={errors.company_name} autoFocus={!initialCompany} />
              </div>
              <div data-field="role_type">
                <Field label="Your role" required value={f.role_type} onChange={(e) => set('role_type', e.target.value)} placeholder="e.g. Store manager, Analyst" maxLength={100} error={errors.role_type} />
              </div>
            </div>
            <fieldset className="mt-5" data-field="relationship">
              <legend className="text-[13px] font-medium mb-2">
                Your connection <span className="text-accent">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIPS.map((r) => (
                  <Choice key={r} name="relationship" checked={f.relationship === r} onChange={() => set('relationship', r)} label={RELATIONSHIP_LABEL[r]} />
                ))}
              </div>
              {errors.relationship && <p className="text-xs text-danger mt-1.5">{errors.relationship}</p>}
            </fieldset>
          </Card>

          <Card>
            <CardHeader title="Ratings" description="1 is poor, 5 is excellent." />
            <div className="grid sm:grid-cols-3 gap-5">
              <div data-field="overall">
                <StarInput label="Overall" value={f.overall} onChange={(v) => set('overall', v)} error={errors.overall} />
              </div>
              <div data-field="culture">
                <StarInput label="Culture" value={f.culture} onChange={(v) => set('culture', v)} error={errors.culture} />
              </div>
              <div data-field="interview">
                <StarInput label="Hiring process" value={f.interview} onChange={(v) => set('interview', v)} error={errors.interview} />
              </div>
            </div>
            <fieldset className="mt-6" data-field="recommend">
              <legend className="text-[13px] font-medium mb-2">
                Would you recommend applying? <span className="text-accent">*</span>
              </legend>
              <div className="grid grid-cols-3 gap-2 max-w-sm">
                {RECOMMEND.map((r) => (
                  <Choice key={r.value} name="recommend" checked={f.recommend === r.value} onChange={() => set('recommend', r.value)} label={r.label} />
                ))}
              </div>
              {errors.recommend && <p className="text-xs text-danger mt-1.5">{errors.recommend}</p>}
            </fieldset>
          </Card>

          <Card>
            <CardHeader title="Your experience" />
            <div className="flex flex-col gap-5">
              <div data-field="text">
                <TextArea
                  label="Review"
                  required
                  rows={7}
                  value={f.text}
                  onChange={(e) => set('text', e.target.value.slice(0, MAX_TEXT))}
                  placeholder="What was good, what wasn’t, and what you wish you’d known before applying. Stick to your own experience and leave out names."
                  error={errors.text}
                  hint={`${textLen} / ${MAX_TEXT}${textLen < MIN_TEXT ? `. ${MIN_TEXT} minimum.` : ''}`}
                />
              </div>
              <TextArea
                label="Hiring process"
                optional
                rows={4}
                value={f.process}
                onChange={(e) => set('process', e.target.value.slice(0, 1500))}
                placeholder="Stages, how long it took, whether you heard back."
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Salary from" optional inputMode="numeric" value={f.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="Yearly, before tax" />
                <div data-field="salary_max">
                  <Field label="Salary to" optional inputMode="numeric" value={f.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="Yearly, before tax" error={errors.salary_max} />
                </div>
              </div>
            </div>
          </Card>

          <div data-field="attest" className="flex flex-col gap-4">
            <label className={cn('flex items-start gap-3 text-sm cursor-pointer select-none', errors.attest ? 'text-danger' : 'text-muted')}>
              <input type="checkbox" checked={f.attest} onChange={(e) => set('attest', e.target.checked)} className="mt-0.5 w-4 h-4 accent-accent shrink-0" />
              <span>
                This is my own honest experience, and I’ve read the{' '}
                <Link to="/terms" target="_blank" className="underline underline-offset-2 hover:text-fg">
                  terms
                </Link>
                .
              </span>
            </label>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-muted">{missing.length ? `Still needed: ${missing.join(', ')}` : 'Ready to submit.'}</p>
              <Button type="submit" size="lg" loading={busy}>
                Submit review
              </Button>
            </div>
          </div>
        </form>
      </PageContainer>
    </>
  )
}

function Choice({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label
      className={cn(
        'h-10 px-3 inline-flex items-center gap-2 rounded-[var(--radius-btn)] border text-sm cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
        checked ? 'border-accent bg-accent/5 text-fg' : 'border-line text-muted hover:text-fg hover:border-muted/60',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={cn('w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center', checked ? 'border-accent' : 'border-muted/60')}>
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </span>
      <span className="truncate">{label}</span>
    </label>
  )
}
