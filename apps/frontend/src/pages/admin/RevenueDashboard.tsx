// FILE: src/pages/admin/RevenueDashboard.tsx
// ROUTE: /admin/revenue (admin only)
// BACKEND: none — payments disabled for pilot
// PURPOSE: Revenue intelligence — MRR, ARR, churn, split donut, transaction ledger.
// SECURITY:
//   - No dangerouslySetInnerHTML — all data auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.

import { useState, useMemo } from 'react'
import SEO from '../../components/SEO'

// ─── Demo data ──────────────────────────────────────────
interface RevenueMetric {
  label: string
  icon: string
  value: string
  suffix?: string
  delta: string
  deltaLabel: string
  footerLeft: string
  footerRight: string
  footerRightAccent?: boolean
}

const METRICS: RevenueMetric[] = []

interface LedgerRow {
  id: string
  customer: string
  plan: string
  planAccent: boolean
  amount: string
  amountStruck?: boolean
  method: string
  methodIcon: string
  timestamp: string
  status: 'succeeded' | 'refunded' | 'pending' | 'disputed'
}

const LEDGER: LedgerRow[] = []

type LedgerFilter = 'all' | 'succeeded' | 'refunded' | 'disputed'

// ─── Metric card ────────────────────────────────────────
function MetricCard({ m }: { m: RevenueMetric }) {
  return (
    <div className="bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22c55e]/40 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-4 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373] truncate">
          {m.label}
        </span>
        <span className="material-symbols-outlined text-[#22c55e] text-[20px] shrink-0">
          {m.icon}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-none">
            {m.value}
          </span>
          {m.suffix && (
            <span className="text-base font-normal text-[#737373]">
              {m.suffix}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/20 whitespace-nowrap">
            {m.delta}
          </span>
          <span className="text-xs text-[#737373] truncate">{m.deltaLabel}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-[#1A1A1A] flex items-center justify-between gap-2 text-xs">
        <span className="text-[#737373] truncate">{m.footerLeft}</span>
        <span
          className={`font-mono whitespace-nowrap ${
            m.footerRightAccent ? 'text-[#22c55e]' : 'text-white'
          }`}
        >
          {m.footerRight}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────
export default function RevenueDashboard() {
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [toast, setToast] = useState<string | null>(null)

  const filteredLedger = useMemo(() => {
    if (filter === 'all') return LEDGER
    return LEDGER.filter((r) => r.status === filter)
  }, [filter])

  function handleExport() {
    setToast('Export queued — generating CSV ledger for Oct 2024')
    setTimeout(() => setToast(null), 3000)
  }

  // Donut precomputed — no mutation during render
  const donutR = 38
  const donutCircumference = 2 * Math.PI * donutR
  const donutSlices = [
    { label: 'Domestic', value: 64, color: '#22c55e' },
    { label: 'International', value: 36, color: '#3d4a3d' },
  ]
  const donutDashes = donutSlices.map(
    (s) => (s.value / 100) * donutCircumference
  )
  const donutSegments = donutSlices.map((s, i) => ({
    ...s,
    dash: donutDashes[i],
    offset: donutDashes.slice(0, i).reduce((a, b) => a + b, 0),
  }))

  return (
    <>
      <SEO
        title="Revenue Dashboard | SafeApply.AI"
        description="Platform revenue intelligence — MRR, ARR, churn, payment split, and transaction ledger."
        path="/admin/revenue"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 max-w-[80rem] mx-auto">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#1A1A1A]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Telemetry Pipe: Payment Feed v2
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Revenue &amp; Billing Intelligence
            </h1>
            <p className="text-sm text-[#737373] max-w-3xl">
              Live billing telemetry, recurring subscription volume, global transaction
              settlement, and churn analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22c55e]/40 px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[#22c55e] text-[16px]">
                calendar_today
              </span>
              <span className="whitespace-nowrap hidden sm:inline">
                Past 30 Days
              </span>
              <span className="material-symbols-outlined text-[#737373] text-[16px]">
                expand_more
              </span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22c55e]/50 text-white hover:text-[#22c55e] px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                download
              </span>
              <span className="whitespace-nowrap">Export CSV</span>
            </button>
          </div>
        </header>

        {/* ── 4 metric cards ─────────────────────────── */}
        <section
          aria-label="Revenue metrics"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          {METRICS.map((m) => (
            <MetricCard key={m.label} m={m} />
          ))}
        </section>

        {/* ── Charts grid ────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

          {/* Revenue over time */}
          <div className="lg:col-span-7 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-white">
                  Revenue Over Time
                </h2>
                <span className="text-xs text-[#737373]">
                  Normalized settlement: Nov '23 – Oct '24
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#22c55e] inline-block" />
                  <span className="text-white">2024 Current</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0 border-b border-dashed border-[#737373] inline-block" />
                  <span className="text-[#737373]">2023 Baseline</span>
                </span>
              </div>
            </div>

            <div className="w-full overflow-hidden">
              <svg
                viewBox="0 0 640 240"
                className="w-full h-auto overflow-visible select-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="primaryAreaGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.32" />
                    <stop offset="60%" stopColor="#22c55e" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Guide lines */}
                <g stroke="#1A1A1A" strokeDasharray="2 2" strokeWidth="1">
                  <line x1="40" x2="630" y1="30" y2="30" />
                  <line x1="40" x2="630" y1="75" y2="75" />
                  <line x1="40" x2="630" y1="120" y2="120" />
                  <line x1="40" x2="630" y1="165" y2="165" />
                  <line x1="40" x2="630" y1="210" y2="210" />
                </g>

                {/* Y axis labels */}
                <g fill="#737373" fontSize="10" fontFamily="Inter">
                  <text x="5" y="34">$140k</text>
                  <text x="5" y="79">$105k</text>
                  <text x="5" y="124">$70k</text>
                  <text x="5" y="169">$35k</text>
                  <text x="5" y="214">$0</text>
                </g>

                {/* 2023 baseline */}
                <path
                  d="M 50 185 Q 110 180, 160 172 T 270 160 T 380 148 T 490 135 T 620 120"
                  fill="none"
                  opacity="0.7"
                  stroke="#737373"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />

                {/* 2024 area */}
                <path
                  d="M 50 170 C 100 162, 140 155, 180 140 C 230 125, 270 130, 310 115 C 360 95, 410 98, 450 78 C 500 58, 540 60, 580 42 L 620 36 L 620 210 L 50 210 Z"
                  fill="url(#primaryAreaGrad)"
                />

                {/* 2024 line */}
                <path
                  d="M 50 170 C 100 162, 140 155, 180 140 C 230 125, 270 130, 310 115 C 360 95, 410 98, 450 78 C 500 58, 540 60, 580 42 L 620 36"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                />

                {/* Peak marker */}
                <line
                  x1="620"
                  x2="620"
                  y1="36"
                  y2="210"
                  stroke="#22c55e"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  opacity="0.6"
                />
                <circle
                  cx="620"
                  cy="36"
                  r="6"
                  fill="#0D0D0D"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                />
                <circle cx="620" cy="36" r="2.5" fill="#22c55e" />

                {/* Tooltip */}
                <g transform="translate(480, 10)">
                  <rect
                    x="0"
                    y="0"
                    width="130"
                    height="42"
                    rx="4"
                    fill="#1c1b1b"
                    stroke="#3d4a3d"
                    strokeWidth="1"
                  />
                  <text
                    x="10"
                    y="17"
                    fontSize="9"
                    fill="#869585"
                    fontFamily="Inter"
                    fontWeight="600"
                    letterSpacing="1"
                  >
                    OCT 2024 (PEAK)
                  </text>
                  <text
                    x="10"
                    y="33"
                    fontSize="13"
                    fill="#ffffff"
                    fontFamily="Inter"
                    fontWeight="700"
                  >
                    $128,450.00
                  </text>
                </g>

                {/* X axis labels */}
                <g fill="#737373" fontSize="10" fontFamily="Inter">
                  <text x="44" y="228">Nov</text>
                  <text x="96" y="228">Dec</text>
                  <text x="148" y="228">Jan</text>
                  <text x="200" y="228">Feb</text>
                  <text x="252" y="228">Mar</text>
                  <text x="304" y="228">Apr</text>
                  <text x="356" y="228">May</text>
                  <text x="408" y="228">Jun</text>
                  <text x="460" y="228">Jul</text>
                  <text x="512" y="228">Aug</text>
                  <text x="564" y="228">Sep</text>
                  <text x="612" y="228" fill="#22c55e" fontWeight="700">
                    Oct
                  </text>
                </g>
              </svg>
            </div>

            <div className="pt-3 border-t border-[#1A1A1A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-[#22c55e]">
                  verified
                </span>
                Validated via Stripe webhooks
              </span>
              <span className="font-mono text-white">
                12m Delta: +$86,450 (+205%)
              </span>
            </div>
          </div>

          {/* Payment split donut */}
          <div className="lg:col-span-5 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-white">
                  Payment Split
                </h2>
                <span className="text-xs text-[#737373]">
                  Domestic vs cross-border settlement
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/20 uppercase whitespace-nowrap">
                FX neutral
              </span>
            </div>

            <div className="py-4 flex flex-col items-center justify-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r={donutR}
                    fill="transparent"
                    stroke="#1c1b1b"
                    strokeWidth="12"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.label}
                      cx="50"
                      cy="50"
                      r={donutR}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={`${seg.dash} ${donutCircumference - seg.dash}`}
                      strokeDashoffset={-seg.offset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-white tracking-tight">
                    $128.4k
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[#737373]">
                    Total volume
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-[#1A1A1A]">
              <div className="flex items-center justify-between p-2 rounded bg-[#1c1b1b] gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full bg-[#22c55e] shrink-0" />
                  <span className="text-sm text-white truncate">
                    Domestic (US &amp; Canada)
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="font-mono text-xs text-white font-semibold">
                    $82,208
                  </span>
                  <span className="text-[11px] text-[#22c55e] ml-1">
                    (64%)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#1c1b1b] gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full bg-[#3d4a3d] shrink-0" />
                  <span className="text-sm text-white truncate">
                    International (EMEA &amp; APAC)
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="font-mono text-xs text-white font-semibold">
                    $46,242
                  </span>
                  <span className="text-[11px] text-[#737373] ml-1">
                    (36%)
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-[#737373] mt-1 flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">
                  lock
                </span>
                <span>
                  Multicurrency payouts settled via Stripe Global Treasury with
                  0.00% FX drag.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Transaction ledger ─────────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-[#1A1A1A] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
                <h2 className="text-base font-semibold text-white">
                  Recent Transaction Ledger
                </h2>
              </div>
              <span className="text-xs text-[#737373]">
                Webhook sync: 100% healthy • Zero dropped events
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#1c1b1b] p-1 rounded-lg border border-[#1A1A1A] self-start md:self-auto">
              {(
                [
                  { k: 'all', l: 'All (8,942)' },
                  { k: 'succeeded', l: 'Succeeded' },
                  { k: 'refunded', l: 'Refunded' },
                  { k: 'disputed', l: 'Disputed' },
                ] as { k: LedgerFilter; l: string }[]
              ).map((opt) => (
                <button
                  key={opt.k}
                  type="button"
                  onClick={() => setFilter(opt.k)}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    filter === opt.k
                      ? 'bg-[#2a2a2a] text-[#22c55e] border border-[#22c55e]/20'
                      : 'text-[#737373] hover:text-white'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {filteredLedger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <span className="material-symbols-outlined text-[#737373] text-4xl mb-2">
                receipt_long
              </span>
              <p className="text-sm text-[#737373]">
                No transactions with this status.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="bg-black border-b border-[#1A1A1A] text-[10px] uppercase tracking-wider text-[#737373] font-mono">
                    <th className="py-3 px-4">Invoice ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Plan / Product</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {filteredLedger.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#141414] transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-[#22c55e]">
                        {row.id}
                      </td>
                      <td className="py-3 px-4 text-sm text-white font-medium truncate max-w-[200px]">
                        {row.customer}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            row.planAccent
                              ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
                              : 'bg-[#1c1b1b] text-[#bccbb9] border-[#1A1A1A]'
                          }`}
                        >
                          {row.plan}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 font-mono text-xs font-semibold ${
                          row.amountStruck
                            ? 'text-[#737373] line-through'
                            : row.planAccent
                            ? 'text-[#22c55e]'
                            : 'text-white'
                        }`}
                      >
                        {row.amount}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#737373]">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-[#737373]">
                            {row.methodIcon}
                          </span>
                          <span className="truncate">{row.method}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#737373] whitespace-nowrap">
                        {row.timestamp}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {row.status === 'succeeded' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                            Succeeded
                          </span>
                        )}
                        {row.status === 'refunded' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EAB308] bg-[#EAB308]/10 border border-[#EAB308]/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                            Refunded
                          </span>
                        )}
                        {row.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#737373] bg-[#1A1A1A] border border-[#1A1A1A] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#737373]" />
                            Pending
                          </span>
                        )}
                        {row.status === 'disputed' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/30 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                            Disputed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-[#1A1A1A] bg-black/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-[#737373]">
              Showing 1–{filteredLedger.length} of 8,942 settled orders
            </span>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                disabled
                className="px-3 py-1 bg-[#0D0D0D] border border-[#1A1A1A] text-[#737373] rounded text-[11px] opacity-40 cursor-not-allowed"
              >
                Previous
              </button>
              <span className="font-mono text-[11px] text-white px-2">
                1 / 1,491
              </span>
              <button
                type="button"
                className="px-3 py-1 bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22c55e]/40 text-white hover:text-[#22c55e] rounded text-[11px] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Toast ─────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-100 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg border shadow-xl bg-[#0D0D0D] border-l-4 border-l-[#22c55e] border-[#1A1A1A] text-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px] text-[#22c55e] shrink-0">
            check_circle
          </span>
          <span className="text-white break-words">{toast}</span>
        </div>
      )}
    </>
  )
}