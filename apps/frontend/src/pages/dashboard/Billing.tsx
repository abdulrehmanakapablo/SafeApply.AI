// FILE: src/pages/dashboard/Billing.tsx
// ROUTE: /dashboard/billing (auth required)
// BACKEND: none — payments disabled for pilot
// PURPOSE: Subscription overview, plan tiers, payment methods, invoice history.
//          Upgrade actions show a "coming soon" modal until payments ship.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { useAuthStore } from '../../store/authStore'

type CycleKey = 'monthly' | 'annual'

interface Tier {
  id: 'free' | 'pro' | 'enterprise'
  tierId: string
  name: string
  tagline: string
  badge: { label: string; className: string }
  monthlyPrice: number
  annualPrice: number
  annualLabel: string
  ctaLabel: string
  ctaStyle: 'disabled' | 'primary' | 'secondary'
  features: { text: string; included: boolean; strong?: boolean }[]
}

interface QuotaGauge {
  label: string
  used: number
  total: number
  barColor: string
  remainingLabel: (n: number) => string
  statusColor: 'primary' | 'warning'
  statusLabel: (pct: number) => string
}

interface Invoice {
  id: string
  date: string
  amount: string
  status: 'PAID' | 'PENDING' | 'FAILED'
}

// ─── Static config ────────────────────────────────────────
const TIERS: Tier[] = [
  {
    id: 'free',
    tierId: '001',
    name: 'Free Operator',
    tagline: 'Essential tooling for targeted and measured job hunting.',
    badge: { label: 'DEFAULT', className: 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]' },
    monthlyPrice: 0,
    annualPrice: 0,
    annualLabel: 'Permanent evaluation access',
    ctaLabel: 'Active Tier',
    ctaStyle: 'disabled',
    features: [
      { text: '20 ATS resume scans / month', included: true },
      { text: '10 active tracked job applications', included: true },
      { text: 'Basic CV export (Standard PDF)', included: true },
      { text: 'Standard telemetry delay (15-min queue)', included: false },
      { text: 'Recruiter callback heuristics', included: false },
    ],
  },
  {
    id: 'pro',
    tierId: '002-PRO',
    name: 'Pro Candidate',
    tagline: 'For active engineers targeting Tier-1 tech firms and fast offers.',
    badge: { label: 'NEURAL MATCH', className: 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30' },
    monthlyPrice: 29,
    annualPrice: 23,
    annualLabel: 'Billed annually ($276/yr — save 20%)',
    ctaLabel: 'Upgrade to Pro',
    ctaStyle: 'primary',
    features: [
      { text: 'Unlimited ATS neural resume scans', included: true, strong: true },
      { text: 'Unlimited active pipeline slots', included: true, strong: true },
      { text: 'Full Company Intelligence Dossiers', included: true },
      { text: 'Real-time recruiter callback heuristics', included: true },
      { text: 'Automated Greenhouse/Workday tailored CVs', included: true },
      { text: 'Priority sub-second GPU inference', included: true, strong: true },
    ],
  },
  {
    id: 'enterprise',
    tierId: '003-ENT',
    name: 'Enterprise / Executive',
    tagline: 'Dedicated 1-on-1 career telemetry & interview simulation architecture.',
    badge: { label: 'DEDICATED', className: 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]' },
    monthlyPrice: 79,
    annualPrice: 63,
    annualLabel: 'Full concierge advisory pipeline',
    ctaLabel: 'Contact Partner Sales',
    ctaStyle: 'secondary',
    features: [
      { text: 'Everything in Pro Candidate', included: true, strong: true },
      { text: 'Dedicated career agent sync', included: true },
      { text: 'Custom compensation benchmark models', included: true },
      { text: 'Mock system architecture transcripts', included: true },
      { text: 'Direct human recruiter review', included: true },
    ],
  },
]

const QUOTAS: QuotaGauge[] = [
  {
    label: 'AI ATS Analyses',
    used: 0,
    total: 20,
    barColor: 'bg-[#22c55e]',
    remainingLabel: (n) => `${n} remaining`,
    statusColor: 'primary',
    statusLabel: (pct) => `${pct}% consumed`,
  },
  {
    label: 'Active Tracked Apps',
    used: 0,
    total: 10,
    barColor: 'bg-[#EAB308]',
    remainingLabel: (n) => `${n} slots left`,
    statusColor: 'warning',
    statusLabel: (pct) => `${pct}% limit threshold`,
  },
  {
    label: 'Intelligence Audits',
    used: 0,
    total: 3,
    barColor: 'bg-[#22c55e]',
    remainingLabel: (n) => `${n} report${n === 1 ? '' : 's'} left`,
    statusColor: 'primary',
    statusLabel: (pct) => `${pct}% consumed`,
  },
]

const INVOICES: Invoice[] = []

// ─── Small building blocks ────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#737373] font-mono">
      {children}
    </div>
  )
}

function StatusPill({
  status,
}: {
  status: Invoice['status']
}) {
  const cls =
    status === 'PAID'
      ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
      : status === 'PENDING'
      ? 'bg-[#EAB308]/10 border-[#EAB308]/30 text-[#EAB308]'
      : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${cls}`}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {status}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────
export default function Billing() {
  const user = useAuthStore((s) => s.user)
  const [cycle, setCycle] = useState<CycleKey>('monthly')
  const [comingSoonOpen, setComingSoonOpen] = useState(false)
  const [pauseModalOpen, setPauseModalOpen] = useState(false)

  const isPro = user?.plan === 'pro' || user?.plan === 'lifetime'
  const currentTierName = isPro
    ? user?.plan === 'lifetime'
      ? 'LIFETIME'
      : 'PRO CANDIDATE'
    : 'FREE OPERATOR TIER'

    const customerId = user?.id ? `cus_${user.id.slice(0, 8)}` : 'cus_0000_guest'

  return (
    <>
      <SEO
        title="Billing | SafeApply.AI"
        description="Manage your SafeApply.AI subscription, payment methods, and invoices."
        path="/dashboard/billing"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-6 flex flex-col gap-8 pb-16">

        {/* ── Header ──────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-[#737373] font-semibold">
                Financial Telemetry / Subscription Infrastructure
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#0D0D0D] border border-[#1A1A1A] px-3 py-1 rounded text-[11px] font-mono text-[#737373]">
              <span className="material-symbols-outlined text-[#22c55e] text-[14px]">
                lock
              </span>
              <span>STRIPE GATEWAY: PENDING ACTIVATION</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Subscription &amp; Billing
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="font-mono text-xs text-[#737373] uppercase tracking-wider">
                  Customer_ID:
                </span>
                <span className="font-mono text-xs text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded">
                  {customerId}
                </span>
                <span className="text-[#353534]">•</span>
                <span className="font-mono text-xs text-[#737373]">
                  Workspace_Node: us-east-neural
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setComingSoonOpen(true)}
              className="group flex items-center gap-2 px-4 h-10 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] text-white hover:text-[#22c55e] hover:border-[#22c55e]/50 transition-colors text-sm font-medium self-start"
            >
              <span>Manage via Stripe Portal</span>
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                north_east
              </span>
            </button>
          </div>
        </section>

        {/* ── Current Plan Card ──────────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#22c55e]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1A1A1A] pb-5 mb-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] flex items-center justify-center text-[#22c55e] shrink-0">
                <span className="material-symbols-outlined text-[24px]">
                  terminal
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-[#2a2a2a] border border-[#1A1A1A] text-white font-semibold tracking-wider uppercase">
                    {currentTierName}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-[#22c55e] bg-[#22c55e]/10">
                    ACTIVE_CYCLE
                  </span>
                </div>
                <p className="text-xs text-[#737373] mt-1">
                  Quota auto-refreshes in{' '}
                  <span className="text-white font-medium">18 days</span>{' '}
                  (Nov 24, 2024, 00:00 UTC)
                </p>
              </div>
            </div>

            {/* Cycle toggle */}
            <div className="flex items-center gap-2 bg-[#2a2a2a]/60 p-1 rounded-lg border border-[#1A1A1A] self-start lg:self-auto">
              <span className="text-[11px] text-[#737373] px-2">CYCLE:</span>
              <button
                type="button"
                onClick={() => setCycle('monthly')}
                className={`text-xs px-3 py-1 rounded-md transition-all ${
                  cycle === 'monthly'
                    ? 'bg-[#000000] text-white border border-[#1A1A1A]'
                    : 'text-[#737373] hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCycle('annual')}
                className={`text-xs px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  cycle === 'annual'
                    ? 'bg-[#000000] text-white border border-[#1A1A1A]'
                    : 'text-[#737373] hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] font-mono text-[#22c55e] bg-[#22c55e]/20 px-1.5 py-0.5 rounded uppercase">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Quota gauges */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4">
            {QUOTAS.map((q) => {
              const pct = Math.round((q.used / q.total) * 100)
              const remaining = q.total - q.used
              const remainingClass =
                q.statusColor === 'warning' ? 'text-[#EAB308]' : 'text-[#22c55e]'
              const statusClass =
                q.statusColor === 'warning' ? 'text-[#EAB308]' : 'text-[#737373]'

              return (
                <div
                  key={q.label}
                  className="bg-[#1c1b1b] border border-[#1A1A1A] rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[#737373]">
                      {q.label}
                    </span>
                    <span className="font-mono text-xs text-white">
                      {q.used}{' '}
                      <span className="text-[#737373]">/ {q.total}</span>
                    </span>
                  </div>
                  <div className="w-full bg-[#2a2a2a] h-2 rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-500 ${q.barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={statusClass}>{q.statusLabel(pct)}</span>
                    <span className={`font-mono ${remainingClass}`}>
                      {q.remainingLabel(remaining)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Upgrade banner */}
          {!isPro && (
            <div className="relative mt-5 p-4 rounded-lg bg-[#000000] border border-[#22c55e]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">
                    bolt
                  </span>
                </div>
                <div>
                  <p className="text-sm text-white font-semibold">
                    Scale pipeline capacity with neural precision
                  </p>
                  <p className="text-xs text-[#737373] mt-0.5">
                    Unlock unmetered ATS simulations, sub-second telemetry, and direct
                    recruiter pipeline heuristics.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setComingSoonOpen(true)}
                className="w-full sm:w-auto shrink-0 bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors"
              >
                Upgrade to Pro Matrix →
              </button>
            </div>
          )}
        </section>

        {/* ── Plan Tiers Grid ────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <SectionLabel>
              <span className="font-mono">01 // TIER MATRIX</span>
              <span>—</span>
              <span>DEPLOYMENT PLANS</span>
            </SectionLabel>
            <h2 className="text-xl font-semibold text-white">
              Compute &amp; Intelligence Tiers
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            {TIERS.map((t) => {
              const price = cycle === 'annual' ? t.annualPrice : t.monthlyPrice
              const isHighlighted = t.id === 'pro'

              return (
                <div
                  key={t.id}
                  className={`relative rounded-xl p-6 flex flex-col justify-between ${
                    isHighlighted
                      ? 'bg-[#1c1b1b] border-2 border-[#22c55e]/80 shadow-lg'
                      : 'bg-[#0D0D0D] border border-[#1A1A1A]'
                  }`}
                >
                  {isHighlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#22c55e] text-black text-[11px] font-mono uppercase tracking-wider font-bold whitespace-nowrap">
                      Recommended // Optimal
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-[11px] uppercase ${
                          isHighlighted ? 'text-[#22c55e]' : 'text-[#737373]'
                        }`}
                      >
                        TIER_ID: {t.tierId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${t.badge.className}`}
                      >
                        {t.badge.label}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {t.name}
                      </h3>
                      <p className="text-xs text-[#737373] mt-1">
                        {t.tagline}
                      </p>
                    </div>

                    <div
                      className={`py-3 border-y ${
                        isHighlighted ? 'border-[#1A1A1A]' : 'border-[#1A1A1A]/60'
                      }`}
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">
                          ${price}
                        </span>
                        <span className="text-xs text-[#737373]">/ month</span>
                      </div>
                      <span
                        className={`font-mono text-[11px] mt-1 block ${
                          isHighlighted ? 'text-[#22c55e]' : 'text-[#737373]'
                        }`}
                      >
                        {cycle === 'annual' && t.id !== 'free'
                          ? t.annualLabel
                          : t.id === 'free'
                          ? t.annualLabel
                          : 'Billed monthly'}
                      </span>
                    </div>

                    <ul className="space-y-2 text-sm">
                      {t.features.map((f) => (
                        <li
                          key={f.text}
                          className="flex items-start gap-2"
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${
                              f.included
                                ? 'text-[#22c55e]'
                                : 'text-[#737373]'
                            }`}
                          >
                            {f.included
                              ? isHighlighted
                                ? 'check_circle'
                                : 'check'
                              : 'close'}
                          </span>
                          <span
                            className={
                              !f.included
                                ? 'text-[#737373]'
                                : f.strong
                                ? 'text-white font-medium'
                                : 'text-[#bccbb9]'
                            }
                          >
                            {f.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    {t.ctaStyle === 'disabled' ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 rounded-lg bg-[#2a2a2a] border border-[#1A1A1A] text-[#737373] text-sm font-medium cursor-not-allowed"
                      >
                        {t.ctaLabel}
                      </button>
                    ) : t.ctaStyle === 'primary' ? (
                      <button
                        type="button"
                        onClick={() => setComingSoonOpen(true)}
                        className="w-full py-2.5 rounded-lg bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <span>{t.ctaLabel}</span>
                        <span className="material-symbols-outlined text-[18px]">
                          arrow_forward
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setComingSoonOpen(true)}
                        className="w-full py-2.5 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] text-white hover:border-[#22c55e]/50 hover:text-[#22c55e] text-sm font-semibold transition-colors"
                      >
                        {t.ctaLabel}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Payment Methods + Billing Info ─────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Payment methods */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col gap-4 justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#22c55e]">
                    credit_card
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    Payment Methods
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-[#737373]">
                  STRIPE PCI-DSS v4.0
                </span>
              </div>

              {/* Empty state (pilot) */}
              <div className="bg-[#1c1b1b] border border-dashed border-[#1A1A1A] rounded-lg p-6 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-[#737373] text-3xl mb-2">
                  add_card
                </span>
                <p className="text-sm text-white font-medium mb-1">
                  No payment methods on file
                </p>
                <p className="text-xs text-[#737373] max-w-xs">
                  Card and local payment options become available when paid plans go live.
                  Your free tier requires no payment method.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setComingSoonOpen(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#000000] border border-[#1A1A1A] hover:border-[#22c55e]/50 text-white hover:text-[#22c55e] text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add New Payment Instrument
            </button>
          </div>

          {/* Billing info */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#22c55e]">
                    badge
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    Billing Information
                  </h3>
                </div>
                <Link
                  to="/dashboard/settings"
                  className="text-xs text-[#22c55e] hover:underline"
                >
                  Edit Info
                </Link>
              </div>

              <div className="space-y-2 text-sm">
                <InfoLine label="Account Holder" value={user?.full_name || '—'} />
                <InfoLine
                  label="Billing Email"
                  value={user?.email || '—'}
                  mono
                />
                <InfoLine label="Plan" value={currentTierName} />
                <InfoLine
                  label="Invoice Destination"
                  value="Auto-dispatch to primary email"
                />
              </div>
            </div>

            <div className="bg-[#1c1b1b] border border-[#1A1A1A] rounded-lg p-3 flex items-center justify-between text-xs text-[#737373]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">
                  receipt_long
                </span>
                <span>Need corporate invoices with vendor W-9?</span>
              </div>
              <button
                type="button"
                onClick={() => setComingSoonOpen(true)}
                className="text-[#22c55e] hover:underline font-medium"
              >
                Request
              </button>
            </div>
          </div>
        </section>

        {/* ── Invoice History ────────────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#22c55e]">
                history
              </span>
              <h3 className="text-base font-semibold text-white">
                Invoice &amp; Transaction Ledger
              </h3>
              <span className="font-mono text-[11px] text-[#737373] bg-[#1c1b1b] px-2 py-0.5 rounded border border-[#1A1A1A]">
                {INVOICES.length} RECORDS
              </span>
            </div>

            <button
              type="button"
              onClick={() => setComingSoonOpen(true)}
              className="flex items-center gap-2 text-[#737373] hover:text-white transition-colors text-xs font-medium self-start"
            >
              <span className="material-symbols-outlined text-[16px]">
                download
              </span>
              Download All (CSV)
            </button>
          </div>

          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-[#2a2a2a]/40 border-b border-[#1A1A1A]">
                  <th className="py-3 px-4 text-[11px] uppercase tracking-wider text-[#737373] font-semibold">
                    Invoice ID
                  </th>
                  <th className="py-3 px-4 text-[11px] uppercase tracking-wider text-[#737373] font-semibold">
                    Billing Date
                  </th>
                  <th className="py-3 px-4 text-[11px] uppercase tracking-wider text-[#737373] font-semibold">
                    Amount
                  </th>
                  <th className="py-3 px-4 text-[11px] uppercase tracking-wider text-[#737373] font-semibold">
                    Status
                  </th>
                  <th className="py-3 px-4 text-[11px] uppercase tracking-wider text-[#737373] font-semibold text-right">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {INVOICES.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#1c1b1b] transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-sm text-white font-medium">
                      {inv.id}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#737373]">
                      {inv.date}
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-white">
                      {inv.amount}
                    </td>
                    <td className="py-3 px-4">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setComingSoonOpen(true)}
                        title="Download PDF"
                        className="p-1.5 rounded hover:bg-[#2a2a2a] text-[#737373] hover:text-[#22c55e] transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          picture_as_pdf
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Cancellation / Pause Footer ────────────── */}
        <section className="p-5 rounded-xl bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 max-w-2xl">
            <span className="material-symbols-outlined text-[#737373] text-[20px] mt-0.5 shrink-0">
              pause_circle
            </span>
            <div>
              <p className="text-sm text-white font-medium">
                Need to pause your job hunt?
              </p>
              <p className="text-xs text-[#737373] leading-relaxed">
                Freeze your account anytime or cancel renewal with one click. Your
                stored CVs, match weights, and pipeline telemetry remain encrypted
                in zero-knowledge storage.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPauseModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#1A1A1A] text-[#737373] hover:text-white text-xs font-medium transition-colors"
            >
              Pause Telemetry
            </button>
            <Link
              to="/dashboard/settings"
              className="px-4 py-2 rounded-lg text-[#737373] hover:text-[#EF4444] text-xs font-medium transition-colors"
            >
              Deactivate Account
            </Link>
          </div>
        </section>
      </div>

      {/* ── "Coming Soon" Modal ──────────────────────── */}
      {comingSoonOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setComingSoonOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#22c55e] text-[24px]">
                rocket_launch
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Payments launching soon
            </h3>
            <p className="text-sm text-[#737373] leading-relaxed mb-6">
              Paid plans aren't active yet. During the pilot, every feature is fully
              unlocked for free. When Pro launches, we'll email you at{' '}
              <span className="text-white font-medium">
                {user?.email || 'your account email'}
              </span>
              .
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setComingSoonOpen(false)}
                className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors"
              >
                Close
              </button>
              <Link
                to="/dashboard/settings"
                className="bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Pause Confirmation Modal ─────────────────── */}
      {pauseModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPauseModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#EAB308] text-[24px]">
                pause_circle
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Pause account telemetry?
            </h3>
            <p className="text-sm text-[#737373] leading-relaxed mb-6">
              This temporarily disables analytics collection, scheduled reports, and
              review reminders. Your data stays intact. You can resume anytime.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPauseModalOpen(false)}
                className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setPauseModalOpen(false)
                  setComingSoonOpen(true)
                }}
                className="bg-[#EAB308] hover:bg-[#CA8A04] text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Info row helper ──────────────────────────────────────
function InfoLine({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1A1A1A]/60 last:border-0 gap-3">
      <span className="text-[#737373] text-xs shrink-0">{label}</span>
      <span
        className={`text-white text-sm text-right truncate ${
          mono ? 'font-mono text-xs' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  )
}