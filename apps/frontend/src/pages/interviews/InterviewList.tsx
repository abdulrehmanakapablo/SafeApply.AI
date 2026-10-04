// FILE: src/pages/interviews/InterviewList.tsx
// ROUTES: /recruiter/interviews (company view), /dashboard/interviews (candidate)
// PURPOSE: Upcoming, waiting and past interviews. Past ones that still need
//          a "did it happen?" answer are surfaced first.

import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from '../../components/SEO'
import { MODE_ICON, MODE_LABEL, STATUS_LABEL, fmtSlot, isPast, listInterviews, type InterviewRow } from '../../api/interviews'
import { Alert, Badge, Card, EmptyState, Icon, PageContainer, PageHeader, SkeletonRows, Tabs } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Filter = 'upcoming' | 'waiting' | 'past'

export default function InterviewList() {
  const company = useLocation().pathname.startsWith('/recruiter')
  const [rows, setRows] = useState<InterviewRow[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('upcoming')

  useEffect(() => {
    listInterviews()
      .then((r) => setRows(r.data))
      .catch((e) => {
        setError(apiError(e, 'Couldn’t load interviews.'))
        setRows([])
      })
  }, [])

  const groups = useMemo(() => {
    const all = rows || []
    const mine = (r: InterviewRow) => (company ? r.company_confirmed : r.candidate_confirmed)
    return {
      upcoming: all.filter((r) => r.status === 'scheduled' && !isPast(r)),
      waiting: all.filter((r) => r.status === 'proposed' || r.status === 'reschedule_requested'),
      past: all.filter((r) => r.status === 'cancelled' || (r.status === 'scheduled' && isPast(r))).reverse(),
      toConfirm: all.filter((r) => r.status === 'scheduled' && isPast(r) && mine(r) === null).length,
    }
  }, [rows, company])
  const shown = groups[filter]

  return (
    <>
      <SEO title="Interviews | SafeApply.AI" description="Your interviews." path={company ? '/recruiter/interviews' : '/dashboard/interviews'} noindex />
      <PageContainer>
        <PageHeader
          title="Interviews"
          description={company ? 'Schedule from an applicant’s page. Only interviews the candidate confirms count on your hiring record.' : 'Pick times, join calls, and confirm interviews that happened.'}
        />
        {error && <Alert>{error}</Alert>}
        {groups.toConfirm > 0 && (
          <Alert tone="accent">
            {groups.toConfirm} past interview{groups.toConfirm === 1 ? ' needs' : 's need'} your confirmation. Open {groups.toConfirm === 1 ? 'it' : 'them'} under Past.
          </Alert>
        )}
        <Tabs
          label="Filter interviews"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
            { value: 'waiting', label: company ? 'Waiting for candidate' : 'Pick a time', count: groups.waiting.length },
            { value: 'past', label: 'Past', count: groups.past.length },
          ]}
          className="self-start"
        />
        <Card padded={false} className="overflow-hidden">
          {!rows ? (
            <div className="p-5">
              <SkeletonRows rows={3} />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon="event" title="Nothing here" body={company ? 'Open an applicant and choose Schedule interview.' : 'When a company invites you, the interview appears here.'} />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link to={`/interviews/${r.id}`} className="group flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-line/30 transition-colors">
                    <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <Icon name={MODE_ICON[r.mode]} className="text-[20px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate group-hover:text-accent transition-colors">{company ? r.candidate_name : r.company.name}</p>
                      <p className="text-xs text-muted truncate">
                        {r.job.title} · {MODE_LABEL[r.mode]} · {r.duration_min} min
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.scheduled_at && r.status === 'scheduled' && <span className="text-sm tabular">{fmtSlot(r.scheduled_at)}</span>}
                      <Badge tone={r.status === 'scheduled' ? 'accent' : r.status === 'cancelled' ? 'danger' : 'warn'}>{STATUS_LABEL[r.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageContainer>
    </>
  )
}
