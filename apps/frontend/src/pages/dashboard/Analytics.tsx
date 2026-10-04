// FILE: src/pages/dashboard/Analytics.tsx
// ROUTE: /dashboard/analytics
// BACKEND: GET /api/analytics?period=
// PURPOSE: Real numbers from the user's tracked applications. No samples,
//          no placeholders. Empty accounts get an empty state.

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { getAnalytics, type AnalyticsData, type AnalyticsPeriod } from '../../api/analytics'
import { APPLICATION_STATUSES, Alert, ButtonLink, Card, CardHeader, EmptyState, Icon, PageContainer, PageHeader, STATUS_META, Skeleton, Stat, Tabs, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
]

const BAR: Record<string, string> = {
  saved: 'bg-muted/50',
  applied: 'bg-fg/70',
  screening: 'bg-accent/50',
  interviewing: 'bg-accent/80',
  offered: 'bg-accent',
  rejected: 'bg-danger/80',
  ghosted: 'bg-muted/30',
}

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`

export default function Analytics() {
  const reduce = useReducedMotion()
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getAnalytics(period)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) setData(res.data)
        else setError(res.error || 'Couldn’t load analytics.')
      })
      .catch((e) => !cancelled && setError(apiError(e, 'Couldn’t load analytics.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [period, nonce])

  const total = data?.total_applications ?? 0
  const b = data?.status_breakdown
  const max = b ? Math.max(1, ...APPLICATION_STATUSES.map((s) => b[s] || 0)) : 1
  const label = PERIODS.find((p) => p.value === period)?.label.toLowerCase()

  return (
    <>
      <SEO title="Analytics | SafeApply.AI" description="How your job search is going." path="/dashboard/analytics" noindex />
      <PageContainer>
        <PageHeader
          title="Analytics"
          description="Based only on the applications you’ve tracked."
          actions={<Tabs label="Period" value={period} onChange={setPeriod} items={PERIODS} />}
        />

        {error && (
          <Alert title="Couldn’t load analytics">
            {error}{' '}
            <button type="button" onClick={() => setNonce((n) => n + 1)} className="underline underline-offset-2">
              Try again
            </button>
          </Alert>
        )}

        {loading && !data ? (
          <>
            <Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            </Card>
            <Skeleton className="h-72 rounded-[16px]" />
          </>
        ) : data && total === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="insights"
              title={period === 'all' ? 'Nothing to measure yet' : `No applications in the last ${label}`}
              body="Add applications in the tracker and update their status as you hear back. Response, interview and offer rates show up here."
              action={<ButtonLink to="/dashboard/tracker">Open the tracker</ButtonLink>}
            />
          </Card>
        ) : data && b ? (
          <div className={cn('flex flex-col gap-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
            <Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <Stat label="Applications" value={total} hint={period === 'all' ? 'All time' : `Last ${label}`} />
                <Stat label="Got a response" value={pct(data.response_rate)} hint="Screening or further, or a rejection" />
                <Stat label="Reached interview" value={pct(data.interview_rate)} />
                <Stat label="Offers" value={pct(data.offer_rate)} hint={`${b.offered} offer${b.offered === 1 ? '' : 's'}`} />
              </div>
            </Card>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
              <Card>
                <CardHeader title="Where your applications are" description="Current status of each one." />
                <ul className="flex flex-col gap-3">
                  {APPLICATION_STATUSES.map((s, i) => {
                    const n = b[s] || 0
                    return (
                      <li key={s} className="grid grid-cols-[96px_1fr_40px] items-center gap-3 text-sm">
                        <span className="text-muted">{STATUS_META[s].label}</span>
                        <div className="h-2 rounded-full bg-line/60 overflow-hidden">
                          <motion.div
                            key={`${period}-${s}-${n}`}
                            className={cn('h-full rounded-full origin-left', BAR[s])}
                            initial={reduce ? false : { scaleX: 0 }}
                            animate={{ scaleX: n / max }}
                            transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.03, ease: [0.23, 1, 0.32, 1] }}
                          />
                        </div>
                        <span className="text-right tabular">{n}</span>
                      </li>
                    )
                  })}
                </ul>
              </Card>

              <Card>
                <CardHeader title="Outcomes" description="Share of all applications in this period." />
                <dl className="flex flex-col divide-y divide-line text-sm">
                  {[
                    { k: 'Rejected', v: data.rejection_rate, tone: 'text-danger' },
                    { k: 'No reply', v: data.ghosted_rate, tone: 'text-muted' },
                    { k: 'Interview or offer', v: data.interview_rate, tone: 'text-accent' },
                  ].map((r) => (
                    <div key={r.k} className="flex items-center justify-between py-3">
                      <dt className="text-muted">{r.k}</dt>
                      <dd className={cn('tabular font-medium', r.tone)}>{pct(r.v)}</dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">Average CV match</dt>
                    <dd className="tabular font-medium">{data.avg_match_score > 0 ? `${data.avg_match_score}%` : 'Not measured'}</dd>
                  </div>
                </dl>
              </Card>
            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
              <Card>
                <CardHeader title="Observations" description="Written by AI from the numbers above. Treat them as prompts, not advice." />
                {data.insights?.length ? (
                  <ul className="flex flex-col gap-3">
                    {data.insights.map((t, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <Icon name="arrow_right_alt" className="text-[18px] text-accent shrink-0 mt-0.5" />
                        <span className="text-muted">{t}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">{total < 5 ? 'Track at least 5 applications for observations.' : 'None for this period.'}</p>
                )}
              </Card>

              <Card>
                <CardHeader title="Research in this period" />
                <dl className="flex flex-col divide-y divide-line text-sm">
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">Company reports</dt>
                    <dd className="tabular">{data.reports_run}</dd>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <dt className="text-muted">CV matches</dt>
                    <dd className="tabular">{data.cv_matches}</dd>
                  </div>
                </dl>
              </Card>
            </div>
          </div>
        ) : null}
      </PageContainer>
    </>
  )
}
