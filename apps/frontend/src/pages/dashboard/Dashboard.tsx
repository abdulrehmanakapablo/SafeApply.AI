// FILE: src/pages/dashboard/Dashboard.tsx
// ROUTE: /dashboard (auth required)
// BACKEND: GET /api/tracker, GET /api/reports/history, GET /api/analytics
// PURPOSE: Dashboard overview — stat cards, recent applications, funnel, and
//          a card for every service in the app.
// No mock data — empty states shown for new accounts.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { useAuthStore } from '../../store/authStore'
import { getApplications, type Application } from '../../api/tracker'
import { getReportHistory } from '../../api/reports'
import { getAnalytics } from '../../api/analytics'

// ─── Status styling ─────────────────────────────────────
type StatusKey =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'ghosted'

interface StatusStyle {
  label: string
  badgeClass: string
}

const STATUS_STYLES: Record<StatusKey, StatusStyle> = {
  saved: {
    label: 'Saved',
    badgeClass: 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]',
  },
  applied: {
    label: 'Applied',
    badgeClass: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
  },
  screening: {
    label: 'Screening',
    badgeClass: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30',
  },
  interviewing: {
    label: 'Interviewing',
    badgeClass: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30',
  },
  offered: {
    label: 'Offered',
    badgeClass: 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
  },
  ghosted: {
    label: 'Ghosted',
    badgeClass: 'bg-[#737373]/15 text-[#737373] border-[#737373]/30',
  },
}

function statusStyle(s: string): StatusStyle {
  return STATUS_STYLES[s as StatusKey] || STATUS_STYLES.saved
}

// ─── View models ────────────────────────────────────────
interface DashboardApplication {
  id: string
  company: string
  role: string
  status: StatusKey
  applied_label: string
  match_score: number
}

interface DashboardStats {
  total_applications: number
  response_rate: number
  reports_run: number
  reports_quota: number
  cv_matches: number
}

const EMPTY_STATS: DashboardStats = {
  total_applications: 0,
  response_rate: 0,
  reports_run: 0,
  reports_quota: 30,
  cv_matches: 0,
}

// ─── Helpers ────────────────────────────────────────────
function daysAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const d = Math.max(0, Math.round((now - then) / 86_400_000))
  if (d === 0) return 'Applied today'
  if (d === 1) return 'Applied yesterday'
  if (d < 7) return `Applied ${d} days ago`
  if (d < 14) return 'Applied 1 week ago'
  if (d < 30) return `Applied ${Math.floor(d / 7)} weeks ago`
  return `Applied ${Math.floor(d / 30)} month${d >= 60 ? 's' : ''} ago`
}

function toDashboardApplication(app: Application): DashboardApplication {
  return {
    id: app.id,
    company: app.company_name,
    role: app.job_title,
    status: app.status as StatusKey,
    applied_label: daysAgo(app.date_applied || app.created_at),
    match_score: app.match_score ?? 0,
  }
}

// ─── Data fetch ─────────────────────────────────────────
async function fetchDashboardData(): Promise<{
  applications: DashboardApplication[]
  stats: DashboardStats
}> {
  const [trackerRes, reportRes, analyticsRes] = await Promise.allSettled([
    getApplications({ page: 1 }),
    getReportHistory({ page: 1 }),
    getAnalytics('30d'),
  ])

  let applications: DashboardApplication[] = []
  const stats: DashboardStats = { ...EMPTY_STATS }

  if (
    trackerRes.status === 'fulfilled' &&
    trackerRes.value.success &&
    trackerRes.value.data &&
    trackerRes.value.data.length > 0
  ) {
    applications = trackerRes.value.data.slice(0, 5).map(toDashboardApplication)
    stats.total_applications =
      trackerRes.value.total || trackerRes.value.data.length
  }

  if (reportRes.status === 'fulfilled' && reportRes.value.success) {
    const totalReports = reportRes.value.total
    if (typeof totalReports === 'number' && totalReports > 0) {
      stats.reports_run = totalReports
    }
  }

  if (
    analyticsRes.status === 'fulfilled' &&
    analyticsRes.value.success &&
    analyticsRes.value.data
  ) {
    const a = analyticsRes.value.data
    if (a.response_rate > 0) stats.response_rate = a.response_rate
    if (a.total_applications > 0)
      stats.total_applications = a.total_applications
  }

  return { applications, stats }
}

// ─── Service card definition ────────────────────────────
interface ServiceCard {
  to: string
  icon: string
  title: string
  body: string
  cta: string
  badge?: string
}

interface ServiceGroup {
  label: string
  icon: string
  subtitle: string
  services: ServiceCard[]
}

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    label: 'Core Workflow',
    icon: 'hub',
    subtitle: 'Research, match, build, track',
    services: [
      {
        to: '/dashboard/company-report',
        icon: 'domain_verification',
        title: 'Analyze a Company',
        body: 'Full public intelligence — funding, tech stack, ghost-postings, and news — in one cited report.',
        cta: 'Run Report',
      },
      {
        to: '/dashboard/cv-match',
        icon: 'psychology',
        title: 'CV Intelligence',
        body: 'Match your CV against any job description. See missing keywords, ATS warnings, and AI rewrites.',
        cta: 'Match CV',
      },
      {
        to: '/dashboard/cv-builder',
        icon: 'edit_document',
        title: 'CV Builder',
        body: 'Build an ATS-approved CV with a live preview and export to PDF, DOCX, or plain TXT.',
        cta: 'Open Builder',
      },
      {
        to: '/dashboard/tracker',
        icon: 'radar',
        title: 'Application Tracker',
        body: 'Kanban and list views with status timelines, communication logs, and per-application notes.',
        cta: 'View Tracker',
      },
    ],
  },
  {
    label: 'Insights & Community',
    icon: 'insights',
    subtitle: 'Analytics and company reviews',
    services: [
      {
        to: '/dashboard/analytics',
        icon: 'bar_chart',
        title: 'Analytics',
        body: 'Response rates, interview conversion, and AI insights across your entire job hunt.',
        cta: 'View Analytics',
      },
      {
        to: '/companies',
        icon: 'domain',
        title: 'Company Reviews',
        body: 'Browse anonymous reviews from other job seekers. Ratings, culture scores, and open roles.',
        cta: 'Browse Companies',
      },
      {
        to: '/dashboard/review',
        icon: 'rate_review',
        title: 'Submit a Review',
        body: 'Help the community by sharing your experience — anonymous, moderated, and cited by others.',
        cta: 'Write Review',
      },
    ],
  },
  {
    label: 'Account',
    icon: 'settings',
    subtitle: 'Profile and subscription',
    services: [
      {
        to: '/dashboard/settings',
        icon: 'manage_accounts',
        title: 'Settings',
        body: 'Profile, password, notification preferences, and account management.',
        cta: 'Manage Account',
      },
      {
        to: '/dashboard/billing',
        icon: 'credit_card',
        title: 'Billing',
        body: 'View your current plan, usage quotas, invoice history, and payment methods.',
        cta: 'View Billing',
        badge: 'Free',
      },
    ],
  },
]

// ─── Stat card ──────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  trend,
  trendPositive,
  footerLeft,
  footerRight,
  progressPct,
}: {
  label: string
  value: string
  icon: string
  trend?: string
  trendPositive?: boolean
  footerLeft: string
  footerRight: string
  progressPct?: number
}) {
  return (
    <div className="bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#1A1A1A]/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden group transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373] truncate">
          {label}
        </span>
        <span className="material-symbols-outlined text-[20px] text-[#737373] group-hover:text-[#22c55e] transition-colors shrink-0">
          {icon}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-3xl sm:text-4xl font-extrabold text-white leading-none tracking-tight">
          {value}
        </span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 font-mono text-xs font-semibold shrink-0 ${
              trendPositive ? 'text-[#22c55e]' : 'text-[#EF4444]'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {trendPositive ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {trend}
          </span>
        )}
      </div>

      {typeof progressPct === 'number' && (
        <div className="mt-3 w-full bg-[#2a2a2a] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#22c55e] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs gap-2">
        <span className="text-[#737373] truncate">{footerLeft}</span>
        <span className="text-[#22c55e] font-medium whitespace-nowrap">
          {footerRight}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1A1A1A] group-hover:bg-[#22c55e] transition-colors" />
    </div>
  )
}

// ─── Donut chart ────────────────────────────────────────
interface FunnelSlice {
  label: string
  count: number
  color: string
}

function FunnelDonut({
  slices,
  total,
}: {
  slices: FunnelSlice[]
  total: number
}) {
  const r = 38
  const circumference = 2 * Math.PI * r
  const safeTotal = total || 1

  const dashValues = slices.map((s) => (s.count / safeTotal) * circumference)
  const computedSlices = slices.map((s, i) => ({
    ...s,
    dash: dashValues[i],
    offset: dashValues.slice(0, i).reduce((a, b) => a + b, 0),
  }))

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="transparent"
            stroke="#2a2a2a"
            strokeWidth="8"
          />
          {computedSlices.map((s) => (
            <circle
              key={s.label}
              cx="50"
              cy="50"
              r={r}
              fill="transparent"
              stroke={s.color}
              strokeWidth="8"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold text-white leading-none">
            {total}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#737373] mt-1">
            Units
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full mt-5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-white truncate">
              {s.label} ({s.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Service card tile ──────────────────────────────────
function ServiceTile({ service }: { service: ServiceCard }) {
  return (
    <Link
      to={service.to}
      className="group relative bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22c55e]/40 rounded-xl p-4 sm:p-5 transition-colors flex flex-col justify-between min-h-[180px]"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-lg bg-[#1c1b1b] group-hover:bg-[#22c55e] flex items-center justify-center transition-colors shrink-0">
            <span className="material-symbols-outlined text-white group-hover:text-black text-[22px] transition-colors">
              {service.icon}
            </span>
          </div>
          {service.badge && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] whitespace-nowrap">
              {service.badge}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-white group-hover:text-[#22c55e] transition-colors">
          {service.title}
        </h3>
        <p className="text-sm text-[#737373] leading-relaxed">
          {service.body}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[#1A1A1A] flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-[#22c55e] font-semibold truncate">
          {service.cta}
        </span>
        <span className="material-symbols-outlined text-[18px] text-[#737373] group-hover:text-[#22c55e] group-hover:translate-x-1 transition-all shrink-0">
          arrow_forward
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent group-hover:bg-[#22c55e] transition-colors rounded-b-xl" />
    </Link>
  )
}

// ─── Main component ─────────────────────────────────────
export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [applications, setApplications] = useState<DashboardApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date())

  const displayName = user?.full_name?.split(' ')[0] || 'Operator'

  useEffect(() => {
    let cancelled = false
    fetchDashboardData().then((data) => {
      if (cancelled) return
      setApplications(data.applications)
      setStats(data.stats)
      setLoading(false)
      setRefreshedAt(new Date())
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRefresh() {
    setLoading(true)
    const data = await fetchDashboardData()
    setApplications(data.applications)
    setStats(data.stats)
    setLoading(false)
    setRefreshedAt(new Date())
  }

  const funnelCounts = applications.reduce(
    (acc, app) => {
      const s = app.status
      if (s === 'offered' || s === 'applied') acc.active++
      else if (s === 'interviewing' || s === 'screening') acc.interview++
      else if (s === 'rejected') acc.rejected++
      else acc.archived++
      return acc
    },
    { active: 0, interview: 0, rejected: 0, archived: 0 }
  )

  const funnelTotal =
    funnelCounts.active +
    funnelCounts.interview +
    funnelCounts.rejected +
    funnelCounts.archived

  const funnelSlices: FunnelSlice[] = [
    { label: 'Offered / Active', count: funnelCounts.active, color: '#22c55e' },
    { label: 'Interview / Screen', count: funnelCounts.interview, color: '#EAB308' },
    { label: 'Rejected', count: funnelCounts.rejected, color: '#EF4444' },
    { label: 'Archived', count: funnelCounts.archived, color: '#737373' },
  ]

  const reportsPct =
    stats.reports_quota > 0
      ? Math.min(100, Math.round((stats.reports_run / stats.reports_quota) * 100))
      : 0

  const todayStr = refreshedAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      <SEO
        title="Dashboard | SafeApply.AI"
        description="Your SafeApply.AI dashboard — applications, reports, CV matches, and job hunt analytics at a glance."
        path="/dashboard"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Telemetry Node: Global Live
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              Welcome back, {displayName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#1A1A1A] px-3 py-1.5 rounded-lg text-xs">
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                verified
              </span>
              <span className="text-white font-medium">
                ATS Engine v4.8 Active
              </span>
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#0D0D0D] hover:bg-[#141414] border border-[#1A1A1A] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[16px] text-[#737373] ${
                  loading ? 'animate-spin' : ''
                }`}
              >
                {loading ? 'sync' : 'refresh'}
              </span>
              <span className="hidden sm:inline">
                {loading ? 'Refreshing…' : 'Refresh'}
              </span>
            </button>
          </div>
        </header>

        {/* ── Stat cards ─────────────────────────────── */}
        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            label="Total Applications"
            value={String(stats.total_applications)}
            icon="send_time_extension"
            footerLeft="Tracked in your pipeline"
            footerRight={`${applications.length} recent`}
          />
          <StatCard
            label="Response Rate"
            value={`${stats.response_rate}%`}
            icon="mark_email_read"
            footerLeft="Industry avg: 8.4%"
            footerRight={
              stats.response_rate > 8.4 ? 'Above average' : 'Room to grow'
            }
          />
          <StatCard
            label="Reports Run"
            value={`${stats.reports_run} / ${stats.reports_quota}`}
            icon="policy"
            footerLeft={`${reportsPct}% used`}
            footerRight={`${Math.max(
              0,
              stats.reports_quota - stats.reports_run
            )} remaining`}
            progressPct={reportsPct}
          />
          <StatCard
            label="CV Matches Run"
            value={String(stats.cv_matches)}
            icon="hub"
            footerLeft="Across all roles"
            footerRight={
              stats.cv_matches > 0 ? 'View in Analytics' : 'None yet'
            }
          />
        </section>

        {/* ── Recent applications + funnel ───────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent applications */}
          <div className="lg:col-span-2 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#22c55e] text-[20px] shrink-0">
                  dataset
                </span>
                <h2 className="text-base font-semibold text-white truncate">
                  Recent Applications
                </h2>
                <span className="text-xs text-[#737373] whitespace-nowrap">
                  ({applications.length} recent)
                </span>
              </div>
              <Link
                to="/dashboard/tracker"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#22c55e] hover:underline whitespace-nowrap"
              >
                View All
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">
                  sync
                </span>
                <p className="text-sm text-[#737373]">Loading applications…</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <span className="material-symbols-outlined text-[#737373] text-4xl mb-2">
                  inbox
                </span>
                <p className="text-sm text-white font-medium mb-1">
                  No applications yet
                </p>
                <p className="text-xs text-[#737373] mb-4">
                  Add your first application to start tracking your pipeline.
                </p>
                <Link
                  to="/dashboard/tracker"
                  className="bg-[#22c55e] hover:bg-[#16A34A] text-black text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Add Application
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-black text-[#737373] text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">
                        Company & Position
                      </th>
                      <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">
                        Timeline
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">
                        Match
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {applications.map((app) => {
                      const s = statusStyle(app.status)
                      return (
                        <tr
                          key={app.id}
                          className="hover:bg-[#141414] transition-colors group"
                        >
                          <td className="py-3 px-4">
                            <Link
                              to={`/dashboard/tracker/${app.id}`}
                              className="flex items-center gap-3 min-w-0"
                            >
                              <span className="w-9 h-9 rounded bg-[#2a2a2a] flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {app.company.charAt(0).toUpperCase()}
                              </span>
                              <span className="flex flex-col min-w-0">
                                <span className="text-sm text-white font-semibold group-hover:text-[#22c55e] transition-colors truncate">
                                  {app.company}
                                </span>
                                <span className="text-xs text-[#737373] truncate">
                                  {app.role}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <span className="text-xs text-[#737373]">
                              {app.applied_label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.badgeClass}`}
                            >
                              {s.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {app.match_score > 0 ? (
                              <span className="font-mono text-xs font-semibold text-[#22c55e]">
                                {app.match_score}%
                              </span>
                            ) : (
                              <span className="text-xs text-[#737373]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-auto px-4 py-3 border-t border-[#1A1A1A] flex items-center justify-between text-xs">
              <span className="text-[#737373]">
                Latest synchronizations shown
              </span>
              <span className="font-mono text-[#22c55e]">
                Updated {todayStr}
              </span>
            </div>
          </div>

          {/* Application Funnel */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-[#737373] font-semibold">
                  Pipeline Distribution
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#22c55e]">
                  pie_chart
                </span>
              </div>
              <h2 className="text-base font-semibold text-white">
                Application Funnel
              </h2>
              <p className="text-xs text-[#737373]">
                Real-time status breakdown across all tracked roles.
              </p>
            </div>

            <FunnelDonut slices={funnelSlices} total={funnelTotal} />

            <div className="bg-[#1c1b1b] border border-[#1A1A1A] rounded-lg p-3 flex items-center justify-between">
              <span className="text-xs text-[#737373]">
                High-probability matches
              </span>
              <span className="font-mono text-xs text-[#22c55e] font-semibold">
                {applications.filter((a) => a.match_score >= 90).length} Active
              </span>
            </div>
          </div>
        </section>

        {/* ── All Services ───────────────────────────── */}
        <section
          aria-label="All services"
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#22c55e] text-[20px]">
                apps
              </span>
              <h2 className="text-lg font-semibold text-white">
                All Services
              </h2>
            </div>
            <span className="text-xs text-[#737373]">
              {SERVICE_GROUPS.reduce(
                (sum, g) => sum + g.services.length,
                0
              )}{' '}
              tools available
            </span>
          </div>

          {SERVICE_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#737373] text-[16px]">
                  {group.icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  {group.label}
                </span>
                <span className="text-[11px] text-[#353534] hidden sm:inline">
                  • {group.subtitle}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.services.map((svc) => (
                  <ServiceTile key={svc.to} service={svc} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── Footer strip ───────────────────────────── */}
        <footer className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              Secure Enclave: Connected
            </span>
            <span className="hidden md:inline text-[#353534]">•</span>
            <span className="hidden md:inline text-[#737373]">
              Last automatic scan: {todayStr}
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[#737373]">
            <span>LATENCY 18ms</span>
            <span>API 200 OK</span>
          </div>
        </footer>
      </div>
    </>
  )
}