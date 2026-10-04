// FILE: src/pages/recruiter/JobPipeline.tsx
// ROUTE: /recruiter/jobs/:id
// PURPOSE: Applicants by stage. Each card has a stage menu (keyboard and
//          touch friendly); every move syncs to the candidate's tracker and
//          counts as a reply for the public response rate.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { JobFacts } from '../../components/jobs/JobBits'
import { OUTCOME_LABEL, STAGE_LABEL, STAGE_ORDER, getMyJob, setApplicantStage, updateJob, type Job, type JobStatus, type PipelineApp, type Stage } from '../../api/recruiter'
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, PageContainer, PageHeader, Skeleton, cn, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

const TONE = { open: 'accent', draft: 'neutral', paused: 'warn', closed: 'neutral' } as const

export default function JobPipeline() {
  const { id = '' } = useParams<{ id: string }>()
  const reduce = useReducedMotion()
  const [job, setJob] = useState<Job | null>(null)
  const [apps, setApps] = useState<PipelineApp[]>([])
  const [error, setError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getMyJob(id)
      const { applications, ...j } = res.data
      setJob(j)
      setApps(applications)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load this job.'))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const unopened = apps.filter((a) => !a.cv_opened_at && a.stage !== 'rejected').length

  async function move(app: PipelineApp, stage: Stage) {
    if (app.stage === stage) return
    const prev = app.stage
    setApps((p) => p.map((a) => (a.id === app.id ? { ...a, stage } : a)))
    try {
      await setApplicantStage(app.id, stage)
      toast.success(`${app.candidate_name}: ${STAGE_LABEL[stage]}`)
    } catch (e) {
      setApps((p) => p.map((a) => (a.id === app.id ? { ...a, stage: prev } : a)))
      toast.error(apiError(e, 'Couldn’t move the applicant.'))
    }
  }

  async function setStatus(status: JobStatus) {
    if (!job || statusBusy) return
    setStatusBusy(true)
    try {
      const res = await updateJob(job.id, { status })
      setJob((j) => (j ? { ...j, ...res.data } : j))
      toast.success(status === 'open' ? 'Job is live' : 'Job paused')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t change the job status.'))
    } finally {
      setStatusBusy(false)
    }
  }

  if (error) {
    return (
      <PageContainer>
        <Card padded={false}>
          <EmptyState icon="work_off" title="Job not found" body={error} action={<ButtonLink to="/recruiter/jobs">Back to jobs</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }

  return (
    <>
      <SEO title={`${job?.title || 'Job'} | Pipeline | SafeApply.AI`} description="Applicant pipeline." path={`/recruiter/jobs/${id}`} noindex />
      <PageContainer className="max-w-[1500px]">
        {!job ? (
          <>
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-64 rounded-[16px]" />
          </>
        ) : (
          <>
            <PageHeader
              back={{ to: '/recruiter/jobs', label: 'Jobs' }}
              title={
                <span className="flex flex-wrap items-center gap-3">
                  <span className="break-words">{job.title}</span>
                  <Badge tone={TONE[job.status]}>{job.status}</Badge>
                </span>
              }
              description={<JobFacts {...job} />}
              actions={
                <>
                  {job.status !== 'closed' && (
                    <ButtonLink to={`/recruiter/jobs/${job.id}/edit`} variant="secondary" icon="edit">
                      Edit
                    </ButtonLink>
                  )}
                  {job.status === 'open' ? (
                    <Button variant="secondary" icon="pause" onClick={() => setStatus('paused')} loading={statusBusy}>
                      Pause
                    </Button>
                  ) : job.status !== 'closed' ? (
                    <Button icon="play_arrow" onClick={() => setStatus('open')} loading={statusBusy}>
                      Publish
                    </Button>
                  ) : null}
                  {job.status !== 'closed' && (
                    <ButtonLink to={`/recruiter/jobs/${job.id}/close`} variant="ghost" className="hover:text-danger">
                      Close job
                    </ButtonLink>
                  )}
                </>
              }
            />
            {job.status === 'open' && <p className="text-xs text-muted -mt-2">Public at /jobs. Last activity {relativeDays(job.last_activity_at)}; 60 days of no activity takes it down.</p>}
            {job.status === 'closed' && job.outcome && <Alert tone="accent">Closed: {OUTCOME_LABEL[job.outcome]}{job.outcome_note ? `. ${job.outcome_note}` : ''}</Alert>}
            {job.ghost_flag && <Alert>This job is flagged as a ghost job on your public record: people applied and no CV was opened. Open your applicants to clear it.</Alert>}
            {unopened > 0 && !job.ghost_flag && (
              <Alert tone="warn">
                {unopened} CV{unopened === 1 ? '' : 's'} not opened yet. Applicants see when you open their CV, and unopened CVs count against your hiring record.
              </Alert>
            )}

            {apps.length === 0 ? (
              <Card padded={false}>
                <EmptyState icon="group" title="No applicants yet" body={job.status === 'open' ? 'Applicants appear here as soon as they apply.' : 'Publish the job to start receiving applicants.'} />
              </Card>
            ) : (
              <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto pb-2">
                <div className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-4">
                  {STAGE_ORDER.map((stage) => {
                    const col = apps.filter((a) => a.stage === stage)
                    return (
                      <section key={stage} aria-label={STAGE_LABEL[stage]} className="flex flex-col gap-2 min-h-[160px]">
                        <header className="flex items-center gap-2 px-1 h-7">
                          <h2 className="text-[13px] font-semibold">{STAGE_LABEL[stage]}</h2>
                          <span className="text-xs text-muted tabular">{col.length}</span>
                        </header>
                        <ul className="flex flex-col gap-2">
                          <AnimatePresence initial={false}>
                            {col.map((a) => {
                              const overdue = a.stage === 'applied' && !a.first_response_at && Date.now() - new Date(a.created_at).getTime() > 7 * 86_400_000
                              return (
                                <motion.li
                                  key={a.id}
                                  layout={!reduce}
                                  initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.97 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                  className={cn('relative bg-surface border rounded-[12px] p-3.5 flex flex-col gap-2', overdue ? 'border-warn/40' : 'border-line hover:border-muted/40')}
                                >
                                  <Link to={`/recruiter/applicants/${a.id}`} className="text-sm font-medium truncate hover:text-accent after:absolute after:inset-0">
                                    {a.candidate_name}
                                  </Link>
                                  <div className="flex items-center gap-2 text-xs text-muted">
                                    <span>{relativeDays(a.created_at)}</span>
                                    {a.match_score != null && (
                                      <>
                                        <span aria-hidden>·</span>
                                        <span className="tabular">{a.match_score}% keyword match</span>
                                      </>
                                    )}
                                  </div>
                                  {overdue && <span className="text-[11px] text-warn">Waiting over 7 days</span>}
                                  {!a.cv_opened_at && <span className="text-[11px] text-muted inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />Not opened</span>}
                                  <label className="sr-only" htmlFor={`stage-${a.id}`}>
                                    Move {a.candidate_name} to
                                  </label>
                                  <select
                                    id={`stage-${a.id}`}
                                    value={a.stage}
                                    onChange={(e) => move(a, e.target.value as Stage)}
                                    className="relative z-10 h-7 -mx-1 px-1.5 rounded-[6px] bg-transparent text-xs text-muted hover:bg-line focus:bg-line focus:outline-none cursor-pointer"
                                  >
                                    {STAGE_ORDER.map((s) => (
                                      <option key={s} value={s}>
                                        {STAGE_LABEL[s]}
                                      </option>
                                    ))}
                                  </select>
                                </motion.li>
                              )
                            })}
                          </AnimatePresence>
                        </ul>
                      </section>
                    )
                  })}
                </div>
              </div>
            )}
            {apps.some((a) => a.stage === 'applied') && (
              <Alert tone="accent">Tip: moving someone to Screening or Not selected counts as a reply. Candidates see it in their tracker straight away.</Alert>
            )}
          </>
        )}
      </PageContainer>
    </>
  )
}
