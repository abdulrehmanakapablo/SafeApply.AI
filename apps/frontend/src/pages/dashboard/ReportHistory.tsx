// FILE: src/pages/dashboard/ReportHistory.tsx
// ROUTE: /dashboard/company-report/history
// BACKEND: GET /api/reports/history, DELETE /api/reports/:id

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { Alert, ButtonLink, Card, ConfirmDialog, EmptyState, Icon, PageContainer, PageHeader, Pagination, SkeletonRows, formatDate } from '../../components/ui'
import { deleteReport, getReportHistory, type ReportListItem } from '../../api/reports'
import { apiError } from '../../lib/axios'

export default function ReportHistory() {
  const [items, setItems] = useState<ReportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState<ReportListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getReportHistory({ page })
      setItems(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
      setTotalPages(res.total_pages || 1)
    } catch (err) {
      setError(apiError(err, 'Couldn’t load your reports.'))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) => r.company_name.toLowerCase().includes(q) || (r.job_title || '').toLowerCase().includes(q))
  }, [items, filter])

  async function confirmDelete() {
    if (!pending) return
    setDeleting(true)
    try {
      await deleteReport(pending.id)
      setItems((p) => p.filter((r) => r.id !== pending.id))
      setTotal((t) => Math.max(0, t - 1))
      toast.success('Report deleted')
      setPending(null)
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t delete the report.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <SEO title="Report history | SafeApply.AI" description="Your company reports." path="/dashboard/company-report/history" noindex />
      <PageContainer>
        <PageHeader
          title="Report history"
          description={loading ? ' ' : `${total} report${total === 1 ? '' : 's'}. Deleting one doesn’t give back the free credit.`}
          actions={
            <ButtonLink to="/dashboard/company-report" icon="add">
              New report
            </ButtonLink>
          }
        />

        {error && <Alert>{error}</Alert>}

        <Card padded={false}>
          {items.length > 0 && (
            <div className="p-4 border-b border-line">
              <div className="relative max-w-sm">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter this page"
                  aria-label="Filter reports on this page"
                  className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-input)] bg-ink border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon="history"
              title="No reports yet"
              body="Every report you run is saved here with a link you can come back to."
              action={<ButtonLink to="/dashboard/company-report">Run your first report</ButtonLink>}
            />
          ) : shown.length === 0 ? (
            <EmptyState icon="search_off" title="No matches on this page" body="Clear the filter or check the next page." />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((r) => (
                <li key={r.id} className="group flex items-center gap-3 pr-3 hover:bg-line/40 transition-colors">
                  <Link to={`/dashboard/company-report/${r.id}`} className="flex-1 min-w-0 flex items-center gap-3 pl-5 py-4">
                    <span className="w-9 h-9 rounded-[8px] bg-line flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden>
                      {r.company_name.trim().charAt(0).toUpperCase() || '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate group-hover:text-accent transition-colors">{r.company_name}</span>
                      <span className="block text-xs text-muted truncate">{r.job_title || 'Company only'}</span>
                    </span>
                    <time dateTime={r.created_at} className="hidden sm:block text-xs text-muted tabular whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </time>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPending(r)}
                    aria-label={`Delete report for ${r.company_name}`}
                    className="w-9 h-9 rounded-[8px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        <ConfirmDialog
          open={Boolean(pending)}
          onClose={() => !deleting && setPending(null)}
          onConfirm={confirmDelete}
          loading={deleting}
          title="Delete this report?"
          body={pending ? `${pending.company_name}${pending.job_title ? `, ${pending.job_title}` : ''}. The shared link will stop working.` : undefined}
        />
      </PageContainer>
    </>
  )
}
