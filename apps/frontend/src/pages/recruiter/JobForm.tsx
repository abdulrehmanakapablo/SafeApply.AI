// FILE: src/pages/recruiter/JobForm.tsx
// ROUTES: /recruiter/jobs/new, /recruiter/jobs/:id/edit
// PURPOSE: Create/edit a job. Salary range is required (SafeApply rule).

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { useCompany } from './useCompany'
import VerificationBanner from '../../components/recruiter/VerificationBanner'
import { createJob, getMyJob, updateJob, type JobInput, type JobStatus } from '../../api/recruiter'
import { Alert, Button, Card, CardHeader, Field, PageContainer, PageHeader, Select, Skeleton, TextArea } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Form = Omit<JobInput, 'salary_min' | 'salary_max'> & { salary_min: string; salary_max: string }

const EMPTY: Form = {
  title: '',
  description: '',
  location: '',
  work_mode: 'onsite',
  employment_type: 'full_time',
  salary_min: '',
  salary_max: '',
  currency: 'USD',
  salary_period: 'year',
  status: 'open',
}
const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD']
const toInt = (s: string) => {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : NaN
}

export default function JobForm() {
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { company, loading: cLoading } = useCompany()
  const [form, setForm] = useState<Form>(EMPTY)
  const [loaded, setLoaded] = useState(!editing)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [busy, setBusy] = useState<JobStatus | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!id) return
    getMyJob(id)
      .then((r) => {
        const j = r.data
        setForm({
          title: j.title,
          description: j.description,
          location: j.location || '',
          work_mode: j.work_mode,
          employment_type: j.employment_type,
          salary_min: String(j.salary_min),
          salary_max: String(j.salary_max),
          currency: j.currency,
          salary_period: j.salary_period,
          status: j.status,
        })
        setLoaded(true)
      })
      .catch((e) => setLoadError(apiError(e, 'Couldn’t load this job.')))
  }, [id])

  const verified = company?.verification_status === 'verified'
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function save(status: JobStatus, e?: FormEvent) {
    e?.preventDefault()
    if (busy) return
    const next: typeof errors = {}
    if (form.title.trim().length < 3) next.title = 'At least 3 characters'
    if (form.description.trim().length < 100) next.description = `At least 100 characters (${form.description.trim().length} so far)`
    const min = toInt(form.salary_min)
    const max = toInt(form.salary_max)
    if (!Number.isFinite(min)) next.salary_min = 'Required'
    if (!Number.isFinite(max)) next.salary_max = 'Required'
    else if (Number.isFinite(min) && max < min) next.salary_max = 'Must be at least the minimum'
    setErrors(next)
    if (Object.keys(next).length) return

    const payload: JobInput = { ...form, title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), salary_min: min, salary_max: max, status }
    setBusy(status)
    try {
      const res = id ? await updateJob(id, payload) : await createJob(payload)
      if (res.success) {
        toast.success(status === 'draft' ? 'Draft saved' : editing ? 'Job updated' : 'Job is live')
        navigate(`/recruiter/jobs/${res.data.id}`, { replace: true })
      }
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save the job.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SEO title={`${editing ? 'Edit job' : 'Post a job'} | SafeApply.AI`} description="Job form." path="/recruiter/jobs/new" noindex />
      <PageContainer narrow>
        <PageHeader title={editing ? 'Edit job' : 'Post a job'} back={{ to: id ? `/recruiter/jobs/${id}` : '/recruiter/jobs', label: id ? 'Pipeline' : 'Jobs' }} />
        {!cLoading && <VerificationBanner company={company} />}
        {loadError && <Alert>{loadError}</Alert>}
        {!loaded || cLoading ? (
          <Card className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </Card>
        ) : company ? (
          <form onSubmit={(e) => save(!verified ? 'draft' : editing && form.status !== 'draft' ? form.status : 'open', e)} noValidate className="flex flex-col gap-6">
            <Card>
              <CardHeader title="The role" />
              <div className="flex flex-col gap-4">
                <Field label="Job title" required value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} error={errors.title} placeholder="e.g. Staff Nurse, Sales Associate" />
                <div className="grid sm:grid-cols-3 gap-4">
                  <Select
                    label="Workplace"
                    value={form.work_mode}
                    onChange={(e) => set('work_mode', e.target.value as Form['work_mode'])}
                    options={[
                      { value: 'onsite', label: 'On-site' },
                      { value: 'hybrid', label: 'Hybrid' },
                      { value: 'remote', label: 'Remote' },
                    ]}
                  />
                  <Select
                    label="Type"
                    value={form.employment_type}
                    onChange={(e) => set('employment_type', e.target.value as Form['employment_type'])}
                    options={[
                      { value: 'full_time', label: 'Full-time' },
                      { value: 'part_time', label: 'Part-time' },
                      { value: 'contract', label: 'Contract' },
                      { value: 'internship', label: 'Internship' },
                    ]}
                  />
                  <Field label="Location" optional value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder="City, Country" />
                </div>
                <TextArea
                  label="Description"
                  required
                  rows={12}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value.slice(0, 10000))}
                  error={errors.description}
                  hint={`${form.description.length.toLocaleString()} / 10,000. Responsibilities, requirements, and the hiring steps.`}
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Salary range" description="Required on SafeApply. Candidates trust jobs that show pay." />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="From" required inputMode="numeric" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} error={errors.salary_min} />
                <Field label="To" required inputMode="numeric" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} error={errors.salary_max} />
                <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                <Select
                  label="Per"
                  value={form.salary_period}
                  onChange={(e) => set('salary_period', e.target.value as Form['salary_period'])}
                  options={[
                    { value: 'year', label: 'Year' },
                    { value: 'month', label: 'Month' },
                    { value: 'hour', label: 'Hour' },
                  ]}
                />
              </div>
            </Card>

            <div className="flex flex-wrap justify-end gap-2">
              {(!editing || form.status === 'draft') && (
                <Button variant="secondary" onClick={() => save('draft')} loading={busy === 'draft'} disabled={Boolean(busy)}>
                  Save draft
                </Button>
              )}
              {verified && (
                <Button type="submit" size="lg" loading={busy !== null && busy !== 'draft'} disabled={Boolean(busy)}>
                  {editing && form.status !== 'draft' ? 'Save changes' : 'Publish job'}
                </Button>
              )}
            </div>
            {!verified && <p className="text-xs text-muted text-right">Publishing unlocks when your company is verified.</p>}
          </form>
        ) : null}
      </PageContainer>
    </>
  )
}
