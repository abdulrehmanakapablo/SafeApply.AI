// FILE: src/pages/client/ProjectForm.tsx
// ROUTES: /client/projects/new, /client/projects/:id/edit
// PURPOSE: Create or edit a project. A budget is required on every project.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { SkillInput } from '../../components/freelance/Bits'
import { CURRENCIES, createProject, getClientProject, updateProject, type BudgetType, type Duration, type ProjectInput, type ProjectStatus } from '../../api/freelance'
import { Alert, Button, Card, CardHeader, Field, PageContainer, PageHeader, Select, Skeleton, TextArea } from '../../components/ui'
import { apiError } from '../../lib/axios'

interface Form {
  title: string
  description: string
  skills: string[]
  budget_type: BudgetType
  budget_min: string
  budget_max: string
  currency: string
  duration: Duration
}
const EMPTY: Form = { title: '', description: '', skills: [], budget_type: 'fixed', budget_min: '', budget_max: '', currency: 'USD', duration: 'one_month' }
const toInt = (s: string) => {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : NaN
}

export default function ProjectForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form | null>(id ? null : EMPTY)
  const [status, setStatus] = useState<ProjectStatus>('draft')
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [busy, setBusy] = useState<'draft' | 'open' | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!id) return
    getClientProject(id)
      .then(({ data: p }) => {
        setStatus(p.status)
        setForm({ title: p.title, description: p.description, skills: p.skills, budget_type: p.budget_type, budget_min: String(p.budget_min), budget_max: String(p.budget_max), currency: p.currency, duration: p.duration })
      })
      .catch((e) => setLoadError(apiError(e, 'Couldn’t load this project.')))
  }, [id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const editable = !id || status === 'draft' || status === 'open'

  async function save(next: 'draft' | 'open', e?: FormEvent) {
    e?.preventDefault()
    if (!form || busy) return
    const errs: typeof errors = {}
    if (form.title.trim().length < 5) errs.title = 'At least 5 characters'
    if (form.description.trim().length < 50) errs.description = `At least 50 characters (${form.description.trim().length} so far)`
    const min = toInt(form.budget_min)
    const max = toInt(form.budget_max)
    if (!Number.isFinite(min) || min < 1) errs.budget_min = 'Required'
    if (!Number.isFinite(max) || max < 1) errs.budget_max = 'Required'
    else if (Number.isFinite(min) && max < min) errs.budget_max = 'Must be at least the minimum'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload: ProjectInput = { ...form, title: form.title.trim(), description: form.description.trim(), budget_min: min, budget_max: max, status: next }
    setBusy(next)
    try {
      const res = id ? await updateProject(id, payload) : await createProject(payload)
      toast.success(next === 'draft' ? 'Draft saved' : id ? 'Project saved' : 'Project posted')
      navigate(`/client/projects/${res.data.id}`, { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save the project.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SEO title={`${id ? 'Edit project' : 'Post a project'} | SafeApply.AI`} description="Project form." path="/client/projects/new" noindex />
      <PageContainer narrow>
        <PageHeader title={id ? 'Edit project' : 'Post a project'} back={{ to: id ? `/client/projects/${id}` : '/client/projects', label: id ? 'Project' : 'My projects' }} />
        {loadError && <Alert>{loadError}</Alert>}
        {!form ? (
          !loadError && (
            <Card className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </Card>
          )
        ) : !editable ? (
          <Alert tone="warn">This project already has a contract, so it can’t be edited.</Alert>
        ) : (
          <form onSubmit={(e) => save('open', e)} noValidate className="flex flex-col gap-6">
            <Card>
              <CardHeader title="The work" />
              <div className="flex flex-col gap-4">
                <Field label="Title" required maxLength={140} value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="e.g. Logo and brand colours for a bakery" />
                <TextArea
                  label="Description"
                  required
                  rows={10}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value.slice(0, 10000))}
                  error={errors.description}
                  hint={`${form.description.length.toLocaleString()} / 10,000. What you need, what “done” looks like, and any files or examples.`}
                />
                <SkillInput label="Skills needed" value={form.skills} onChange={(v) => set('skills', v)} max={10} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Budget and timing" description="Required. Freelancers trust projects that show a budget." />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Select
                  label="Type"
                  value={form.budget_type}
                  onChange={(e) => set('budget_type', e.target.value as BudgetType)}
                  options={[
                    { value: 'fixed', label: 'Fixed price' },
                    { value: 'hourly', label: 'Hourly' },
                  ]}
                />
                <Field label="From" required inputMode="numeric" value={form.budget_min} onChange={(e) => set('budget_min', e.target.value)} error={errors.budget_min} />
                <Field label="To" required inputMode="numeric" value={form.budget_max} onChange={(e) => set('budget_max', e.target.value)} error={errors.budget_max} />
                <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
              </div>
              <div className="mt-4 sm:max-w-[50%]">
                <Select
                  label="How long"
                  value={form.duration}
                  onChange={(e) => set('duration', e.target.value as Duration)}
                  options={[
                    { value: 'under_week', label: 'Under a week' },
                    { value: 'one_month', label: 'Up to a month' },
                    { value: 'three_months', label: '1 to 3 months' },
                    { value: 'longer', label: 'Longer than 3 months' },
                  ]}
                />
              </div>
            </Card>
            <div className="flex flex-wrap justify-end gap-2">
              {(!id || status === 'draft') && (
                <Button variant="secondary" onClick={() => save('draft')} loading={busy === 'draft'} disabled={Boolean(busy)}>
                  Save draft
                </Button>
              )}
              <Button type="submit" size="lg" loading={busy === 'open'} disabled={Boolean(busy)}>
                {id && status === 'open' ? 'Save changes' : 'Post project'}
              </Button>
            </div>
          </form>
        )}
      </PageContainer>
    </>
  )
}
