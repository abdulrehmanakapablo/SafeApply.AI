// FILE: src/components/tracker/ApplicationForm.tsx
// PURPOSE: Add / edit an application. Used by Tracker (create) and
//          ApplicationDetail (edit). Validates before calling the API.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, Field, Select, TextArea, APPLICATION_STATUSES, STATUS_META } from '../ui'
import type { Application, ApplicationInput, ApplicationStatus } from '../../api/tracker'

const today = () => new Date().toISOString().slice(0, 10)
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]+$/i

interface FormState {
  company_name: string
  job_title: string
  date_applied: string
  status: ApplicationStatus
  location: string
  job_link: string
  salary_min: string
  salary_max: string
  notes: string
  jd_text: string
}

function fromApp(a?: Partial<Application> | null): FormState {
  return {
    company_name: a?.company_name ?? '',
    job_title: a?.job_title ?? '',
    date_applied: (a?.date_applied ?? today()).slice(0, 10),
    status: (a?.status as ApplicationStatus) ?? 'applied',
    location: a?.location ?? '',
    job_link: a?.job_link ?? '',
    salary_min: a?.salary_min ? String(a.salary_min) : '',
    salary_max: a?.salary_max ? String(a.salary_max) : '',
    notes: a?.notes ?? '',
    jd_text: '',
  }
}

const toInt = (s: string) => {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export default function ApplicationForm({
  open,
  onClose,
  onSubmit,
  initial,
  mode = 'create',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: ApplicationInput) => Promise<string | null>
  initial?: Partial<Application> | null
  mode?: 'create' | 'edit'
}) {
  const [f, setF] = useState<FormState>(() => fromApp(initial))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset only when the dialog opens, never while the user is typing.
  const initialRef = useRef(initial)
  initialRef.current = initial
  useEffect(() => {
    if (open) {
      setF(fromApp(initialRef.current))
      setErrors({})
      setServerError('')
    }
  }, [open])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const next: typeof errors = {}
    if (!f.company_name.trim()) next.company_name = 'Company is required'
    if (!f.job_title.trim()) next.job_title = 'Job title is required'
    if (!f.date_applied) next.date_applied = 'Pick a date'
    else if (f.date_applied > today()) next.date_applied = 'Date can’t be in the future'
    if (f.job_link.trim() && !URL_RE.test(f.job_link.trim())) next.job_link = 'Enter a full link starting with https://'
    const min = toInt(f.salary_min)
    const max = toInt(f.salary_max)
    if (min && max && min > max) next.salary_max = 'Must be at least the minimum'
    if (f.jd_text.trim() && f.jd_text.trim().length < 50) next.jd_text = 'Paste at least 50 characters, or leave it empty'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    setServerError('')
    const err = await onSubmit({
      company_name: f.company_name.trim().slice(0, 120),
      job_title: f.job_title.trim().slice(0, 120),
      date_applied: f.date_applied,
      status: f.status,
      location: f.location.trim() || undefined,
      job_link: f.job_link.trim() || undefined,
      salary_min: min,
      salary_max: max,
      notes: f.notes.trim() || undefined,
      jd_text: mode === 'create' && f.jd_text.trim() ? f.jd_text.trim() : undefined,
    })
    setBusy(false)
    if (err) setServerError(err)
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={mode === 'create' ? 'Add application' : 'Edit application'}
      description={mode === 'create' ? 'Only company, title and date are required.' : undefined}
      size="lg"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {serverError && <Alert>{serverError}</Alert>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Company" required autoFocus value={f.company_name} onChange={(e) => set('company_name', e.target.value)} error={errors.company_name} maxLength={120} />
          <Field label="Job title" required value={f.job_title} onChange={(e) => set('job_title', e.target.value)} error={errors.job_title} maxLength={120} />
          <Field label="Date applied" required type="date" max={today()} value={f.date_applied} onChange={(e) => set('date_applied', e.target.value)} error={errors.date_applied} />
          <Select
            label="Status"
            value={f.status}
            onChange={(e) => set('status', e.target.value as ApplicationStatus)}
            options={APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
          />
          <Field label="Location" optional value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="City, or Remote" maxLength={120} />
          <Field label="Job link" optional type="url" value={f.job_link} onChange={(e) => set('job_link', e.target.value)} placeholder="https://" error={errors.job_link} />
          <Field label="Salary from" optional inputMode="numeric" value={f.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="Yearly" />
          <Field label="Salary to" optional inputMode="numeric" value={f.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="Yearly" error={errors.salary_max} />
        </div>
        {mode === 'create' && <TextArea label="Notes" optional rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} placeholder="Recruiter name, referral, anything to remember." />}
        {mode === 'create' && (
          <TextArea
            label="Job description"
            optional
            rows={4}
            value={f.jd_text}
            onChange={(e) => set('jd_text', e.target.value)}
            maxLength={10000}
            hint="Paste it to keep a copy in case the post is taken down."
            error={errors.jd_text}
          />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {mode === 'create' ? 'Add application' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
