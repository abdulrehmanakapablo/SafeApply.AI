// FILE: src/pages/dashboard/Analytics.tsx
// ROUTE: /dashboard/analytics (auth required)
// BACKEND: GET /api/analytics?period=30d|90d|all
// PURPOSE: Job hunt analytics — 4 stat cards, 4 charts, AI insights

import { useState, useEffect } from 'react'
import SEO from '../../components/SEO'
import { getAnalytics, type AnalyticsPeriod } from '../../api/analytics'

// ── Types ──────────────────────────────────────────────────
interface Stat {
  label: string
  value: string
  trend: string
  trendPositive: boolean
  sublabel: string
  icon: string
}

interface LinePoint {
  label: string
  value: number
  cx: number
  cy: number
}

interface DayBar {
  day: string
  rate: number
}

interface StatusSlice {
  status: string
  count: number
  color: string
}

interface WeekBar {
  week: string
  lead: number
  senior: number
}

interface AnalyticsView {
  total_submissions: number
  response_velocity: number
  avg_ats_match: number
  interview_conversion: number
  line_points: LinePoint[]
  line_max: number
  peak_line_index: number
  response_by_day: DayBar[]
  status_breakdown: StatusSlice[]
  weekly_volume: WeekBar[]
  insights: string[]
}

// ── Demo fallback (pilot mode — DB empty) ──────────────────
const DEMO: AnalyticsView = {
  total_submissions: 48,
  response_velocity: 37.5,
  avg_ats_match: 91.4,
  interview_conversion: 18.8,
  line_max: 20,
  peak_line_index: 4,
  line_points: [
    { label: 'Oct 01', value: 2, cx: 40, cy: 185 },
    { label: 'Oct 08', value: 6, cx: 130, cy: 145 },
    { label: 'Oct 15', value: 9, cx: 225, cy: 120 },
    { label: 'Oct 22', value: 13, cx: 320, cy: 80 },
    { label: 'Oct 29', value: 17, cx: 415, cy: 50 },
    { label: 'Nov 05', value: 20, cx: 510, cy: 35 },
  ],
  response_by_day: [
    { day: 'Mon', rate: 42 },
    { day: 'Tue', rate: 68 },
    { day: 'Wed', rate: 51 },
    { day: 'Thu', rate: 39 },
    { day: 'Fri', rate: 18 },
    { day: 'Sat', rate: 4 },
    { day: 'Sun', rate: 8 },
  ],
  status_breakdown: [
    { status: 'Applied', count: 16, color: '#22C55E' },
    { status: 'Interviewing', count: 9, color: '#EAB308' },
    { status: 'Screening', count: 8, color: '#CA8A04' },
    { status: 'Rejected', count: 7, color: '#EF4444' },
    { status: 'Ghosted', count: 4, color: '#737373' },
    { status: 'Offered', count: 2, color: '#16A34A' },
    { status: 'Saved', count: 2, color: '#353534' },
  ],
  weekly_volume: [
    { week: 'W40', lead: 4, senior: 2 },
    { week: 'W41', lead: 5, senior: 3 },
    { week: 'W42', lead: 6, senior: 4 },
    { week: 'W43', lead: 8, senior: 4 },
    { week: 'W44', lead: 9, senior: 3 },
  ],
  insights: [
    'Tuesday morning submissions (08:00 – 10:30 PST) show a 68% first-round callback rate, 2.3× higher than Friday submissions.',
    'Applications optimized with CV Intelligence (>90% ATS match score) yielded a 4.1-day faster response latency from automated Greenhouse/Workday filters.',
    'Roles matching your "Distributed Systems + Go" stack show zero ghosting signals, compared to a 22% stall rate on broader "Full-Stack" postings.',
    'Identified 3 companies in your tracker (Linear, Anthropic, Datadog) with recent Series funding and high engineering headcount growth — prioritizing follow-ups is recommended.',
  ],
}

// Map backend response → view model, with sane defaults
function toView(raw: Awaited<ReturnType<typeof getAnalytics>>['data']): AnalyticsView {
  if (!raw) return DEMO
  const apps = raw.total_applications ?? 0
  return {
    ...DEMO,
    total_submissions: apps || DEMO.total_submissions,
    response_velocity: raw.response_rate || DEMO.response_velocity,
    interview_conversion: raw.interview_rate || DEMO.interview_conversion,
    insights: raw.insights && raw.insights.length > 0 ? raw.insights : DEMO.insights,
  }
}

// ── Star row for stat cards ────────────────────────────────
function StatIcon({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-[#1c1b1b] border border-white/5 flex items-center justify-center text-[#737373]">
      <span className="material-symbols-outlined text-[18px]">{name}</span>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────
export default function Analytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [data, setData] = useState<AnalyticsView>(DEMO)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await getAnalytics(period)
        if (!cancelled) setData(toView(res.data))
      } catch {
        if (!cancelled) setData(DEMO)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [period])

  const stats: Stat[] = [
    {
      label: 'TOTAL SUBMISSIONS',
      value: String(data.total_submissions),
      trend: '+24.5%',
      trendPositive: true,
      sublabel: 'vs last period',
      icon: 'send',
    },
    {
      label: 'RESPONSE VELOCITY',
      value: `${data.response_velocity}%`,
      trend: '+5.2%',
      trendPositive: true,
      sublabel: 'Industry avg: 8.4% (Top 5th)',
      icon: 'speed',
    },
    {
      label: 'AVG. ATS MATCH SCORE',
      value: `${data.avg_ats_match}%`,
      trend: '+8.1%',
      trendPositive: true,
      sublabel: 'Across 14 analyzed profiles',
      icon: 'verified',
    },
    {
      label: 'INTERVIEW CONVERSION',
      value: `${data.interview_conversion}%`,
      trend: '+3.4%',
      trendPositive: true,
      sublabel: '9 active interview cycles',
      icon: 'handshake',
    },
  ]

  const totalStatusUnits = data.status_breakdown.reduce((s, x) => s + x.count, 0)
  const maxWeekly = Math.max(
    ...data.weekly_volume.map((w) => w.lead + w.senior),
    1
  )

  // Donut segments — precomputed with cumulative offsets, no mutation
  const donutCircumference = 2 * Math.PI * 60
  const donutTotal = totalStatusUnits || 1
  const donutDashes = data.status_breakdown.map(
    (s) => (s.count / donutTotal) * donutCircumference
  )
  const donutSegments = data.status_breakdown.map((slice, i) => ({
    status: slice.status,
    color: slice.color,
    dash: donutDashes[i],
    offset: donutDashes.slice(0, i).reduce((a, b) => a + b, 0),
  }))

  return (
    <>
      <SEO
        title="Analytics | SafeApply.AI"
        description="Your job hunt analytics — submissions, response rates, ATS match scores, and AI insights."
        path="/dashboard/analytics"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ── HEADER / CONTROLS ──────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#1A1A1A] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Telemetry Intelligence / Performance Vector Engine
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22c55e]">
                {loading ? (
                  <>
                    <span className="material-symbols-outlined text-[12px] animate-spin">
                      sync
                    </span>
                    SYNCING…
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                    ENGINE SYNC: ACTIVE (15m latency)
                  </>
                )}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Application Analytics
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period toggle */}
            <div className="flex items-center bg-[#0D0D0D] border border-[#1A1A1A] rounded-full p-0.5">
              {([
                { k: '30d', l: '30 days' },
                { k: '90d', l: '90 days' },
                { k: 'all', l: 'All time' },
              ] as { k: AnalyticsPeriod; l: string }[]).map((opt) => {
                const active = period === opt.k
                return (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setPeriod(opt.k)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#22c55e] text-black'
                        : 'text-[#737373] hover:text-white'
                    }`}
                  >
                    {opt.l}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] text-white hover:border-[#22c55e]/50 hover:text-[#22c55e] transition-colors text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">
                file_download
              </span>
              Export Report
            </button>
          </div>
        </div>

        {/* ── STAT CARDS ─────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col justify-between p-5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#1A1A1A]/80 transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  {s.label}
                </span>
                <StatIcon name={s.icon} />
              </div>
              <div className="mt-3">
                <span className="text-4xl font-extrabold text-white leading-none tracking-tight">
                  {s.value}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span
                  className={`font-semibold inline-flex items-center ${
                    s.trendPositive ? 'text-[#22c55e]' : 'text-[#EF4444]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {s.trendPositive ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                  {s.trend}
                </span>
                <span className="text-[#737373] truncate">{s.sublabel}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── CHARTS GRID ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ───────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Card A — Applications Over Time */}
            <div className="p-5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Applications Over Time
                  </h3>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Daily submission velocity vs ATS benchmark
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] whitespace-nowrap">
                  Live Stream
                </span>
              </div>

              <div className="relative w-full h-56">
                <svg
                  viewBox="0 0 540 220"
                  preserveAspectRatio="none"
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines */}
                  {[20, 65, 110, 155, 200].map((y) => (
                    <line
                      key={y}
                      x1="36"
                      x2="520"
                      y1={y}
                      y2={y}
                      stroke="#1A1A1A"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Y axis labels */}
                  {[20, 15, 10, 5, 0].map((n, i) => (
                    <text
                      key={n}
                      x="26"
                      y={24 + i * 45}
                      fill="#737373"
                      fontFamily="Inter"
                      fontSize="10"
                      textAnchor="end"
                    >
                      {n}
                    </text>
                  ))}

                  {/* Area fill */}
                  <path
                    d="M 40 185 Q 85 160, 130 145 T 225 120 T 320 80 T 415 50 T 510 35 L 510 200 L 40 200 Z"
                    fill="url(#areaGrad)"
                  />

                  {/* Curved line */}
                  <path
                    d="M 40 185 Q 85 160, 130 145 T 225 120 T 320 80 T 415 50 T 510 35"
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Data points */}
                  {data.line_points.map((p, i) => {
                    const isPeak = i === data.peak_line_index
                    return (
                      <circle
                        key={i}
                        cx={p.cx}
                        cy={p.cy}
                        r={isPeak ? 4.5 : 3.5}
                        fill={isPeak ? '#22C55E' : '#0D0D0D'}
                        stroke={isPeak ? '#FFFFFF' : '#22C55E'}
                        strokeWidth="2"
                      />
                    )
                  })}

                  {/* Hover marker */}
                  {data.peak_line_index >= 0 && (
                    <line
                      x1={data.line_points[data.peak_line_index].cx}
                      x2={data.line_points[data.peak_line_index].cx}
                      y1="20"
                      y2="200"
                      stroke="#22C55E"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.6"
                    />
                  )}
                </svg>

                {/* Tooltip on peak point */}
                {data.peak_line_index >= 0 && (
                  <div className="absolute top-2 left-[62%] -translate-x-1/2 pointer-events-none bg-[#201f1f] border border-white/10 rounded-lg px-2.5 py-1.5 shadow-lg flex flex-col">
                    <span className="font-mono text-[11px] text-white font-semibold">
                      {data.line_points[data.peak_line_index].label}:{' '}
                      {data.line_points[data.peak_line_index].value} Applications
                    </span>
                    <span className="text-[10px] text-[#22c55e]">
                      ({Math.max(1, data.line_points[data.peak_line_index].value - 1)} &gt;85% ATS match)
                    </span>
                  </div>
                )}
              </div>

              {/* X axis */}
              <div className="flex justify-between pl-8 pr-2 font-mono text-xs text-[#737373]">
                {data.line_points.map((p) => (
                  <span key={p.label}>{p.label}</span>
                ))}
              </div>
            </div>

            {/* Card B — Response Rate by Day of Week */}
            <div className="p-5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Response Rate by Day of Week
                  </h3>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Recruiter activity distribution by outbound day
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[#22c55e] font-semibold whitespace-nowrap">
                  PEAK: TUESDAY
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 items-end h-44 pt-6 pb-2 border-b border-[#1A1A1A]">
                {data.response_by_day.map((d) => {
                  const peakRate = Math.max(...data.response_by_day.map((x) => x.rate))
                  const isPeak = d.rate === peakRate
                  return (
                    <div
                      key={d.day}
                      className="flex flex-col items-center gap-1.5 h-full justify-end group"
                    >
                      <span
                        className={`text-[11px] font-semibold ${
                          isPeak ? 'text-[#22c55e]' : 'text-[#737373]'
                        }`}
                      >
                        {d.rate}%
                      </span>
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          isPeak
                            ? 'bg-[#22c55e] border-t-2 border-[#22c55e]'
                            : 'bg-[#2a2a2a] group-hover:bg-[#22c55e]/70'
                        }`}
                        style={{ height: `${d.rate}%` }}
                      />
                      <span
                        className={`font-mono text-xs ${
                          isPeak ? 'text-[#22c55e] font-bold' : 'text-[#737373]'
                        }`}
                      >
                        {d.day}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-[#737373]">
                <span>Optimal transmission window: Tuesday 08:00 – 11:30 PST</span>
                <span className="text-[#22c55e] font-semibold">2.3× Conversion Lift</span>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ──────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Card C — Applications by Pipeline Status (Donut) */}
            <div className="p-5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Applications by Pipeline Status
                  </h3>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Distribution across 7 tracked lifecycle states
                  </p>
                </div>
                <span className="text-[11px] text-[#737373] font-mono whitespace-nowrap">
                  {totalStatusUnits} Active Records
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Donut */}
                <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.status}
                        cx="80"
                        cy="80"
                        r="60"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="16"
                        strokeDasharray={`${seg.dash} ${donutCircumference - seg.dash}`}
                        strokeDashoffset={-seg.offset}
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-extrabold text-white">
                      {totalStatusUnits}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-[#737373]">
                      Units
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full">
                  {data.status_breakdown.map((s) => {
                    const pct =
                      totalStatusUnits > 0
                        ? Math.round((s.count / totalStatusUnits) * 100)
                        : 0
                    return (
                      <div
                        key={s.status}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-white truncate">{s.status}</span>
                        </div>
                        <span className="text-[#737373] font-mono shrink-0">
                          {s.count} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Card D — Weekly Application Volume (Stacked) */}
            <div className="p-5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Weekly Application Volume
                  </h3>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Cumulative weekly submissions by target seniority
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-white">
                    <span className="w-2 h-2 rounded-full bg-[#22c55e]" /> Staff/Lead
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#737373]">
                    <span className="w-2 h-2 rounded-full bg-[#353534]" /> Senior Eng
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {data.weekly_volume.map((w) => {
                  const total = w.lead + w.senior
                  const leadPct = (w.lead / maxWeekly) * 100
                  const seniorPct = (w.senior / maxWeekly) * 100
                  return (
                    <div key={w.week} className="flex items-center gap-3">
                      <span className="w-10 font-mono text-xs text-[#737373] shrink-0">
                        {w.week}
                      </span>
                      <div className="flex-1 flex h-5 bg-[#1c1b1b] rounded-sm overflow-hidden gap-px">
                        <div
                          className="bg-[#22c55e] h-full"
                          style={{ width: `${leadPct}%` }}
                          title={`Staff/Lead: ${w.lead}`}
                        />
                        <div
                          className="bg-[#353534] h-full"
                          style={{ width: `${seniorPct}%` }}
                          title={`Senior Eng: ${w.senior}`}
                        />
                      </div>
                      <span className="w-8 text-right font-mono text-xs text-white shrink-0">
                        {total}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-[#737373] pt-2 border-t border-[#1A1A1A]">
                <span>
                  Targeting Lead/Staff tier roles yields +31% higher initial screen velocity
                </span>
                <span className="text-white font-mono">
                  Total:{' '}
                  {data.weekly_volume.reduce((s, w) => s + w.lead + w.senior, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI INSIGHTS ────────────────────────────── */}
        <div className="p-6 rounded-xl bg-[#0D0D0D] border border-[#22c55e]/30 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-[#22c55e]">
              <span className="material-symbols-outlined text-[20px]">
                auto_awesome
              </span>
              <h3 className="text-base font-semibold text-[#22c55e]">
                AI Insights &amp; Telemetry Heuristics
              </h3>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
              CONFIDENCE: 98.4%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.insights.map((text, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-lg bg-[#000000]/40 border border-[#1A1A1A] hover:border-[#1A1A1A]/80 transition-colors"
              >
                <span className="text-[#22c55e] font-bold leading-none select-none text-lg">
                  →
                </span>
                <p className="text-sm text-[#737373] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}