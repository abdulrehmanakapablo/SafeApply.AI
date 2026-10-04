// FILE: src/pages/dashboard/Dashboard.tsx
// ROUTE: /dashboard
// BACKEND: GET /api/tracker, GET /api/reports/history, GET /api/analytics?period=all
// Every number comes from the API. New accounts see a getting-started
// checklist instead of a wall of zeros.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { Reveal } from '../../components/motion/Reveal'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Icon,
  PageContainer,
  PageHeader,
  QuotaMeter,
  SkeletonRows,
  Skeleton,
  StatusBadge,
  STATUS_META,
  APPLICATION_STATUSES,
  cn,
  relativeDays,
  type AppStatus,
} from '../../components/ui'
import { FREE_LIMIT } from '../../lib/plans'
import { useBillingStatus } from '../../api/billing'
import { useAuthStore } from '../../store/authStore'
import { getApplications, type Application } from '../../api/tracker'
import { getReportHistory, type ReportListItem } from '../../api/reports'
import { getAnalytics, type AnalyticsData } from '../../api/analytics'
import { apiError } from '../../lib/axios'


const STATUS_COLOR: Record<AppStatus, string> = {
  saved: 'bg-muted/50',
  applied: 'bg-fg/80',
  screening: 'bg-warn/70',
  interviewing: 'bg-warn',
  offered: 'bg-accent',
  rejected: 'bg-danger/80',
  ghosted: 'bg-line',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Working late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

interface Data {
  apps: Application[]
  appsTotal: number
  reports: ReportListItem[]
  reportsTotal: number
  analytics: AnalyticsData | null
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const billing = useBillingStatus(user?.role !== 'admin')
  const isFree = user?.role !== 'admin' && !(billing?.pro ?? (user?.plan === 'pro' || user?.plan === 'lifetime'))
  const first = user?.full_name?.trim().split(/\s+/)[0]

  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [a, r, s] = await Promise.allSettled([getApplications({ page: 1 }), getReportHistory({ page: 1 }), getAnalytics('all')])
    const apps = a.status === 'fulfilled' && Array.isArray(a.value.data) ? a.value.data : []
    const reports = r.status === 'fulfilled' && Array.isArray(r.value.data) ? r.value.data : []
    const analytics = s.status === 'fulfilled' && s.value.data ? s.value.data : null
    if (a.status === 'rejected' && r.status === 'rejected' && s.status === 'rejected') setError(apiError(a.reason, 'Couldn’t load your dashboard.'))
    setData({
      apps,
      appsTotal: a.status === 'fulfilled' ? a.value.total || apps.length : 0,
      reports,
      reportsTotal: r.status === 'fulfilled' ? r.value.total || reports.length : 0,
      analytics,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reportsUsed = data?.analytics?.reports_run ?? data?.reportsTotal ?? 0
  const matchesUsed = data?.analytics?.cv_matches ?? 0
  const appsUsed = data?.analytics?.total_applications ?? data?.appsTotal ?? 0
  const isNew = !loading && data && reportsUsed === 0 && matchesUsed === 0 && appsUsed === 0

  return (
    <>
      <SEO title="Overview | SafeApply.AI" description="Your job search at a glance." path="/dashboard" noindex />
      <PageContainer>
        <PageHeader
          title={`${greeting()}${first ? `, ${first}` : ''}`}
          description={isNew ? 'Three steps and you’ll have your first report, a matched CV and a board to track it all.' : 'Here’s where your search stands.'}
          actions={
            <>
              <ButtonLink to="/dashboard/tracker" variant="secondary" icon="add">
                Add application
              </ButtonLink>
              <ButtonLink to="/dashboard/company-report" icon="travel_explore">
                New report
              </ButtonLink>
            </>
          }
        />

        {error && (
          <Alert>
            {error}{' '}
            <button type="button" onClick={() => void load()} className="text-fg underline underline-offset-2">
              Try again
            </button>
          </Alert>
        )}

        {isNew && <GettingStarted />}

        {/* Usage + headline numbers */}
        <Reveal>
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader
                title="Your search"
                description="All time"
                action={
                  <Link to="/dashboard/analytics" className="text-sm text-muted hover:text-fg transition-colors inline-flex items-center gap-1">
                    Analytics
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </Link>
                }
              />
              {loading ? (
                <div className="grid grid-cols-3 gap-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-7 w-12" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="grid grid-cols-3 gap-6">
                  <Metric label="Applications" value={appsUsed} />
                  <Metric
                    label="Response rate"
                    value={data?.analytics && appsUsed > 0 ? `${data.analytics.response_rate}%` : '-'}
                    hint={appsUsed === 0 ? 'Add applications to see this' : undefined}
                  />
                  <Metric label="Interviews" value={data?.analytics ? data.analytics.status_breakdown.interviewing + data.analytics.status_breakdown.offered : 0} />
                </dl>
              )}
            </Card>
            <Card>
              <CardHeader
                title={isFree ? 'Free allowance' : 'Usage'}
                description={isFree ? `${FREE_LIMIT} of each on the free plan` : 'Unlimited on your plan'}
                action={
                  <span className="flex gap-3">
                    <Link to="/me/progress" className="text-sm text-muted hover:text-fg transition-colors">
                      Your numbers
                    </Link>
                    <Link to="/dashboard/billing" className="text-sm text-muted hover:text-fg transition-colors">
                      Details
                    </Link>
                  </span>
                }
              />
              {loading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <QuotaMeter label="Company reports" used={reportsUsed} limit={isFree ? FREE_LIMIT : null} />
                  <QuotaMeter label="CV matches" used={matchesUsed} limit={isFree ? FREE_LIMIT : null} />
                  <QuotaMeter label="Tracked applications" used={appsUsed} limit={isFree ? FREE_LIMIT : null} />
                </div>
              )}
            </Card>
          </div>
        </Reveal>

        {/* Applications + pipeline */}
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <Card padded={false} className="h-full">
              <div className="p-5 sm:p-6 pb-0">
                <CardHeader
                  title="Recent applications"
                  action={
                    <Link to="/dashboard/tracker" className="text-sm text-muted hover:text-fg transition-colors inline-flex items-center gap-1">
                      Tracker
                      <Icon name="arrow_forward" className="text-[16px]" />
                    </Link>
                  }
                  className="mb-3"
                />
              </div>
              {loading ? (
                <div className="p-5 sm:p-6 pt-2">
                  <SkeletonRows rows={4} />
                </div>
              ) : !data?.apps.length ? (
                <EmptyState
                  icon="view_kanban"
                  title="Nothing tracked yet"
                  body="Add the roles you’ve applied to, or plan to. Status changes build your timeline automatically."
                  action={
                    <ButtonLink to="/dashboard/tracker" size="sm" icon="add">
                      Add application
                    </ButtonLink>
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {data.apps.slice(0, 6).map((a) => (
                    <li key={a.id}>
                      <Link to={`/dashboard/tracker/${a.id}`} className="flex items-center gap-3 px-5 sm:px-6 py-3.5 hover:bg-line/40 transition-colors">
                        <span className="w-9 h-9 rounded-[8px] bg-line flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden>
                          {a.company_name.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium truncate">{a.company_name}</span>
                          <span className="block text-xs text-muted truncate">{a.job_title}</span>
                        </span>
                        <span className="hidden sm:block text-xs text-muted tabular whitespace-nowrap">{relativeDays(a.date_applied || a.created_at)}</span>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card className="h-full">
              <CardHeader title="Pipeline" description="Where every application sits now" />
              {loading ? (
                <Skeleton className="h-3 w-full rounded-full" />
              ) : (
                <Pipeline breakdown={data?.analytics?.status_breakdown} />
              )}
            </Card>
          </Reveal>
        </div>

        {/* Recent reports */}
        <Reveal>
          <Card padded={false}>
            <div className="p-5 sm:p-6 pb-0">
              <CardHeader
                title="Recent company reports"
                action={
                  <Link to="/dashboard/company-report/history" className="text-sm text-muted hover:text-fg transition-colors inline-flex items-center gap-1">
                    All reports
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </Link>
                }
                className="mb-3"
              />
            </div>
            {loading ? (
              <div className="p-5 sm:p-6 pt-2">
                <SkeletonRows rows={3} />
              </div>
            ) : !data?.reports.length ? (
              <EmptyState
                icon="travel_explore"
                title="No reports yet"
                body="Paste a job post or type a company name. It takes about thirty seconds."
                action={
                  <ButtonLink to="/dashboard/company-report" size="sm">
                    Run a report
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border-t border-line">
                {data.reports.slice(0, 6).map((r) => (
                  <li key={r.id} className="bg-surface">
                    <Link to={`/dashboard/company-report/${r.id}`} className="block px-5 sm:px-6 py-4 hover:bg-line/40 transition-colors h-full">
                      <span className="block text-sm font-medium truncate">{r.company_name}</span>
                      <span className="block text-xs text-muted truncate mt-0.5">{r.job_title || 'Company only'}</span>
                      <span className="block text-xs text-muted mt-2 tabular">{relativeDays(r.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>

        {!loading && !error && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" icon="refresh" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        )}
      </PageContainer>
    </>
  )
}

function Metric({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted truncate">{label}</dt>
      <dd className="mt-1.5 text-[28px] font-semibold tabular leading-none tracking-tight">{value}</dd>
      {hint && <dd className="mt-1.5 text-xs text-muted">{hint}</dd>}
    </div>
  )
}

function Pipeline({ breakdown }: { breakdown?: AnalyticsData['status_breakdown'] }) {
  const entries = APPLICATION_STATUSES.map((s) => [s, breakdown?.[s] ?? 0] as const)
  const total = entries.reduce((n, [, v]) => n + v, 0)
  if (total === 0) {
    return <p className="text-sm text-muted">Your applications will appear here by stage once you add some.</p>
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-2.5 w-full gap-0.5 rounded-full overflow-hidden" role="img" aria-label="Applications by stage">
        {entries
          .filter(([, v]) => v > 0)
          .map(([s, v]) => (
            <span key={s} className={cn('h-full', STATUS_COLOR[s])} style={{ width: `${(v / total) * 100}%` }} />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {entries.map(([s, v]) => (
          <li key={s} className={cn('flex items-center justify-between gap-2 text-sm', v === 0 && 'opacity-50')}>
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLOR[s])} aria-hidden />
              <span className="truncate">{STATUS_META[s].label}</span>
            </span>
            <span className="tabular text-muted">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GettingStarted() {
  const steps = [
    { to: '/dashboard/company-report', icon: 'travel_explore', title: 'Check a company', body: 'Paste a job post you’re considering.' },
    { to: '/dashboard/cv-match', icon: 'compare_arrows', title: 'Match your CV', body: 'See what the posting asks for that your CV doesn’t say.' },
    { to: '/dashboard/tracker', icon: 'view_kanban', title: 'Track the application', body: 'Keep every role and follow-up in one place.' },
  ]
  return (
    <Reveal>
      <ol className="grid md:grid-cols-3 gap-px bg-line border border-line rounded-[var(--radius-card)] overflow-hidden">
        {steps.map((s, i) => (
          <li key={s.to} className="bg-surface">
            <Link to={s.to} className="group flex gap-4 p-5 sm:p-6 h-full hover:bg-line/40 transition-colors">
              <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Icon name={s.icon} className="text-[20px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted tabular">Step {i + 1}</span>
                <span className="block font-semibold mt-0.5 group-hover:text-accent transition-colors">{s.title}</span>
                <span className="block text-sm text-muted mt-1 leading-relaxed">{s.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Reveal>
  )
}
