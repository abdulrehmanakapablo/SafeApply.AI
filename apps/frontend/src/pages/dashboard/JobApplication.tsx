// FILE: src/pages/dashboard/JobApplication.tsx
// ROUTE: /dashboard/applications/:id
// PURPOSE: The candidate's view of one application sent through the jobs
//          board: applied, CV opened (read receipt), first reply, stage
//          changes, final answer, plus the conversation.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import ThreadView from '../../components/messages/ThreadView'
import { StageBadge } from '../../components/jobs/JobBits'
import { OUTCOME_LABEL, STAGE_LABEL, getMyJobApplication, type MyJobApplication } from '../../api/recruiter'
import { Alert, Button, ButtonLink, Card, CardHeader, EmptyState, Icon, PageContainer, PageHeader, Skeleton, cn, formatDate, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'
import toast from 'react-hot-toast'
import { confirmHire } from '../../api/interviews'

interface Step {
  key: string
  label: string
  at: string | null
  icon: string
  tone?: 'accent' | 'warn' | 'danger'
}

export default function JobApplication() {
  const { id = '' } = useParams<{ id: string }>()
  const [a, setA] = useState<MyJobApplication | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'yes' | 'no' | ''>('')

  async function answer(confirmed: boolean) {
    if (busy) return
    setBusy(confirmed ? 'yes' : 'no')
    try {
      await confirmHire(id, confirmed)
      setA((cur) => (cur ? { ...cur, hire_confirmed: confirmed } : cur))
      toast.success(confirmed ? 'Hire confirmed. Congratulations.' : 'Thanks, noted.')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save your answer.'))
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    let cancelled = false
    getMyJobApplication(id)
      .then((r) => !cancelled && setA(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Application not found.')))
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="description" title="Application not found" body={error} action={<ButtonLink to="/dashboard/tracker">Back to tracker</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }
  if (!a) {
    return (
      <PageContainer>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 rounded-[16px]" />
      </PageContainer>
    )
  }

  const steps: Step[] = [
    { key: 'applied', label: 'You applied', at: a.created_at, icon: 'send' },
    { key: 'opened', label: a.cv_opened_at ? 'Your CV was opened' : 'CV not opened yet', at: a.cv_opened_at, icon: 'visibility', tone: a.cv_opened_at ? 'accent' : undefined },
    ...(a.first_response_at ? [{ key: 'reply', label: 'First reply', at: a.first_response_at, icon: 'reply', tone: 'accent' as const }] : []),
    ...a.events.map((e, i) => ({ key: `ev-${i}`, label: `Moved to ${STAGE_LABEL[e.stage]}`, at: e.created_at, icon: e.stage === 'hired' ? 'celebration' : e.stage === 'rejected' ? 'block' : 'arrow_forward', tone: e.stage === 'hired' ? ('accent' as const) : e.stage === 'rejected' ? ('danger' as const) : undefined })),
    ...(a.no_response ? [{ key: 'nr', label: 'No reply after 21 days. Counted on their public record.', at: null, icon: 'hourglass_disabled', tone: 'warn' as const }] : []),
    ...(a.job.status === 'closed' && a.job.outcome ? [{ key: 'closed', label: `Job closed: ${OUTCOME_LABEL[a.job.outcome]}`, at: a.job.closed_at, icon: 'lock' }] : []),
  ]

  return (
    <>
      <SEO title={`${a.job.title} | Application | SafeApply.AI`} description="Application timeline." path={`/dashboard/applications/${id}`} noindex />
      <PageContainer>
        <PageHeader
          back={{ to: '/dashboard/tracker', label: 'Tracker' }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{a.job.title}</span>
              <StageBadge stage={a.stage} />
            </span>
          }
          description={
            <>
              <Link to={`/companies/${a.job.company.slug}`} className="text-fg hover:text-accent">
                {a.job.company.name}
              </Link>{' '}
              · applied {relativeDays(a.created_at)} ·{' '}
              <Link to={`/companies/${a.job.company.slug}/hiring-record`} className="underline underline-offset-4 hover:text-fg">
                their hiring record
              </Link>
            </>
          }
          actions={
            <ButtonLink to={`/jobs/${a.job.id}`} variant="ghost" icon="description">
              Job post
            </ButtonLink>
          }
        />
        <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
          <Card>
            <CardHeader title="Timeline" className="mb-4" />
            <ol className="relative flex flex-col gap-5 pl-7 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-line">
              {steps.map((s) => (
                <li key={s.key} className="relative">
                  <span
                    className={cn(
                      'absolute -left-7 top-0 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center',
                      s.tone === 'accent' ? 'bg-accent text-ink' : s.tone === 'danger' ? 'bg-danger text-white' : s.tone === 'warn' ? 'bg-warn text-ink' : 'bg-line text-muted',
                    )}
                    aria-hidden
                  >
                    <Icon name={s.icon} className="text-[14px]" />
                  </span>
                  <p className="text-sm font-medium">{s.label}</p>
                  {s.at && (
                    <time dateTime={s.at} className="text-xs text-muted tabular">
                      {formatDate(s.at)}
                    </time>
                  )}
                </li>
              ))}
            </ol>
          </Card>
          <div className="flex flex-col gap-6 min-w-0">
          {a.stage === 'hired' && a.hire_confirmed === null && (
            <Card>
              <CardHeader title={`Did ${a.job.company.name} hire you?`} description="Your answer decides whether this counts as a verified hire on their public record." />
              <div className="flex flex-wrap gap-2">
                <Button icon="celebration" onClick={() => answer(true)} loading={busy === 'yes'}>
                  Yes, I was hired
                </Button>
                <Button variant="secondary" onClick={() => answer(false)} loading={busy === 'no'}>
                  No
                </Button>
              </div>
            </Card>
          )}
          {a.hire_confirmed !== null && a.stage === 'hired' && <Alert tone={a.hire_confirmed ? 'accent' : 'warn'}>{a.hire_confirmed ? 'You confirmed this hire. Congratulations.' : 'You said you weren’t hired. It won’t count as a verified hire.'}</Alert>}
          <Card padded={false}>
            <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Conversation with {a.job.company.name}</div>
            <ThreadView applicationId={a.id} />
          </Card>
          <Link to="/dashboard/interviews" className="text-sm text-muted hover:text-fg underline-offset-4 hover:underline self-start">
            Your interviews
          </Link>
          </div>
        </div>
      </PageContainer>
    </>
  )
}
