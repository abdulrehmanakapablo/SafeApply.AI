// FILE: src/pages/recruiter/CloseJob.tsx
// ROUTE: /recruiter/jobs/:id/close
// PURPOSE: Jobs close with an outcome. Everyone still waiting gets a final
//          answer automatically, and the outcome goes on the public record.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { OUTCOME_LABEL, closeJob, getMyJob, type Job, type JobOutcome, type PipelineApp } from '../../api/recruiter'
import { Alert, Button, Card, CardHeader, PageContainer, PageHeader, Select, Skeleton, TextArea, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

const OPTIONS: { value: JobOutcome; hint: string }[] = [
  { value: 'hired_here', hint: 'You hired someone who applied here. They’ll be asked to confirm.' },
  { value: 'hired_elsewhere', hint: 'The role was filled through another channel.' },
  { value: 'not_hired', hint: 'Nobody was hired for this role.' },
  { value: 'cancelled', hint: 'The role no longer exists.' },
]
const OPEN = new Set(['applied', 'screening', 'interview', 'offer'])

export default function CloseJob() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<(Job & { applications: PipelineApp[] }) | null>(null)
  const [outcome, setOutcome] = useState<JobOutcome | ''>('')
  const [hired, setHired] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyJob(id)
      .then((r) => setJob(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load this job.')))
  }, [id])

  const waiting = useMemo(() => job?.applications.filter((a) => OPEN.has(a.stage)) ?? [], [job])
  const candidates = useMemo(() => job?.applications.filter((a) => a.stage !== 'rejected') ?? [], [job])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!outcome || busy) return
    if (outcome === 'hired_here' && !hired) return toast.error('Pick the applicant you hired.')
    setBusy(true)
    try {
      const r = await closeJob(id, { outcome, note: note.trim(), ...(outcome === 'hired_here' ? { hired_application_id: hired } : {}) })
      toast.success(r.data.answered ? `Job closed. ${r.data.answered} applicant${r.data.answered === 1 ? '' : 's'} told.` : 'Job closed')
      navigate(`/recruiter/jobs/${id}`, { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t close the job.'))
      setBusy(false)
    }
  }

  return (
    <>
      <SEO title="Close job | SafeApply.AI" description="Close a job." path={`/recruiter/jobs/${id}/close`} noindex />
      <PageContainer narrow>
        <PageHeader back={{ to: `/recruiter/jobs/${id}`, label: 'Pipeline' }} title={job ? `Close “${job.title}”` : 'Close job'} description="Choose what happened. The outcome appears on your public hiring record." />
        {error && <Alert>{error}</Alert>}
        {!job ? (
          !error && <Skeleton className="h-64 rounded-[16px]" />
        ) : job.status === 'closed' ? (
          <Alert tone="accent">This job is already closed{job.outcome ? `: ${OUTCOME_LABEL[job.outcome]}` : ''}.</Alert>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Outcome" />
              <div role="radiogroup" aria-label="Outcome" className="grid gap-2">
                {OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={cn('flex gap-3 p-4 rounded-[12px] border cursor-pointer transition-colors', outcome === o.value ? 'border-accent bg-accent/5' : 'border-line hover:border-muted/50')}
                  >
                    <input type="radio" name="outcome" value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="mt-1 accent-[var(--c-accent)]" />
                    <span>
                      <span className="block text-sm font-medium">{OUTCOME_LABEL[o.value]}</span>
                      <span className="block text-xs text-muted mt-0.5">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {outcome === 'hired_here' && (
                <div className="mt-4">
                  <Select
                    label="Who did you hire?"
                    value={hired}
                    onChange={(e) => setHired(e.target.value)}
                    options={[{ value: '', label: candidates.length ? 'Choose an applicant' : 'No applicants' }, ...candidates.map((a) => ({ value: a.id, label: a.candidate_name }))]}
                  />
                </div>
              )}
              <div className="mt-4">
                <TextArea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} hint="Shown with the outcome on your record. Keep it short." />
              </div>
            </Card>

            {waiting.length > 0 && (
              <Alert tone="warn">
                {waiting.length} applicant{waiting.length === 1 ? ' is' : 's are'} still waiting. They’ll get a final answer (Not selected) when you close
                {outcome === 'hired_here' && hired ? ', except the person you hired' : ''}.
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => navigate(-1)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={busy} disabled={!outcome}>
                Close job
              </Button>
            </div>
          </form>
        )}
      </PageContainer>
    </>
  )
}
