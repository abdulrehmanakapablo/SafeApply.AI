// FILE: src/pages/public/JobDetail.tsx
// ROUTE: /jobs/:id
// PURPOSE: Job post + company trust signals + apply. Applying creates a
//          tracker card that updates itself as the recruiter moves you on.

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { JobFacts, ResponseRate, StageBadge } from '../../components/jobs/JobBits'
import { GhostFlag, RecordStrip } from '../../components/jobs/HiringRecord'
import { Stars } from '../../components/ui/Stars'
import { applyToJob, getJob, type PublicJobDetail } from '../../api/recruiter'
import { getCurrentCV } from '../../api/cv'
import { useAuthStore, useIsAuthed } from '../../store/authStore'
import { Alert, Button, ButtonLink, Card, Dialog, EmptyState, Icon, Skeleton, TextArea, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function JobDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const authed = useIsAuthed()
  const role = useAuthStore((s) => s.user?.role)
  const navigate = useNavigate()
  const location = useLocation()

  const [job, setJob] = useState<PublicJobDetail | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setJob(null)
    setError('')
    getJob(id)
      .then((res) => !cancelled && setJob(res.data))
      .catch((e) => !cancelled && setError(apiError(e, 'This job isn’t available.')))
    return () => {
      cancelled = true
    }
  }, [id, authed])

  function startApply() {
    if (!authed) return navigate(`/login?from=${encodeURIComponent(location.pathname)}`)
    setOpen(true)
  }

  return (
    <AdaptiveLayout>
      <SEO title={job ? `${job.title} at ${job.company.name} | SafeApply.AI` : 'Job | SafeApply.AI'} description={job ? `${job.title} at ${job.company.name}. Salary shown, verified company.` : 'Job on SafeApply.AI'} path={`/jobs/${id}`} />
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg transition-colors mb-5">
          <Icon name="arrow_back" className="text-[16px]" />
          All jobs
        </Link>

        {error ? (
          <Card padded={false}>
            <EmptyState icon="work_off" title="Job not available" body={error} action={<ButtonLink to="/jobs">Browse jobs</ButtonLink>} />
          </Card>
        ) : !job ? (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6" aria-busy="true">
            <Card className="flex flex-col gap-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-40 w-full mt-4" />
            </Card>
            <Skeleton className="h-60 rounded-[16px]" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <article className="flex flex-col gap-6 min-w-0">
              <header>
                <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight leading-tight break-words">{job.title}</h1>
                <p className="mt-2 text-muted flex items-center gap-1.5">
                  <Link to={`/companies/${job.company.slug}`} className="hover:text-fg underline-offset-4 hover:underline">
                    {job.company.name}
                  </Link>
                  <Icon name="verified" fill className="text-[16px] text-accent" label="Verified company" />
                  <span aria-hidden>·</span>
                  <span>Updated {relativeDays(job.last_activity_at)}</span>
                </p>
                <JobFacts {...job} className="mt-4" />
                <div className="mt-4 pt-4 border-t border-line">
                  <RecordStrip score={job.record} slug={job.company.slug} />
                </div>
              </header>
              {job.ghost_flag && (
                <Alert>
                  Ghost job warning: {job.apps_count} people applied and no CV has been opened yet. <GhostFlag className="ml-1 align-middle" />
                </Alert>
              )}
              {job.company.penalty_level >= 2 && <Alert tone="warn">This company has a hiring warning for repeatedly not opening applications.</Alert>}
              {!job.live && <Alert tone="warn">This job has closed and isn’t accepting applications.</Alert>}
              <Card>
                <h2 className="text-[15px] font-semibold mb-3">About the role</h2>
                <div className="text-sm text-muted leading-relaxed whitespace-pre-line break-words">{job.description}</div>
              </Card>
            </article>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
              <Card className="flex flex-col gap-4">
                {job.applied ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">You applied</span>
                      <StageBadge stage={job.applied.stage} />
                    </div>
                    <p className="text-xs text-muted">Updates appear in your tracker automatically. The company can message you there.</p>
                    <ButtonLink to={`/dashboard/messages/${job.applied.id}`} variant="secondary" icon="forum">
                      Open conversation
                    </ButtonLink>
                  </>
                ) : role === 'recruiter' ? (
                  <p className="text-sm text-muted">You’re signed in as a recruiter. Use a personal account to apply.</p>
                ) : (
                  <>
                    <Button size="lg" icon="send" onClick={startApply} disabled={!job.live} className="w-full">
                      {authed ? 'Apply' : 'Log in to apply'}
                    </Button>
                    <p className="text-xs text-muted text-center">Your application is added to your tracker and syncs with the company’s updates.</p>
                  </>
                )}
              </Card>
              <Card className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-[8px] bg-line flex items-center justify-center font-semibold" aria-hidden>
                    {job.company.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{job.company.name}</p>
                    <p className="text-xs text-muted truncate">{[job.company.industry, job.company.size && `${job.company.size} people`].filter(Boolean).join(' · ') || 'Verified company'}</p>
                  </div>
                </div>
                <ResponseRate rate={job.response_rate} sample={job.response_sample} />
                {job.company.total_reviews > 0 && (
                  <Link to={`/companies/${job.company.slug}`} className="flex items-center gap-2 text-xs text-muted hover:text-fg">
                    <Stars rating={job.company.avg_overall_rating} size={14} />
                    {job.company.total_reviews} review{job.company.total_reviews === 1 ? '' : 's'}
                  </Link>
                )}
                {job.company.about && <p className="text-xs text-muted leading-relaxed line-clamp-5 whitespace-pre-line">{job.company.about}</p>}
              </Card>
            </aside>
          </div>
        )}
      </section>
      {job && (
        <ApplyDialog
          open={open}
          onClose={() => setOpen(false)}
          job={job}
          onApplied={(appId) => {
            setJob((j) => (j ? { ...j, applied: { id: appId, stage: 'applied' } } : j))
            setOpen(false)
          }}
        />
      )}
    </AdaptiveLayout>
  )
}

function ApplyDialog({ open, onClose, job, onApplied }: { open: boolean; onClose: () => void; job: PublicJobDetail; onApplied: (id: string) => void }) {
  const [cv, setCv] = useState('')
  const [note, setNote] = useState('')
  const [loadingCv, setLoadingCv] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || cv) return
    let cancelled = false
    setLoadingCv(true)
    getCurrentCV()
      .then((res) => !cancelled && res.data?.cv_text && setCv(res.data.cv_text.slice(0, 20000)))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingCv(false))
    return () => {
      cancelled = true
    }
  }, [open, cv])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (cv.trim().length < 100) return setError('Add your CV text (at least 100 characters).')
    setBusy(true)
    setError('')
    try {
      const res = await applyToJob(job.id, { cv_text: cv.trim(), cover_note: note.trim() })
      if (res.success) {
        toast.success('Application sent. It’s in your tracker.')
        onApplied(res.data.id)
      }
    } catch (err) {
      setError(apiError(err, 'Couldn’t send your application.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} title={`Apply: ${job.title}`} description={`${job.company.name} will see your name, email, CV and note.`} size="lg">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextArea
          label="Your CV"
          required
          rows={10}
          value={cv}
          onChange={(e) => setCv(e.target.value.slice(0, 20000))}
          placeholder={loadingCv ? 'Loading your saved CV…' : 'Paste your CV text.'}
          hint={`${cv.length.toLocaleString()} / 20,000. Prefilled from your last uploaded CV when there is one.`}
        />
        <TextArea label="Note to the company" optional rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} placeholder="Why this role, availability, anything they should know." />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" icon="send" loading={busy}>
            Send application
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
