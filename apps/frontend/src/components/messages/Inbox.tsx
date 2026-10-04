// FILE: src/components/messages/Inbox.tsx
// PURPOSE: Two-pane inbox shared by seekers (/dashboard/messages) and
//          recruiters (/recruiter/messages). List left, thread right;
//          on phones one pane at a time.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEO from '../SEO'
import ThreadView from './ThreadView'
import { StageBadge } from '../jobs/JobBits'
import { listThreads, type ThreadSummary } from '../../api/recruiter'
import { Alert, Card, EmptyState, Icon, PageContainer, PageHeader, SkeletonRows, cn, relativeDays } from '../ui'
import { apiError } from '../../lib/axios'

export default function Inbox({ base, emptyBody }: { base: '/dashboard/messages' | '/recruiter/messages'; emptyBody: string }) {
  const { id } = useParams<{ id: string }>()
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listThreads()
      .then((res) => !cancelled && setThreads(res.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Couldn’t load messages.')))
    return () => {
      cancelled = true
    }
  }, [id])

  const active = threads?.find((t) => t.application_id === id)

  return (
    <>
      <SEO title="Messages | SafeApply.AI" description="Your conversations." path={base} noindex />
      <PageContainer>
        <PageHeader title="Messages" description="One conversation per application." />
        {error && <Alert>{error}</Alert>}
        <Card padded={false} className="grid lg:grid-cols-[320px_1fr] min-h-[480px] overflow-hidden">
          <div className={cn('border-b lg:border-b-0 lg:border-r border-line', id && 'hidden lg:block')}>
            {!threads ? (
              <div className="p-4">
                <SkeletonRows rows={4} />
              </div>
            ) : threads.length === 0 ? (
              <EmptyState icon="forum" title="No conversations" body={emptyBody} />
            ) : (
              <ul className="divide-y divide-line max-h-[70vh] overflow-y-auto">
                {threads.map((t) => (
                  <li key={t.application_id}>
                    <Link
                      to={`${base}/${t.application_id}`}
                      aria-current={t.application_id === id ? 'page' : undefined}
                      className={cn('block px-4 py-3 transition-colors', t.application_id === id ? 'bg-line' : 'hover:bg-line/50')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{t.counterpart}</span>
                        {t.last_message && <span className="text-[11px] text-muted shrink-0">{relativeDays(t.last_message.created_at)}</span>}
                      </div>
                      <p className="text-xs text-muted truncate">{t.job_title}</p>
                      <p className="text-xs text-muted/90 truncate mt-1">{t.last_message ? t.last_message.body : 'No messages yet'}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={cn('flex flex-col min-w-0', !id && 'hidden lg:flex')}>
            {id ? (
              <>
                <div className="h-14 px-4 flex items-center gap-3 border-b border-line">
                  <Link to={base} className="lg:hidden w-8 h-8 -ml-2 rounded-[8px] flex items-center justify-center text-muted hover:text-fg" aria-label="Back to conversations">
                    <Icon name="arrow_back" className="text-[20px]" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{active?.counterpart || 'Conversation'}</p>
                    <p className="text-xs text-muted truncate">{active?.job_title}</p>
                  </div>
                  {active && <StageBadge stage={active.stage} />}
                </div>
                <ThreadView key={id} applicationId={id} className="flex-1" />
              </>
            ) : (
              <div className="m-auto text-center text-sm text-muted p-10">Pick a conversation.</div>
            )}
          </div>
        </Card>
      </PageContainer>
    </>
  )
}
