// FILE: src/pages/recruiter/Analytics.tsx
// ROUTE: /recruiter/analytics
// PURPOSE: Hiring analytics from recorded events only: funnel, response
//          speed, weekly volume, per-job and per-teammate activity.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { STAGE_LABEL, type Stage } from '../../api/recruiter'
import { fmtHours, getHiringAnalytics, type HiringAnalytics } from '../../api/teams'
import { apiError } from '../../lib/axios'
import { Alert, Card, CardHeader, EmptyState, PageContainer, PageHeader, Skeleton, Stat, Tabs, cn } from '../../components/ui'

type Range = '30' | '90' | '365'
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

export default function RecruiterAnalytics() {
  const [range, setRange] = useState<Range>('90')
  const [data, setData] = useState<HiringAnalytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    getHiringAnalytics(Number(range))
      .then((r) => !cancelled && setData(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Couldn’t load analytics.')))
    return () => {
      cancelled = true
    }
  }, [range])

  const t = data?.totals
  const maxWeek = Math.max(1, ...(data?.weekly.map((w) => w.count) || [0]))
  const top = data?.funnel[0]?.count || 0
  return (
    <>
      <SEO title="Analytics | Recruiter | SafeApply.AI" description="Hiring analytics." path="/recruiter/analytics" noindex />
      <PageContainer>
        <PageHeader
          title="Hiring analytics"
          description="Built only from what happened on SafeApply. The same numbers feed your public hiring record."
          actions={
            <Tabs
              label="Range"
              value={range}
              onChange={setRange}
              items={[
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
                { value: '365', label: '12 months' },
              ]}
            />
          }
        />
        {error && <Alert>{error}</Alert>}
        {!data && !error ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[16px]" />
            ))}
          </div>
        ) : data && t && t.applications === 0 ? (
          <Card padded={false}>
            <EmptyState icon="query_stats" title="No applications in this period" body="Analytics fill in as people apply to your jobs." />
          </Card>
        ) : data && t ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <Stat label="Applications" value={t.applications.toLocaleString()} />
              </Card>
              <Card>
                <Stat label="CVs opened" value={`${pct(t.opened, t.applications)}%`} hint={`median ${fmtHours(data.median_hours.to_open)}`} />
              </Card>
              <Card>
                <Stat label="Got a reply" value={`${pct(t.replied, t.applications)}%`} hint={`median ${fmtHours(data.median_hours.to_reply)}`} />
              </Card>
              <Card>
                <Stat label="Hired" value={t.hired.toLocaleString()} hint={`median ${fmtHours(data.median_hours.to_hire)} to hire`} />
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader title="Funnel" description="How far applicants got, including those later rejected." className="mb-5" />
                <ol className="flex flex-col gap-3">
                  {data.funnel.map((f) => (
                    <li key={f.stage} className="grid grid-cols-[96px_1fr_64px] items-center gap-3 text-sm">
                      <span className="text-muted">{STAGE_LABEL[f.stage as Stage] || f.stage}</span>
                      <span className="h-2.5 rounded-full bg-line overflow-hidden">
                        <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct(f.count, top)}%` }} />
                      </span>
                      <span className="text-right tabular">
                        {f.count} <span className="text-muted text-xs">{pct(f.count, top)}%</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card>
                <CardHeader title="Applications per week" className="mb-5" />
                <div className="h-40 flex items-end gap-1" role="img" aria-label={`Weekly applications, peak ${maxWeek}`}>
                  {data.weekly.map((w) => (
                    <div key={w.week} className="group relative flex-1 min-w-[3px] h-full flex items-end">
                      <div className="w-full rounded-t-[3px] bg-accent/70 group-hover:bg-accent transition-colors" style={{ height: `${Math.max(4, (w.count / maxWeek) * 100)}%` }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded-[4px] bg-surface border border-line px-1.5 py-0.5 text-[11px] tabular opacity-0 group-hover:opacity-100">
                        {w.week}: {w.count}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted tabular">
                  <span>{data.weekly[0]?.week}</span>
                  <span>{data.weekly[data.weekly.length - 1]?.week}</span>
                </div>
              </Card>
            </div>

            <Card padded={false} className="overflow-hidden">
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">By job</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="text-left font-normal px-5 py-2.5">Job</th>
                      <th className="text-right font-normal px-3 py-2.5">Applied</th>
                      <th className="text-right font-normal px-3 py-2.5">CV opened</th>
                      <th className="text-right font-normal px-3 py-2.5">Replied</th>
                      <th className="text-right font-normal px-5 py-2.5">Hired</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular">
                    {data.jobs.map((j) => {
                      const low = j.apps >= 3 && pct(j.opened, j.apps) < 50
                      return (
                        <tr key={j.id}>
                          <td className="px-5 py-3 max-w-[280px]">
                            <Link to={`/recruiter/jobs/${j.id}`} className="hover:text-accent truncate block">
                              {j.title}
                            </Link>
                            <span className="text-xs text-muted capitalize">{j.status}</span>
                          </td>
                          <td className="text-right px-3">{j.apps}</td>
                          <td className={cn('text-right px-3', low && 'text-warn')}>{pct(j.opened, j.apps)}%</td>
                          <td className="text-right px-3">{pct(j.replied, j.apps)}%</td>
                          <td className="text-right px-5">{j.hired}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {data.team.length > 1 && (
              <Card>
                <CardHeader title="Team activity" description="Stage changes made by each teammate in this period." className="mb-4" />
                <ul className="flex flex-col gap-2.5">
                  {data.team.map((m, i) => (
                    <li key={`${m.full_name}-${i}`} className="flex items-center justify-between text-sm">
                      <span className="truncate">{m.full_name}</span>
                      <span className="tabular text-muted">{m.moves}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        ) : null}
      </PageContainer>
    </>
  )
}
