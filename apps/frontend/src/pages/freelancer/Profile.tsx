// FILE: src/pages/freelancer/Profile.tsx
// ROUTE: /freelancer/profile
// PURPOSE: Edit the public freelancer profile clients see with proposals.

import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { SkillInput } from '../../components/freelance/Bits'
import { CURRENCIES, getMyProfile, saveMyProfile, type Profile } from '../../api/freelance'
import { Button, ButtonLink, Card, CardHeader, Field, PageContainer, PageHeader, Select, Skeleton, TextArea } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

interface Form {
  headline: string
  bio: string
  skills: string[]
  hourly_rate: string
  currency: string
  location: string
  portfolio_url: string
  available: boolean
}
const EMPTY: Form = { headline: '', bio: '', skills: [], hourly_rate: '', currency: 'USD', location: '', portfolio_url: '', available: true }

export default function FreelancerProfileEditor() {
  const uid = useAuthStore((s) => s.user?.id)
  const [form, setForm] = useState<Form | null>(null)
  const [exists, setExists] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMyProfile()
      .then((r) => {
        const p = r.data
        setExists(Boolean(p))
        setForm(
          p
            ? { headline: p.headline, bio: p.bio, skills: p.skills, hourly_rate: p.hourly_rate ? String(p.hourly_rate) : '', currency: p.currency, location: p.location || '', portfolio_url: p.portfolio_url || '', available: p.available }
            : EMPTY,
        )
      })
      .catch((e) => {
        toast.error(apiError(e, 'Couldn’t load your profile.'))
        setForm(EMPTY)
      })
  }, [])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form || busy) return
    const next: typeof errors = {}
    if (form.headline.trim().length < 5) next.headline = 'At least 5 characters'
    const rate = form.hourly_rate.trim() ? parseInt(form.hourly_rate.replace(/[^0-9]/g, ''), 10) : null
    if (rate !== null && (!Number.isFinite(rate) || rate < 1)) next.hourly_rate = 'Enter a whole number, or leave it empty'
    if (form.portfolio_url && !/^https?:\/\/\S+\.\S+/.test(form.portfolio_url.trim())) next.portfolio_url = 'Use a full link, e.g. https://you.com'
    setErrors(next)
    if (Object.keys(next).length) return
    const payload: Omit<Profile, 'updated_at'> = {
      headline: form.headline.trim(),
      bio: form.bio.trim(),
      skills: form.skills,
      hourly_rate: rate,
      currency: form.currency,
      location: form.location.trim(),
      portfolio_url: form.portfolio_url.trim(),
      available: form.available,
    }
    setBusy(true)
    try {
      await saveMyProfile(payload)
      setExists(true)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save your profile.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SEO title="My profile | Freelancer | SafeApply.AI" description="Your freelancer profile." path="/freelancer/profile" noindex />
      <PageContainer narrow>
        <PageHeader
          title="My profile"
          description="Clients see this next to every proposal you send. Contact details are never shown."
          actions={
            exists && uid ? (
              <ButtonLink to={`/freelancers/${uid}`} variant="secondary" icon="visibility">
                View public profile
              </ButtonLink>
            ) : undefined
          }
        />
        {!form ? (
          <Card className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <Card>
              <CardHeader title="About you" />
              <div className="flex flex-col gap-4">
                <Field label="Headline" required maxLength={120} value={form.headline} onChange={(e) => set('headline', e.target.value)} error={errors.headline} placeholder="e.g. Brand designer for small food businesses" />
                <TextArea label="Bio" rows={7} value={form.bio} onChange={(e) => set('bio', e.target.value.slice(0, 3000))} hint={`${form.bio.length} / 3,000. What you do, who for, and how you work.`} />
                <SkillInput label="Skills" value={form.skills} onChange={(v) => set('skills', v)} max={15} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Rate and details" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Hourly rate" optional inputMode="numeric" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} error={errors.hourly_rate} />
                <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                <Field label="Location" optional maxLength={120} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="City, Country" />
                <Field label="Portfolio link" optional type="url" maxLength={300} value={form.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} error={errors.portfolio_url} placeholder="https://" />
              </div>
              <label className="mt-5 flex items-center gap-3 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} className="w-4 h-4 accent-[var(--c-accent)]" />
                Available for new work
              </label>
            </Card>
            <div className="flex justify-end">
              <Button type="submit" size="lg" loading={busy}>
                {exists ? 'Save profile' : 'Create profile'}
              </Button>
            </div>
          </form>
        )}
      </PageContainer>
    </>
  )
}
