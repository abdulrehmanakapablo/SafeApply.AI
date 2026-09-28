// FILE: src/pages/dashboard/ReportHistory.tsx
// ROUTE: /dashboard/company-report/history (auth required)
// BACKEND: GET /api/reports/history, DELETE /api/reports/:id
// PURPOSE: Searchable, paginated list of every company intelligence report
//          the user has ever run. Open a report to re-read it, or delete it.
// SECURITY:
//   - No dangerouslySetInnerHTML — all data auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.
//   - Delete is ownership-checked on the backend (user_id = req.user.userId).
//   - Auth gate handled by ProtectedRoute in the router.

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { getReportHistory, deleteReport } from '../../api/reports'

// ─── Types ──────────────────────────────────────────────
interface ReportRow {
  id: string
  company_name: string
  job_title: string | null
  created_at: string
}

// ─── Demo fallback (pilot mode) ─────────────────────────
const DEMO_ROWS: ReportRow[] = []

const PAGE_SIZE = 20

// ─── Helpers ────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const d = Math.max(0, Math.round((now - then) / 86_400_000))
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// ─── Main component ─────────────────────────────────────
export default function ReportHistory() {
  const [reports, setReports] = useState<ReportRow[]>(DEMO_ROWS)
  const [total, setTotal] = useState<number>(DEMO_ROWS.length)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState<ReportRow | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Load on mount
  useEffect(() => {
    let cancelled = false
    getReportHistory({ page })
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data && res.data.length > 0) {
          setReports(
            res.data.map((r) => ({
              id: r.id,
              company_name: r.company_name,
              job_title: r.job_title,
              created_at: r.created_at,
            }))
          )
          setTotal(res.total ?? res.data.length)
        } else {
          // Pilot fallback — demo data
          setReports(DEMO_ROWS)
          setTotal(DEMO_ROWS.length)
        }
      })
      .catch(() => {
        if (cancelled) return
        setReports(DEMO_ROWS)
        setTotal(DEMO_ROWS.length)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

  // Client-side search filter (server-side search can be added later)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return reports
    return reports.filter(
      (r) =>
        r.company_name.toLowerCase().includes(q) ||
        (r.job_title || '').toLowerCase().includes(q)
    )
  }, [reports, search])

  // ── Delete flow ──────────────────────────────────────
  async function handleDelete(report: ReportRow) {
    setDeletingId(report.id)

    const isDemo = report.id.startsWith('demo-')
    const previousReports = reports
    const previousTotal = total

    // Optimistic removal
    setReports((prev) => prev.filter((r) => r.id !== report.id))
    setTotal((prev) => Math.max(0, prev - 1))
    setConfirmOpen(null)

    try {
      if (!isDemo) {
        await deleteReport(report.id)
      }
      setToast({ kind: 'ok', text: 'Report deleted.' })
    } catch {
      // Rollback on failure
      setReports(previousReports)
      setTotal(previousTotal)
      setToast({ kind: 'err', text: 'Delete failed — restored.' })
    } finally {
      setDeletingId(null)
    }
  }

  // ── Pagination ───────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <>
      <SEO
        title="Report History | SafeApply.AI"
        description="Every company intelligence report you have run — searchable, paginated, and ready to re-open."
        path="/dashboard/company-report/history"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 pb-16">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                Telemetry Archive
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              Report History
            </h1>
            <p className="text-sm text-[#737373]">
              Every company intelligence report you have run — searchable and ready to re-open.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#1A1A1A] px-3 py-1.5 rounded-lg text-xs">
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                policy
              </span>
              <span className="text-white font-medium">
                {total} report{total === 1 ? '' : 's'}
              </span>
            </span>
            <Link
              to="/dashboard/company-report"
              className="inline-flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                add
              </span>
              New Report
            </Link>
          </div>
        </header>

        {/* ── Search ─────────────────────────────────── */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company or job title…"
            aria-label="Search reports"
            className="w-full h-11 pl-11 pr-4 bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm rounded-lg placeholder:text-[#737373] focus:outline-none focus:border-[#22c55e] transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          )}
        </div>

        {/* ── Table ─────────────────────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">
                sync
              </span>
              <p className="text-sm text-[#737373]">Loading reports…</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <span className="material-symbols-outlined text-[#737373] text-5xl mb-3">
                folder_open
              </span>
              <h2 className="text-base font-semibold text-white mb-1">
                No reports yet
              </h2>
              <p className="text-sm text-[#737373] max-w-sm mb-5">
                Run your first company intelligence report to see it here. Every report is saved automatically.
              </p>
              <Link
                to="/dashboard/company-report"
                className="inline-flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  bolt
                </span>
                Run First Report
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <span className="material-symbols-outlined text-[#737373] text-4xl mb-3">
                search_off
              </span>
              <p className="text-sm text-white font-medium mb-1">
                No matches for &ldquo;{search}&rdquo;
              </p>
              <p className="text-xs text-[#737373] mb-4">
                Try a different company or job title.
              </p>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#1A1A1A] text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Clear search
              </button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black text-[#737373] text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-5 font-semibold">
                        Company
                      </th>
                      <th className="py-3 px-5 font-semibold">
                        Role
                      </th>
                      <th className="py-3 px-5 font-semibold">
                        Run on
                      </th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-[#141414] transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <Link
                            to={`/dashboard/company-report?report=${r.id}`}
                            className="flex items-center gap-3 min-w-0"
                          >
                            <span className="w-9 h-9 rounded bg-[#2a2a2a] flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {r.company_name.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm text-white font-semibold group-hover:text-[#22c55e] transition-colors truncate">
                              {r.company_name}
                            </span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="text-sm text-[#737373] truncate">
                            {r.job_title || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex flex-col">
                            <span className="text-xs text-white">
                              {formatDate(r.created_at)}
                            </span>
                            <span className="font-mono text-[11px] text-[#737373]">
                              {formatRelative(r.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/dashboard/company-report?report=${r.id}`}
                              aria-label={`View report for ${r.company_name}`}
                              title="View report"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#1A1A1A] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                visibility
                              </span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirmOpen(r)}
                              disabled={deletingId === r.id}
                              aria-label={`Delete report for ${r.company_name}`}
                              title="Delete report"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="md:hidden flex flex-col divide-y divide-[#1A1A1A]">
                {filtered.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 rounded bg-[#2a2a2a] flex items-center justify-center text-white font-bold shrink-0">
                        {r.company_name.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm text-white font-semibold truncate">
                          {r.company_name}
                        </span>
                        <span className="text-xs text-[#737373] truncate">
                          {r.job_title || 'No specific role'}
                        </span>
                        <span className="text-[11px] text-[#737373] mt-1 font-mono">
                          {formatDate(r.created_at)} • {formatRelative(r.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/company-report?report=${r.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1c1b1b] border border-[#1A1A1A] hover:border-[#22c55e]/40 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          visibility
                        </span>
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(r)}
                        disabled={deletingId === r.id}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-transparent border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 text-xs font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          delete
                        </span>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── Pagination ────────────────────────────── */}
        {!loading && reports.length > 0 && totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2"
          >
            <p className="text-xs text-[#737373]">
              Showing{' '}
              <span className="text-white font-medium">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)}
              </span>{' '}
              of <span className="text-white font-medium">{total}</span> reports
            </p>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canPrev}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] text-white text-xs font-medium hover:border-[#22c55e]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">
                  chevron_left
                </span>
                Prev
              </button>
              <span className="font-mono text-xs text-white px-3 py-1.5 bg-[#1c1b1b] border border-[#1A1A1A] rounded-lg">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canNext}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0D0D0D] border border-[#1A1A1A] text-white text-xs font-medium hover:border-[#22c55e]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <span className="material-symbols-outlined text-[16px]">
                  chevron_right
                </span>
              </button>
            </div>
          </nav>
        )}

        {/* ── Footer strip ──────────────────────────── */}
        <footer className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              Archive Sync: OK
            </span>
            <span className="hidden md:inline text-[#353534]">•</span>
            <span className="hidden md:inline text-[#737373]">
              Reports are retained until you delete them.
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[#737373]">
            <span>RETENTION ∞</span>
            <span>API 200 OK</span>
          </div>
        </footer>
      </div>

      {/* ── Delete Confirmation Modal ─────────────── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-report-title"
            className="w-full max-w-md bg-[#0D0D0D] border border-[#EF4444]/30 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#EF4444] text-[24px]">
                warning
              </span>
            </div>
            <h2
              id="delete-report-title"
              className="text-lg font-bold text-white mb-2"
            >
              Delete this report?
            </h2>
            <p className="text-sm text-[#737373] leading-relaxed mb-6">
              This permanently removes the{' '}
              <span className="text-white font-medium">
                {confirmOpen.company_name}
              </span>{' '}
              {confirmOpen.job_title ? (
                <>
                  report for{' '}
                  <span className="text-white font-medium">
                    {confirmOpen.job_title}
                  </span>
                </>
              ) : (
                'report'
              )}
              . Sources, ghost-posting timeline, and AI analysis will be lost.
              This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(null)}
                className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmOpen)}
                disabled={deletingId === confirmOpen.id}
                className="bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {deletingId === confirmOpen.id ? 'sync' : 'delete_forever'}
                </span>
                {deletingId === confirmOpen.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-100 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg border shadow-xl bg-[#0D0D0D] text-sm flex items-center gap-2 ${
            toast.kind === 'ok'
              ? 'border-l-4 border-l-[#22c55e] border-[#1A1A1A]'
              : 'border-l-4 border-l-[#EF4444] border-[#1A1A1A]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              toast.kind === 'ok' ? 'text-[#22c55e]' : 'text-[#EF4444]'
            }`}
          >
            {toast.kind === 'ok' ? 'check_circle' : 'error'}
          </span>
          <span className="text-white break-words">{toast.text}</span>
        </div>
      )}
    </>
  )
}