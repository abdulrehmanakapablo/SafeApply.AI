// FILE: src/pages/admin/Payments.tsx
// ROUTE: /admin/payments
// PURPOSE: Confirm local payments against your JazzCash / Easypaisa / bank
//          statement. Approve adds 30 days to the right plan atomically.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { METHOD_LABEL, adminListPayments, adminReviewPayment, pkr, type AdminPayment } from '../../api/billing'
import { Alert, Badge, Button, Card, EmptyState, PageContainer, PageHeader, Pagination, SkeletonRows, Tabs, TextArea, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Filter = 'pending' | 'approved' | 'rejected' | 'all'
const TONE = { pending: 'warn', approved: 'accent', rejected: 'danger' } as const
const PLAN = { seeker: 'Job seeker', freelancer: 'Freelancer', client: 'Client', recruiter: 'Recruiter' } as const

export default function AdminPayments() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminPayment[] | null>(null)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setRows(null)
    try {
      const r = await adminListPayments({ status: filter === 'all' ? undefined : filter, page })
      setRows(r.data)
      setPages(r.total_pages || 1)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load payments.'))
      setRows([])
    }
  }, [filter, page])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <SEO title="Payments | Admin | SafeApply.AI" description="Manual payments." path="/admin/payments" noindex />
      <PageContainer>
        <PageHeader title="Payments" description="Match each transaction ID and amount with your statement before approving. Rejections need a reason." />
        <Tabs
          label="Filter payments"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          items={[
            { value: 'pending', label: 'To review' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'all', label: 'All' },
          ]}
          className="self-start"
        />
        {error && <Alert>{error}</Alert>}
        {!rows ? (
          <Card>
            <SkeletonRows rows={4} />
          </Card>
        ) : rows.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon="receipt_long" title="Nothing here" body="New payments show up here and in your notifications." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((p) => (
              <Row key={p.id} p={p} onDone={(status) => setRows((rs) => rs && (filter === 'pending' ? rs.filter((x) => x.id !== p.id) : rs.map((x) => (x.id === p.id ? { ...x, status } : x))))} />
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={pages} onChange={setPage} />
      </PageContainer>
    </>
  )
}

function Row({ p, onDone }: { p: AdminPayment; onDone: (s: AdminPayment['status']) => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)

  async function act(action: 'approve' | 'reject') {
    if (busy) return
    if (action === 'reject' && note.trim().length < 5) return toast.error('Add a short reason for the user.')
    setBusy(action)
    try {
      await adminReviewPayment(p.id, action, note.trim())
      toast.success(action === 'approve' ? 'Approved, plan extended' : 'Rejected')
      onDone(action === 'approve' ? 'approved' : 'rejected')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t update the payment.'))
      setBusy(null)
    }
  }

  return (
    <li className="bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold tabular">
            {pkr(p.amount_pkr)} · {METHOD_LABEL[p.method]} · {PLAN[p.plan_key]}
          </p>
          <p className="text-sm text-muted break-all">{p.user ? `${p.user.name} · ${p.user.email}` : 'Deleted user'}</p>
        </div>
        <Badge tone={TONE[p.status]}>{p.status}</Badge>
      </div>
      <dl className="grid sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Transaction ID</dt>
          <dd className="font-mono break-all">{p.transaction_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Sender name</dt>
          <dd className="break-words">{p.sender_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Submitted</dt>
          <dd className="tabular">{formatDate(p.created_at)}</dd>
        </div>
      </dl>
      {p.admin_note && <p className="text-sm text-muted border-l-2 border-line pl-3">{p.admin_note}</p>}
      {p.status === 'pending' && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 border-t border-line pt-4">
          <TextArea aria-label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Note to the user (required to reject)" className="flex-1" />
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" onClick={() => act('reject')} loading={busy === 'reject'} disabled={Boolean(busy)} className="hover:text-danger">
              Reject
            </Button>
            <Button onClick={() => act('approve')} loading={busy === 'approve'} disabled={Boolean(busy)}>
              Approve 30 days
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
