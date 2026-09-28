// FILE: src/pages/admin/ReviewModeration.tsx
// ROUTE: /admin/reviews (admin only)
// BACKEND: GET /api/admin/reviews, PATCH /api/admin/reviews/:id
// PURPOSE: Moderation queue — inspect, verify, approve/flag/reject anonymous reviews.
//          Reviewer identity visible here ONLY (admin-only route).
// SECURITY:
//   - No dangerouslySetInnerHTML — all data auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.
//   - PATCH is ownership-checked by adminOnly middleware on the backend.
//   - Reviewer identity never leaves admin routes.

import { useState, useEffect, useMemo } from 'react'
import SEO from '../../components/SEO'
import {
  getAdminReviews,
  updateReviewStatus,
  type AdminReview,
} from '../../api/admin'

// ─── Types ──────────────────────────────────────────────
type FilterKey = 'pending' | 'flagged' | 'approved' | 'rejected'
type ActionKind = 'approve' | 'flag' | 'reject'

interface ModerationRow {
  id: string
  company: string
  company_initial: string
  company_initial_color: string
  role: string
  stages_label: string
  tc: string | null
  rating: number | null
  excerpt: string
  hash: string
  submitted_label: string
  reviewer_name: string
  reviewer_email: string
  reviewer_tag: string | null
  reviewer_tag_color: string | null
  account_created: string
  account_age_days: number
  verification_label: string
  verification_icon: string
  verification_tone: 'primary' | 'warning' | 'error'
  verification_sub: string
  flagged?: boolean
  flagged_reason?: string
}

// ─── Demo fallback (pilot mode) ─────────────────────────
const DEMO_ROWS: ModerationRow[] = []

// ─── Helpers ────────────────────────────────────────────
function toRow(review: AdminReview): ModerationRow {
  const initials = review.company_name
    ? review.company_name.charAt(0).toUpperCase()
    : '?'

  return {
    id: review.id,
    company: review.company_name,
    company_initial: initials,
    company_initial_color:
      review.moderation_status === 'flagged' ? '#EF4444' : '#22c55e',
    role: review.role_type,
    stages_label: '—',
    tc: review.review_text.includes('$')
      ? review.review_text.match(/\$[\d,]+k?/)?.[0] || null
      : null,
    rating: review.overall_rating || null,
    excerpt: review.review_text,
    hash: `0x${review.id.slice(0, 5)}...${review.id.slice(-4)}`,
    submitted_label: new Date(review.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    reviewer_name: review.users?.full_name || 'Anonymous',
    reviewer_email: review.users?.email || '—',
    reviewer_tag: null,
    reviewer_tag_color: null,
    account_created: '—',
    account_age_days: 0,
    verification_label:
      review.moderation_status === 'approved'
        ? 'Verified'
        : review.moderation_status === 'flagged'
        ? 'Flagged for audit'
        : 'Pending review',
    verification_icon:
      review.moderation_status === 'approved'
        ? 'verified_user'
        : review.moderation_status === 'flagged'
        ? 'flag'
        : 'hourglass_empty',
    verification_tone:
      review.moderation_status === 'approved'
        ? 'primary'
        : review.moderation_status === 'flagged'
        ? 'error'
        : 'warning',
    verification_sub: '',
    flagged: review.moderation_status === 'flagged',
  }
}

// ─── Tone helpers ───────────────────────────────────────
function toneClasses(tone: 'primary' | 'warning' | 'error'): string {
  if (tone === 'primary')
    return 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30'
  if (tone === 'warning')
    return 'bg-[#EAB308]/10 text-[#EAB308] border-[#EAB308]/30'
  return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
}

// ─── Main component ─────────────────────────────────────
export default function ReviewModeration() {
  const [rows, setRows] = useState<ModerationRow[]>(DEMO_ROWS)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    kind: 'ok' | 'err' | 'warn'
    text: string
  } | null>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  // Load reviews
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await getAdminReviews({ page: 1 })
        if (cancelled) return
        if (res.success && res.data && res.data.length > 0) {
          setRows(res.data.map(toRow))
        } else {
          setRows(DEMO_ROWS)
        }
      } catch {
        if (!cancelled) setRows(DEMO_ROWS)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Derived counts
  const counts = useMemo(() => {
    return {
      pending: rows.filter((r) => !r.flagged && r.verification_tone === 'warning')
        .length,
      flagged: rows.filter((r) => r.flagged).length,
      approved: rows.filter((r) => r.verification_tone === 'primary').length,
      rejected: rows.filter((r) => r.verification_tone === 'error' && !r.flagged)
        .length,
    }
  }, [rows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    let list = rows

    if (filter === 'pending')
      list = list.filter((r) => !r.flagged && r.verification_tone === 'warning')
    else if (filter === 'flagged') list = list.filter((r) => r.flagged)
    else if (filter === 'approved')
      list = list.filter((r) => r.verification_tone === 'primary')
    else if (filter === 'rejected')
      list = list.filter((r) => r.verification_tone === 'error' && !r.flagged)

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.company.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          r.reviewer_email.toLowerCase().includes(q) ||
          r.reviewer_name.toLowerCase().includes(q)
      )
    }

    return list
  }, [rows, filter, search])

  // Selection helpers
  const allSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id))

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredRows.map((r) => r.id)))
    }
  }

  // ── Moderate a single review ─────────────────────────
  async function handleAction(row: ModerationRow, kind: ActionKind) {
    if (busyId) return
    setBusyId(row.id)

    const apiStatus: 'approved' | 'flagged' | 'deleted' =
      kind === 'approve' ? 'approved' : kind === 'flag' ? 'flagged' : 'deleted'

    const previous = rows

    // Optimistic removal from current view
    if (kind === 'reject') {
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                flagged: kind === 'flag',
                verification_tone:
                  kind === 'approve' ? ('primary' as const) : ('error' as const),
                verification_label:
                  kind === 'approve' ? 'Verified' : 'Flagged for audit',
                verification_icon: kind === 'approve' ? 'verified_user' : 'flag',
              }
            : r
        )
      )
    }
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(row.id)
      return next
    })

    try {
      if (!row.id.startsWith('d')) {
        await updateReviewStatus(row.id, apiStatus)
      }
      setToast({
        kind: kind === 'approve' ? 'ok' : kind === 'flag' ? 'warn' : 'err',
        text:
          kind === 'approve'
            ? `Review for ${row.company} approved and published.`
            : kind === 'flag'
            ? `Review for ${row.company} flagged for secondary audit.`
            : `Debrief for ${row.company} purged.`,
      })
    } catch {
      setRows(previous)
      setToast({ kind: 'err', text: 'Action failed — restored.' })
    } finally {
      setBusyId(null)
    }
  }

  // ── Bulk approve ─────────────────────────────────────
  async function handleBulkApprove() {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      setToast({ kind: 'warn', text: 'No reviews selected.' })
      return
    }

    const previous = rows
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id)
          ? {
              ...r,
              flagged: false,
              verification_tone: 'primary' as const,
              verification_label: 'Verified',
              verification_icon: 'verified_user',
            }
          : r
      )
    )
    setSelected(new Set())

    try {
      const results = await Promise.allSettled(
        ids
          .filter((id) => !id.startsWith('d'))
          .map((id) => updateReviewStatus(id, 'approved'))
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        setToast({
          kind: 'warn',
          text: `${ids.length - failed} approved · ${failed} failed.`,
        })
      } else {
        setToast({
          kind: 'ok',
          text: `Bulk job executed: ${ids.length} reviews approved.`,
        })
      }
    } catch {
      setRows(previous)
      setToast({ kind: 'err', text: 'Bulk approve failed — restored.' })
    }
  }

  // ── Filter tabs metadata ─────────────────────────────
  const tabs: {
    key: FilterKey
    label: string
    icon: string
    count: number
  }[] = [
    {
      key: 'pending',
      label: 'Pending Approval',
      icon: 'pending_actions',
      count: counts.pending,
    },
    { key: 'flagged', label: 'Flagged', icon: 'flag', count: counts.flagged },
    {
      key: 'approved',
      label: 'Approved',
      icon: 'verified',
      count: counts.approved,
    },
    {
      key: 'rejected',
      label: 'Rejected',
      icon: 'block',
      count: counts.rejected,
    },
  ]

  return (
    <>
      <SEO
        title="Review Moderation | SafeApply.AI"
        description="Admin moderation queue — verify, approve, flag, or reject anonymous company reviews."
        path="/admin/reviews"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-4 border-b border-[#1A1A1A]">
          <div className="flex flex-col gap-1 min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] text-[#22c55e] uppercase tracking-widest">
                Sys_Admin // Queue.04
              </span>
              <span className="text-[#353534] font-mono text-[11px]">/</span>
              <span className="text-[11px] uppercase tracking-wider text-[#737373]">
                Attestation Verifier
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Review Moderation Queue
            </h1>
            <p className="text-sm text-[#737373]">
              Inspect, verify attestations, and moderate anonymous candidate
              interview &amp; compensation debriefs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2a2a2a] border border-[#1A1A1A] whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#EAB308] animate-pulse" />
              <span className="font-mono text-[11px] text-[#EAB308]">
                {counts.pending} PENDING AUDIT
              </span>
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D0D0D] border border-[#1A1A1A] whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span className="font-mono text-[11px] text-[#22c55e]">
                18,928 VERIFIED PUBLISHED
              </span>
            </span>
          </div>
        </header>

        {/* ── Filter console ─────────────────────────── */}
        <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => {
              const active = filter === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setFilter(t.key)
                    setSelected(new Set())
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#1c1b1b] text-[#22c55e] border border-[#22c55e]/30'
                      : 'text-[#737373] hover:text-white hover:bg-[#1c1b1b] border border-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {t.icon}
                  </span>
                  <span>{t.label}</span>
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                      active
                        ? 'bg-[#22c55e]/20 text-[#22c55e]'
                        : 'bg-[#2a2a2a] text-[#737373]'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] text-[18px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter company, role, or email…"
                className="w-full h-10 pl-9 pr-3 bg-black border border-[#1A1A1A] text-white placeholder:text-[#737373] text-sm rounded-lg focus:outline-none focus:border-[#22c55e] transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleBulkApprove}
              className="h-10 px-4 bg-[#22c55e] hover:bg-[#16A34A] text-black text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2 shrink-0 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px]">
                done_all
              </span>
              Bulk Approve
              {selected.size > 0 && (
                <span className="font-mono">({selected.size})</span>
              )}
            </button>
          </div>
        </section>

        {/* ── Moderation table ───────────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2">
              <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">
                sync
              </span>
              <p className="text-sm text-[#737373]">Loading queue…</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <span className="material-symbols-outlined text-[#737373] text-4xl mb-2">
                inbox
              </span>
              <p className="text-sm text-white font-medium mb-1">
                No reviews in this view
              </p>
              <p className="text-xs text-[#737373]">
                Try a different filter or clear your search.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1040px]">
                  <thead>
                    <tr className="bg-black border-b border-[#1A1A1A] text-[10px] uppercase tracking-wider text-[#737373] select-none">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all"
                          className="w-4 h-4 rounded bg-[#0D0D0D] border border-[#1A1A1A] accent-[#22c55e] cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4 w-56">Company &amp; Role</th>
                      <th className="py-3 px-4 w-80">
                        Reported Telemetry &amp; Excerpt
                      </th>
                      <th className="py-3 px-4 w-60">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-[#22c55e]">
                            lock
                          </span>
                          Reviewer Identity
                        </span>
                      </th>
                      <th className="py-3 px-4 w-44">Verification</th>
                      <th className="py-3 px-4 text-right w-44">
                        Moderation Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {filteredRows.map((row) => {
                      const rowSelected = selected.has(row.id)
                      const busy = busyId === row.id
                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors ${
                            row.flagged
                              ? 'bg-[#EAB308]/[0.05] hover:bg-[#EAB308]/[0.09]'
                              : 'hover:bg-[#141414]'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-4 px-4 align-top">
                            <input
                              type="checkbox"
                              checked={rowSelected}
                              onChange={() => toggleSelect(row.id)}
                              aria-label={`Select review for ${row.company}`}
                              className={`w-4 h-4 rounded bg-[#0D0D0D] border border-[#1A1A1A] cursor-pointer ${
                                row.flagged
                                  ? 'accent-[#EF4444]'
                                  : 'accent-[#22c55e]'
                              }`}
                            />
                          </td>

                          {/* Company & Role */}
                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-6 h-6 rounded flex items-center justify-center font-mono text-xs font-bold shrink-0"
                                  style={{
                                    backgroundColor: `${row.company_initial_color}1a`,
                                    color: row.company_initial_color,
                                  }}
                                >
                                  {row.company_initial}
                                </span>
                                <span className="text-sm font-semibold text-white truncate">
                                  {row.company}
                                </span>
                              </div>
                              <span className="text-xs text-[#737373] truncate">
                                {row.role}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                                  row.flagged ? 'text-[#EF4444]' : 'text-[#737373]'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {row.flagged ? 'warning' : 'schedule'}
                                </span>
                                {row.stages_label}
                              </span>
                            </div>
                          </td>

                          {/* Reported Telemetry */}
                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-col gap-2 max-w-sm">
                              <div className="flex items-center gap-2 flex-wrap">
                                {row.tc && (
                                  <span className="font-mono text-[11px] text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/30 px-1.5 py-0.5 rounded">
                                    {row.tc}
                                  </span>
                                )}
                                {row.rating && (
                                  <span className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                      <span
                                        key={i}
                                        className="material-symbols-outlined text-[14px]"
                                        style={{
                                          fontVariationSettings:
                                            i <= (row.rating || 0)
                                              ? "'FILL' 1"
                                              : "'FILL' 0",
                                          color:
                                            i <= (row.rating || 0)
                                              ? '#22c55e'
                                              : '#737373',
                                        }}
                                      >
                                        star
                                      </span>
                                    ))}
                                  </span>
                                )}
                                {row.flagged && (
                                  <span className="text-[10px] font-bold text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Suspicious syntax
                                  </span>
                                )}
                              </div>

                              <p
                                className={`text-xs leading-relaxed line-clamp-3 ${
                                  row.flagged
                                    ? 'text-[#EAB308] bg-black p-1.5 rounded font-mono'
                                    : 'text-[#bccbb9] italic'
                                }`}
                              >
                                {row.excerpt}
                              </p>

                              <span
                                className={`text-[11px] font-mono truncate ${
                                  row.flagged ? 'text-[#EF4444]' : 'text-[#737373]'
                                }`}
                              >
                                {row.hash} · {row.submitted_label}
                              </span>
                            </div>
                          </td>

                          {/* Reviewer Identity */}
                          <td className="py-4 px-4 align-top">
                            <div
                              className={`p-2.5 rounded-lg flex flex-col gap-1.5 ${
                                row.flagged
                                  ? 'bg-[#EF4444]/[0.08] border border-[#EF4444]/30'
                                  : 'bg-black/60 border border-[#1A1A1A]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-xs font-semibold truncate ${
                                    row.flagged ? 'text-[#EF4444]' : 'text-white'
                                  }`}
                                >
                                  {row.reviewer_name}
                                </span>
                                {row.reviewer_tag && (
                                  <span
                                    className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap"
                                    style={{
                                      color: row.reviewer_tag_color || '#737373',
                                      backgroundColor: `${row.reviewer_tag_color}1a`,
                                    }}
                                  >
                                    {row.reviewer_tag}
                                  </span>
                                )}
                              </div>

                              <span
                                className={`flex items-center gap-1.5 text-[11px] font-mono truncate ${
                                  row.flagged ? 'text-[#EF4444]' : 'text-[#737373]'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[13px] shrink-0">
                                  {row.flagged ? 'domain_disabled' : 'mail'}
                                </span>
                                <span className="truncate">
                                  {row.reviewer_email}
                                </span>
                              </span>

                              <span className="text-[11px] text-[#737373]">
                                Account: {row.account_created}
                                {row.account_age_days > 0 && (
                                  <>
                                    {' '}
                                    <span
                                      className={
                                        row.account_age_days < 30
                                          ? 'text-[#EF4444]'
                                          : 'text-[#22c55e]'
                                      }
                                    >
                                      ({row.account_age_days}d old)
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Verification Signal */}
                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-col gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border w-fit ${toneClasses(
                                  row.verification_tone
                                )}`}
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  {row.verification_icon}
                                </span>
                                {row.verification_label}
                              </span>
                              {row.verification_sub && (
                                <span className="text-[11px] font-mono text-[#737373]">
                                  {row.verification_sub}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Moderation Action */}
                          <td className="py-4 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleAction(row, 'approve')}
                                disabled={busy}
                                aria-label={`Approve ${row.company}`}
                                title="Approve & publish"
                                className="p-2 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] text-[#22c55e] hover:bg-[#22c55e] hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {busy ? 'sync' : 'check'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAction(row, 'flag')}
                                disabled={busy}
                                aria-label={`Flag ${row.company}`}
                                title="Flag for secondary audit"
                                className="p-2 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] text-[#EAB308] hover:bg-[#EAB308] hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  flag
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAction(row, 'reject')}
                                disabled={busy}
                                aria-label={`Reject ${row.company}`}
                                title="Reject & delete"
                                className="p-2 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-4 bg-black/40 border-t border-[#1A1A1A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-[#737373]">
                  Showing{' '}
                  <span className="text-white font-semibold">
                    1–{filteredRows.length}
                  </span>{' '}
                  of{' '}
                  <span className="text-white font-semibold">
                    {filteredRows.length}
                  </span>{' '}
                  reviews
                </span>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 bg-[#0D0D0D] border border-[#1A1A1A] text-[#737373] rounded text-xs font-medium opacity-40 cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="w-8 h-8 rounded flex items-center justify-center bg-[#22c55e] text-black font-mono text-xs font-bold">
                      1
                    </span>
                    <button
                      type="button"
                      className="w-8 h-8 rounded flex items-center justify-center bg-[#0D0D0D] border border-[#1A1A1A] text-[#737373] hover:text-white font-mono text-xs transition-colors"
                    >
                      2
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 rounded flex items-center justify-center bg-[#0D0D0D] border border-[#1A1A1A] text-[#737373] hover:text-white font-mono text-xs transition-colors"
                    >
                      3
                    </button>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#0D0D0D] border border-[#1A1A1A] text-white hover:border-[#22c55e]/40 rounded text-xs font-medium transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── Audit policy banner ────────────────────── */}
        <section className="p-4 rounded-xl bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#22c55e] text-[20px] shrink-0 mt-0.5">
              policy
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-semibold text-white">
                Cryptographic Audit Ledger Enforcement
              </span>
              <p className="text-xs text-[#737373] leading-relaxed">
                Deleting permanently purges the review from moderation tables.
                Flagged reviews remain hidden from public search until resolved.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            <span className="font-mono text-[11px] text-[#737373]">
              SYNC_LATENCY: 14ms
            </span>
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
          </div>
        </section>
      </div>

      {/* ── Toast ─────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-100 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg border shadow-xl bg-[#0D0D0D] text-sm flex items-center gap-2 border-l-4 ${
            toast.kind === 'ok'
              ? 'border-l-[#22c55e] border-[#1A1A1A]'
              : toast.kind === 'warn'
              ? 'border-l-[#EAB308] border-[#1A1A1A]'
              : 'border-l-[#EF4444] border-[#1A1A1A]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              toast.kind === 'ok'
                ? 'text-[#22c55e]'
                : toast.kind === 'warn'
                ? 'text-[#EAB308]'
                : 'text-[#EF4444]'
            }`}
          >
            {toast.kind === 'ok'
              ? 'verified'
              : toast.kind === 'warn'
              ? 'flag'
              : 'delete_forever'}
          </span>
          <span className="text-white break-words">{toast.text}</span>
        </div>
      )}
    </>
  )
}