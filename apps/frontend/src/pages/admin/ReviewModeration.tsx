// FILE: src/pages/admin/ReviewModeration.tsx
// ROUTE: /admin/reviews
// BACKEND: GET /api/admin/reviews?status=&page=, PATCH /api/admin/reviews/:id
// NOTE: The reviewer's email is shown to admins for abuse handling only.
//       reviewer_id is never rendered.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { Stars } from '../../components/ui/Stars'
import { getAdminReviews, updateReviewStatus, type AdminReview } from '../../api/admin'
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, PageContainer, PageHeader, Pagination, SkeletonRows, Tabs, cn, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Filter = 'pending' | 'approved' | 'flagged' | 'deleted' | 'all'
type Action = 'approved' | 'flagged' | 'deleted'

const TONE: Record<AdminReview['moderation_status'], 'warn' | 'accent' | 'danger' | 'neutral'> = {
  pending: 'warn',
  approved: 'accent',
  flagged: 'danger',
  deleted: 'neutral',
}

export default function ReviewModeration() {
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminReview[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<AdminReview | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminReviews({ status: filter === 'all' ? undefined : filter, page })
      setRows(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
      setTotalPages(res.total_pages || 1)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load reviews.'))
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    void load()
  }, [load])

  async function act(r: AdminReview, status: Action) {
    if (busyId) return
    setBusyId(r.id)
    try {
      const res = await updateReviewStatus(r.id, status)
      if (!res.success) throw new Error(res.error)
      toast.success(status === 'approved' ? 'Approved and published' : status === 'flagged' ? 'Flagged' : 'Deleted')
      if (filter === 'all') setRows((p) => p.map((x) => (x.id === r.id ? { ...x, moderation_status: status } : x)))
      else {
        setRows((p) => p.filter((x) => x.id !== r.id))
        setTotal((t) => Math.max(0, t - 1))
      }
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t update the review.'))
    } finally {
      setBusyId(null)
      setConfirmDelete(null)
    }
  }

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <>
      <SEO title="Reviews | Admin | SafeApply.AI" description="Moderate reviews." path="/admin/reviews" noindex />
      <PageContainer>
        <PageHeader title="Reviews" description={loading ? ' ' : `${total} ${filter === 'all' ? 'in total' : filter}. Approving publishes the review and updates the company’s scores.`} />

        <Tabs
          label="Filter reviews"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          items={[
            { value: 'pending', label: 'Pending' },
            { value: 'flagged', label: 'Flagged' },
            { value: 'approved', label: 'Approved' },
            { value: 'deleted', label: 'Deleted' },
            { value: 'all', label: 'All' },
          ]}
          className="self-start"
        />

        {error && (
          <Alert title="Couldn’t load reviews">
            {error}{' '}
            <button type="button" onClick={load} className="underline underline-offset-2">
              Retry
            </button>
          </Alert>
        )}

        {loading ? (
          <Card>
            <SkeletonRows rows={5} />
          </Card>
        ) : rows.length === 0 && !error ? (
          <Card padded={false}>
            <EmptyState icon={filter === 'pending' ? 'task_alt' : 'inbox'} title={filter === 'pending' ? 'Queue is clear' : 'Nothing here'} body={filter === 'pending' ? 'New reviews show up here before they go public.' : undefined} />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {rows.map((r) => {
                const open = expanded.has(r.id)
                const long = r.review_text.length > 320
                const busy = busyId === r.id
                return (
                  <motion.li
                    key={r.id}
                    layout={!reduce}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                    transition={{ duration: 0.2 }}
                    className={cn('bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-4', busy && 'opacity-60')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold truncate">{r.company_name}</h2>
                          <Badge tone={TONE[r.moderation_status]}>{r.moderation_status}</Badge>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {r.role_type} · {formatDate(r.created_at)}
                          {r.users?.email && <> · by {r.users.email}</>}
                        </p>
                      </div>
                      <Stars rating={r.overall_rating} />
                    </div>
                    <div>
                      <p className={cn('text-sm text-muted leading-relaxed whitespace-pre-line break-words', !open && long && 'line-clamp-4')}>{r.review_text}</p>
                      {long && (
                        <button type="button" onClick={() => toggle(r.id)} className="mt-1 text-xs text-fg underline underline-offset-2">
                          {open ? 'Show less' : 'Read all'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.moderation_status !== 'deleted' && (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(r)} disabled={busy} className="hover:text-danger mr-auto">
                          Delete
                        </Button>
                      )}
                      {r.moderation_status !== 'flagged' && (
                        <Button size="sm" variant="secondary" icon="flag" onClick={() => act(r, 'flagged')} disabled={busy}>
                          Flag
                        </Button>
                      )}
                      {r.moderation_status !== 'approved' && (
                        <Button size="sm" icon="check" onClick={() => act(r, 'approved')} loading={busy}>
                          Approve
                        </Button>
                      )}
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          onClose={() => !busyId && setConfirmDelete(null)}
          onConfirm={() => confirmDelete && act(confirmDelete, 'deleted')}
          loading={Boolean(busyId)}
          title="Delete this review?"
          body="It’s hidden from the public and removed from the company’s scores. You can restore it from the Deleted tab."
        />
      </PageContainer>
    </>
  )
}
