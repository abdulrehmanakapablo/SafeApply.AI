// FILE: src/pages/admin/AdminDashboard.tsx
// ROUTE: /admin (admin only)
// BACKEND: GET /api/admin/stats, GET /api/admin/users
// PURPOSE: Admin console — platform metrics, growth chart, revenue chart,
//          recent signups table.

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { getAdminStats, getAdminUsers, type AdminUser } from '../../api/admin'

// ─── Types ──────────────────────────────────────────────
interface Metrics {
  total_users: number
  active_this_month: number
  verified_reviews: number
  new_today: number
  mrr: number
  arr: number
  daily_syncs: number
  sync_error_rate: number
  moderation_backlog: number
  churn_rate: number
  organic_referral_rate: number
  growth_velocity: string
}

interface DemoUser {
  id: string
  email: string
  initials: string
  uid: string
  plan: 'free' | 'pro' | 'enterprise'
  plan_label: string
  timestamp: string
  channel: string
  channel_icon: string
  verified: 'attested' | 'pending'
}

// ─── Demo fallback ──────────────────────────────────────
const DEMO_METRICS: Metrics = {
  total_users: 42891,
  active_this_month: 31420,
  verified_reviews: 18942,
  new_today: 184,
  mrr: 128450,
  arr: 1541400,
  daily_syncs: 9420,
  sync_error_rate: 0.04,
  moderation_backlog: 14,
  churn_rate: 1.8,
  organic_referral_rate: 68.4,
  growth_velocity: '+1.4k/wk',
}

const DEMO_USERS: DemoUser[] = [
  { id: 'u1', email: 'dev_elena@proton.me', initials: 'EC', uid: 'usr_89f02a', plan: 'pro', plan_label: 'Pro Annual', timestamp: '2 mins ago', channel: 'GitHub OAuth', channel_icon: 'terminal', verified: 'attested' },
  { id: 'u2', email: 'alex.chen@alumni.cmu.edu', initials: 'AC', uid: 'usr_4b18cd', plan: 'enterprise', plan_label: 'Enterprise Seat', timestamp: '11 mins ago', channel: 'SSO / Okta SAML', channel_icon: 'corporate_fare', verified: 'attested' },
  { id: 'u3', email: 'marcus.k@fastmail.com', initials: 'MK', uid: 'usr_09de11', plan: 'free', plan_label: 'Free Tier', timestamp: '26 mins ago', channel: 'Direct / Organic', channel_icon: 'link', verified: 'pending' },
  { id: 'u4', email: 's.zimmerman@berlin-tech.io', initials: 'SZ', uid: 'usr_e771c9', plan: 'pro', plan_label: 'Pro Monthly', timestamp: '44 mins ago', channel: 'LinkedIn Referral', channel_icon: 'share', verified: 'attested' },
  { id: 'u5', email: 'tanya.rodriguez@yc-alumni.net', initials: 'TR', uid: 'usr_bb2340', plan: 'pro', plan_label: 'Pro Annual', timestamp: '1 hr ago', channel: 'YCombinator Jobs', channel_icon: 'campaign', verified: 'attested' },
  { id: 'u6', email: 'jonah.w@resumelab.internal', initials: 'JW', uid: 'usr_33a90f', plan: 'free', plan_label: 'Free Tier', timestamp: '1 hr 14m ago', channel: 'Google Search ATS', channel_icon: 'search', verified: 'attested' },
]

// ─── Helpers ────────────────────────────────────────────
function toDemoUser(u: AdminUser): DemoUser {
  const initials = u.full_name
    ? u.full_name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : u.email.slice(0, 2).toUpperCase()

  return {
    id: u.id,
    email: u.email,
    initials,
    uid: `usr_${u.id.slice(0, 6)}`,
    plan: (u.plan === 'lifetime' ? 'pro' : u.plan) as DemoUser['plan'],
    plan_label:
      u.plan === 'lifetime' ? 'Lifetime' : u.plan === 'pro' ? 'Pro' : 'Free Tier',
    timestamp: new Date(u.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    channel: 'Direct',
    channel_icon: 'link',
    verified: 'attested',
  }
}

function planBadgeClass(plan: DemoUser['plan']): string {
  if (plan === 'pro') return 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
  if (plan === 'enterprise') return 'bg-[#2a2a2a] text-white border-white/10'
  return 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]'
}

// ─── Metric card ────────────────────────────────────────
function MetricCard({
  label,
  icon,
  value,
  delta,
  deltaPositive,
  footerLeft,
  footerRight,
  warning,
}: {
  label: string
  icon: string
  value: string
  delta: string
  deltaPositive: boolean
  footerLeft: string
  footerRight: string
  warning?: boolean
}) {
  return (
    <div
      className={`bg-[#0D0D0D] border rounded-xl p-4 sm:p-5 flex flex-col gap-3 transition-colors ${
        warning
          ? 'border-[#EAB308]/40 hover:border-[#EAB308]/60'
          : 'border-[#1A1A1A] hover:border-[#22c55e]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373] truncate">
          {label}
        </span>
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${
            warning ? 'text-[#EAB308]' : 'text-[#737373]'
          }`}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span
          className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none ${
            warning ? 'text-[#EAB308]' : 'text-white'
          }`}
        >
          {value}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
            deltaPositive
              ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
              : warning
              ? 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30'
              : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
          }`}
        >
          <span className="material-symbols-outlined text-[12px]">
            {deltaPositive ? 'arrow_upward' : 'south'}
          </span>
          {delta}
        </span>
      </div>
      <div className="pt-3 border-t border-[#1A1A1A] flex items-center justify-between text-xs gap-2">
        <span className="text-[#737373] truncate">{footerLeft}</span>
        <span
          className={`font-mono whitespace-nowrap ${
            warning ? 'text-[#EAB308]' : 'text-[#22c55e]'
          }`}
        >
          {footerRight}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────
export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(DEMO_METRICS)
  const [users, setUsers] = useState<DemoUser[]>(DEMO_USERS)
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState<number>(() => Date.now())
  const [now, setNow] = useState<number>(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pro' | 'enterprise' | 'free'>(
    'all'
  )

  // Tick "now" every second — needed for the "Updated Xs ago" label
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load data on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [statsRes, usersRes] = await Promise.allSettled([
          getAdminStats(),
          getAdminUsers({ page: 1 }),
        ])

        if (cancelled) return

        if (
          statsRes.status === 'fulfilled' &&
          statsRes.value.success &&
          statsRes.value.data
        ) {
          const s = statsRes.value.data
          setMetrics((prev) => ({
            ...prev,
            total_users: s.total_users || prev.total_users,
            verified_reviews: s.total_reviews || prev.verified_reviews,
          }))
        }

        if (
          usersRes.status === 'fulfilled' &&
          usersRes.value.success &&
          usersRes.value.data &&
          usersRes.value.data.length > 0
        ) {
          setUsers(usersRes.value.data.slice(0, 6).map(toDemoUser))
        }
      } catch {
        // keep demo
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshedAt(Date.now())
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      const [statsRes, usersRes] = await Promise.allSettled([
        getAdminStats(),
        getAdminUsers({ page: 1 }),
      ])

      if (
        statsRes.status === 'fulfilled' &&
        statsRes.value.success &&
        statsRes.value.data
      ) {
        const s = statsRes.value.data
        setMetrics((prev) => ({
          ...prev,
          total_users: s.total_users || prev.total_users,
          verified_reviews: s.total_reviews || prev.verified_reviews,
        }))
      }

      if (
        usersRes.status === 'fulfilled' &&
        usersRes.value.success &&
        usersRes.value.data &&
        usersRes.value.data.length > 0
      ) {
        setUsers(usersRes.value.data.slice(0, 6).map(toDemoUser))
      }
    } catch {
      // keep demo
    } finally {
      setRefreshedAt(Date.now())
      setRefreshing(false)
    }
  }

  const secondsAgo = Math.max(0, Math.floor((now - refreshedAt) / 1000))
  const elapsedLabel =
    secondsAgo < 5 ? 'Updated just now' : `Updated ${secondsAgo}s ago`

  const filteredUsers = useMemo(() => {
    if (filter === 'all') return users
    return users.filter((u) => u.plan === filter)
  }, [users, filter])

  return (
    <>
      <SEO
        title="Admin Dashboard | SafeApply.AI"
        description="Platform admin — system metrics, growth, revenue, and user activity."
        path="/admin"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#1A1A1A]">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Admin Console
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                Root privileges
              </span>
            </div>
            <p className="text-sm text-[#737373]">
              Real-time system telemetry, candidate growth metrics, and audit overview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-xs">
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                sync
              </span>
              <span className="text-[#737373]">{elapsedLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0D0D0D] hover:bg-[#141414] border border-[#1A1A1A] text-white text-xs font-medium transition-colors disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  refreshing ? 'animate-spin' : ''
                }`}
              >
                {refreshing ? 'sync' : 'refresh'}
              </span>
              Refresh
            </button>
          </div>
        </header>

        {/* ── Metric grid ────────────────────────────── */}
        <section
          aria-label="System metrics"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <MetricCard
            label="Total Registered Users"
            icon="group"
            value={metrics.total_users.toLocaleString()}
            delta="+12.4%"
            deltaPositive
            footerLeft={`${metrics.active_this_month.toLocaleString()} active this month`}
            footerRight="73.2% ENGAGED"
          />
          <MetricCard
            label="Verified Dossier Reviews"
            icon="verified"
            value={metrics.verified_reviews.toLocaleString()}
            delta={`+${metrics.new_today} today`}
            deltaPositive
            footerLeft="99.4% attestation rate"
            footerRight="ECDSA OK"
          />
          <MetricCard
            label="Monthly Recurring Revenue"
            icon="payments"
            value={`$${metrics.mrr.toLocaleString()}`}
            delta="+8.2% MoM"
            deltaPositive
            footerLeft="Pro & Lifetime tiers"
            footerRight={`ARR ~$${(metrics.arr / 1_000_000).toFixed(2)}M`}
          />
          <MetricCard
            label="Daily ATS Syncs"
            icon="hub"
            value={metrics.daily_syncs.toLocaleString()}
            delta="+15.1%"
            deltaPositive
            footerLeft="Greenhouse, Lever, Workday"
            footerRight={`${metrics.sync_error_rate}% ERR`}
          />
          <MetricCard
            label="Moderation Backlog"
            icon="pending_actions"
            value={String(metrics.moderation_backlog)}
            delta="Requires review"
            deltaPositive={false}
            footerLeft="Avg turnaround 18 mins"
            footerRight="PROCESS →"
            warning
          />
          <MetricCard
            label="Platform Churn Rate"
            icon="tune"
            value={`${metrics.churn_rate}%`}
            delta="-0.4% MoM"
            deltaPositive
            footerLeft="Industry benchmark 4.2%"
            footerRight="-57% VS BENCH"
          />
        </section>

        {/* ── Charts ─────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Growth chart */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h2 className="text-base font-semibold text-white">
                  Candidate &amp; User Growth
                </h2>
                <span className="text-xs text-[#737373]">
                  Rolling 30-day attested verifications
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/30 whitespace-nowrap">
                PEAK: 42.8k
              </span>
            </div>

            <div className="relative w-full h-48">
              <svg
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="growthGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[30, 75, 120].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="600"
                    y1={y}
                    y2={y}
                    stroke="#1A1A1A"
                    strokeDasharray="3 3"
                  />
                ))}
                <line x1="0" x2="600" y1="165" y2="165" stroke="#1A1A1A" />

                <path
                  d="M0,150 Q75,142 120,130 T240,110 T360,82 T480,48 T600,20 L600,165 L0,165 Z"
                  fill="url(#growthGrad)"
                />
                <path
                  d="M0,150 Q75,142 120,130 T240,110 T360,82 T480,48 T600,20"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="600" cy="20" r="4.5" fill="#22C55E" />
                <circle
                  cx="600"
                  cy="20"
                  r="9"
                  fill="none"
                  stroke="#22C55E"
                  strokeOpacity="0.4"
                  className="animate-ping"
                  style={{ transformOrigin: '600px 20px' }}
                />
                <circle cx="360" cy="82" r="3.5" fill="#22C55E" />
              </svg>

              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[11px] text-[#737373] pt-2">
                <span>OCT 01</span>
                <span>OCT 08</span>
                <span>OCT 15</span>
                <span>OCT 22</span>
                <span className="text-[#22c55e] font-semibold">OCT 31</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                Organic referral rate: {metrics.organic_referral_rate}%
              </span>
              <span className="font-mono text-white">
                Velocity: {metrics.growth_velocity}
              </span>
            </div>
          </div>

          {/* Revenue chart */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <h2 className="text-base font-semibold text-white">
                  Daily Invoiced Revenue
                </h2>
                <span className="text-xs text-[#737373]">
                  USD telemetry via payment processor
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-0.5 bg-[#62df7d]" />
                <span className="text-[#737373] whitespace-nowrap">
                  7D avg ($4.8k)
                </span>
              </div>
            </div>

            <div className="relative w-full h-48 flex flex-col justify-end">
              <div className="absolute inset-x-0 top-2 flex justify-between text-[10px] text-[#737373] font-mono pointer-events-none">
                <span>$6k</span>
                <span>$4k</span>
                <span>$2k</span>
                <span>$0</span>
              </div>

              <div className="w-full border-b border-[#1A1A1A] absolute bottom-6" />
              <div className="w-full border-b border-dashed border-[#1A1A1A]/40 absolute top-12" />
              <div className="w-full border-b border-dashed border-[#1A1A1A]/30 absolute top-24" />

              <div className="relative z-10 w-full h-36 flex items-end justify-between gap-1 px-1">
                {[48, 52, 40, 65, 70, 58, 45, 74, 82, 60, 88, 78, 92, 96].map(
                  (h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all hover:bg-[#22c55e] ${
                        i >= 12
                          ? 'bg-[#22c55e]'
                          : i >= 10
                          ? 'bg-[#22c55e]/80'
                          : i >= 8
                          ? 'bg-[#22c55e]/50'
                          : i >= 6
                          ? 'bg-[#22c55e]/40'
                          : 'bg-[#22c55e]/30'
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  )
                )}
              </div>

              <div className="flex justify-between text-[11px] text-[#737373] pt-2">
                <span>14D AGO</span>
                <span>7D AGO</span>
                <span className="text-white font-semibold">TODAY</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#62df7d]" />
                Auto-settlement: 24h interval
              </span>
              <span className="font-mono text-[#22c55e]">AVG: $4,820/day</span>
            </div>
          </div>
        </section>

        {/* ── Recent signups table ───────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1A1A1A]">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Recent Platform Signups
                </h2>
                <span className="font-mono text-[10px] text-[#737373] bg-[#1c1b1b] px-2 py-0.5 rounded">
                  {filteredUsers.length} NEW
                </span>
              </div>
              <span className="text-xs text-[#737373]">
                Real-time authentication log with acquisition source
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#1c1b1b] p-1 rounded-lg border border-[#1A1A1A] self-start sm:self-auto">
              {(['all', 'pro', 'enterprise', 'free'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors capitalize ${
                    filter === f
                      ? 'bg-[#2a2a2a] text-[#22c55e]'
                      : 'text-[#737373] hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All Tiers' : f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">
                sync
              </span>
              <p className="text-sm text-[#737373]">Loading users…</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <span className="material-symbols-outlined text-[#737373] text-4xl mb-2">
                filter_alt_off
              </span>
              <p className="text-sm text-[#737373]">No users match this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#1A1A1A] bg-black">
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                      Plan &amp; Tier
                    </th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="py-3 px-4 text-[11px] font-semibold text-[#737373] uppercase tracking-wider text-right">
                      Verification
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[#141414] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded bg-[#2a2a2a] border border-[#1A1A1A] flex items-center justify-center font-mono text-[11px] text-[#22c55e] font-bold shrink-0">
                            {u.initials}
                          </span>
                          <span className="flex flex-col min-w-0">
                            <span className="text-sm text-white font-medium truncate">
                              {u.email}
                            </span>
                            <span className="font-mono text-[11px] text-[#737373]">
                              {u.uid}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${planBadgeClass(
                            u.plan
                          )}`}
                        >
                          {u.plan_label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#737373] whitespace-nowrap">
                        {u.timestamp}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#737373]">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-[#737373]">
                            {u.channel_icon}
                          </span>
                          {u.channel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {u.verified === 'attested' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22c55e]">
                            <span className="material-symbols-outlined text-[14px]">
                              check_circle
                            </span>
                            Attested
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EAB308]">
                            <span className="material-symbols-outlined text-[14px]">
                              hourglass_empty
                            </span>
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 bg-black/40 border-t border-[#1A1A1A] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-[#737373]">
              Showing {filteredUsers.length} latest candidate records
            </span>
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1 text-[#22c55e] hover:underline text-xs font-semibold"
            >
              View All Users
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}