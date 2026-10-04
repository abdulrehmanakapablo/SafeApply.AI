// FILE: src/pages/recruiter/Applicant.tsx
// ROUTE: /recruiter/applicants/:id
// PURPOSE: One candidate: CV, note, stage, team notes, history, conversation.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import ThreadView from '../../components/messages/ThreadView'
import TeamNotes from '../../components/recruiter/TeamNotes'
import { StageBadge } from '../../components/jobs/JobBits'
import { STAGE_LABEL, STAGE_ORDER, getApplicant, setApplicantStage, type Applicant, type Stage } from '../../api/recruiter'
import { ButtonLink, Card, CardHeader, EmptyState, PageContainer, PageHeader, Select, Skeleton, cn, formatDate, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function ApplicantPage() {
  const { id = '' } = useParams<{ id: string }>()
  const [app, setApp] = useState<Applicant | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cvOpen, setCvOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getApplicant(id)
      .then((r) => !cancelled && setApp(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Applicant not found.')))
    return () => {
      cancelled = true
    }
  }, [id])

  async function changeStage(stage: Stage) {
    if (!app || busy || stage === app.stage) return
    const prev = app.stage
    setApp({ ...app, stage })
    setBusy(true)
    try {
      await setApplicantStage(app.id, stage)
      setApp((a) => (a ? { ...a, stage, events: [...a.events, { stage, created_at: new Date().toISOString() }] } : a))
      toast.success(`Moved to ${STAGE_LABEL[stage]}`)
    } catch (e) {
      setApp((a) => (a ? { ...a, stage: prev } : a))
      toast.error(apiError(e, 'Couldn’t change the stage.'))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="person_off" title="Applicant not found" body={error} action={<ButtonLink to="/recruiter/jobs">Back to jobs</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }
  if (!app) {
    return (
      <PageContainer>
        <Skeleton className="h-9 w-64" />
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <Skeleton className="h-96 rounded-[16px]" />
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </PageContainer>
    )
  }

  const cvLong = app.cv_text.length > 1600
  return (
    <>
      <SEO title={`${app.candidate.full_name} | Applicant | SafeApply.AI`} description="Applicant." path={`/recruiter/applicants/${id}`} noindex />
      <PageContainer>
        <PageHeader
          back={{ to: `/recruiter/jobs/${app.job.id}`, label: app.job.title }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{app.candidate.full_name}</span>
              <StageBadge stage={app.stage} />
            </span>
          }
          description={[app.candidate.job_title, app.candidate.location, `applied ${relativeDays(app.created_at)}`].filter(Boolean).join(' · ')}
          actions={
            app.stage !== 'rejected' && app.stage !== 'hired' ? (
              <ButtonLink to={`/recruiter/interviews/new?applicant=${app.id}`} icon="event">
                Schedule interview
              </ButtonLink>
            ) : undefined
          }
        />

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            {app.cover_note && (
              <Card>
                <CardHeader title="Note from the candidate" className="mb-3" />
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line break-words">{app.cover_note}</p>
              </Card>
            )}
            <Card>
              <CardHeader
                title="CV"
                action={app.match_score != null ? <span className="text-xs text-muted tabular">{app.match_score}% keyword match with the job post</span> : undefined}
                className="mb-3"
              />
              <pre className={cn('text-[13px] text-muted leading-relaxed whitespace-pre-wrap break-words font-sans', !cvOpen && cvLong && 'max-h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_80%,transparent)]')}>{app.cv_text}</pre>
              {cvLong && (
                <button type="button" onClick={() => setCvOpen((o) => !o)} className="mt-3 text-xs text-fg underline underline-offset-4">
                  {cvOpen ? 'Show less' : 'Show the whole CV'}
                </button>
              )}
            </Card>
            <Card padded={false}>
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Conversation</div>
              <ThreadView applicationId={app.id} />
            </Card>
          </div>

          <aside className="flex flex-col gap-6">
            <Card>
              <Select
                label="Stage"
                value={app.stage}
                disabled={busy}
                onChange={(e) => changeStage(e.target.value as Stage)}
                options={STAGE_ORDER.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
                hint="The candidate’s tracker updates and they get a notification."
              />
              <dl className="mt-5 flex flex-col divide-y divide-line text-sm">
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-muted">Email</dt>
                  <dd className="min-w-0 truncate">
                    <a href={`mailto:${app.candidate.email}`} className="hover:text-accent underline-offset-4 hover:underline">
                      {app.candidate.email}
                    </a>
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-muted">Applied</dt>
                  <dd className="tabular">{formatDate(app.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-muted">CV opened</dt>
                  <dd className="tabular">{app.cv_opened_at ? formatDate(app.cv_opened_at) : 'Now'}</dd>
                </div>
                <div className="flex justify-between gap-3 py-2.5">
                  <dt className="text-muted">First reply</dt>
                  <dd className={cn('tabular', !app.first_response_at && 'text-warn')}>{app.first_response_at ? formatDate(app.first_response_at) : 'Not yet'}</dd>
                </div>
              </dl>
            </Card>
            <TeamNotes applicationId={app.id} />
            <Card>
              <CardHeader title="History" className="mb-4" />
              <ol className="relative flex flex-col gap-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-line">
                {[...app.events].reverse().map((ev, i) => (
                  <li key={`${ev.created_at}-${i}`} className="relative">
                    <span className={cn('absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-surface', i === 0 ? 'bg-accent' : 'bg-line')} aria-hidden />
                    <p className="text-sm font-medium">{STAGE_LABEL[ev.stage] || ev.stage}</p>
                    <time dateTime={ev.created_at} className="text-xs text-muted tabular">
                      {formatDate(ev.created_at)}
                    </time>
                  </li>
                ))}
              </ol>
            </Card>
          </aside>
        </div>
      </PageContainer>
    </>
  )
}
