// FILE: src/pages/admin/Disputes.tsx
// ROUTE: /admin/disputes
// PURPOSE: Review disputes. Accepting a ghost-flag dispute clears that job
//          from the hiring record for good. Penalties and levels are then
//          changed from their own admin pages.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { DISPUTE_LABEL, adminListDisputes, adminResolveDispute, type AdminDispute, type Dispute } from '../../api/growth'
import { apiError } from '../../lib/axios'
import { Alert, Button, Card, EmptyState, Icon, PageContainer, PageHeader, Pagination, SkeletonRows, Tabs, formatDate } from '../../components/ui'

export default function AdminDisputes() {
  const [status, setStatus] = useState<Dispute['status']>('open')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminDispute[] | null>(null)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setRows(null)
    try {
      const r = await adminListDisputes(status, page)
      setRows(r.data)
      setPages(r.total_pages || 1)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load disputes.'))
      setRows([])
    }
  }, [status, page])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <SEO title="Disputes | Admin | SafeApply.AI" description="Disputes." path="/admin/disputes" noindex />
      <PageContainer>
        <PageHeader title="Disputes" description="Decide on evidence. The person sees your note." />
        <Tabs
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
          items={[
            { value: 'open', label: 'Open' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
        {error && <Alert>{error}</Alert>}
        {!rows ? (
          <Card>
            <SkeletonRows rows={3} />
          </Card>
        ) : rows.length === 0 ? (
          <Card padded={false}>
            <EmptyState icon="gavel" title="Nothing here" />
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((r) => (
              <Row key={r.id} r={r} onDone={load} />
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={pages} onChange={setPage} />
      </PageContainer>
    </>
  )
}

function Row({ r, onDone }: { r: AdminDispute; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)

  async function decide(accept: boolean) {
    if (!accept && note.trim().length < 5) return toast.error('Add a short note explaining the rejection.')
    setBusy(accept ? 'accept' : 'reject')
    try {
      await adminResolveDispute(r.id, accept, note.trim())
      toast.success(accept ? 'Accepted' : 'Rejected')
      onDone()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold">{DISPUTE_LABEL[r.subject_type]}</span>
          {r.company && (
            <Link to={`/companies/${r.company.slug}/hiring-record`} className="text-accent hover:underline underline-offset-4">
              {r.company.name}
            </Link>
          )}
          <span className="text-muted">
            {r.user?.full_name || 'User'} · {r.user?.email} · {r.user?.role}
          </span>
          <span className="text-xs text-muted ml-auto tabular">{formatDate(r.created_at)}</span>
        </div>
        {r.job && (
          <p className="text-xs text-muted bg-ink border border-line rounded-[8px] px-3 py-2 tabular">
            Job “{r.job.title}” ({r.job.status}), posted {formatDate(r.job.created_at)}: {r.job.apps_count} applied, {r.job.opened_count} opened, {r.job.replied_count} replied
          </p>
        )}
        <p className="text-sm whitespace-pre-line break-words">{r.reason}</p>
        {r.evidence_url && (
          <a href={r.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-accent inline-flex items-center gap-1 w-fit hover:underline underline-offset-4 break-all">
            <Icon name="open_in_new" className="text-[16px]" />
            Evidence
          </a>
        )}
        {r.status === 'open' ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} placeholder="Note to the person" aria-label="Note" className="flex-1 h-9 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm" />
            <Button size="sm" onClick={() => decide(true)} loading={busy === 'accept'} disabled={busy !== null}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={() => decide(false)} loading={busy === 'reject'} disabled={busy !== null}>
              Reject
            </Button>
          </div>
        ) : (
          r.admin_note && <p className="text-sm text-muted border-l-2 border-line pl-3">Note: {r.admin_note}</p>
        )}
        {r.status === 'open' && r.subject_type !== 'ghost_flag' && r.subject_type !== 'other' && (
          <p className="text-xs text-muted">
            Accepting records the decision. Change the {r.subject_type === 'penalty' ? 'penalty in Companies' : 'level in Trust'}{' '}
            <Link to={r.subject_type === 'penalty' ? '/admin/companies' : '/admin/trust'} className="underline underline-offset-4">
              here
            </Link>
            .
          </p>
        )}
      </Card>
    </li>
  )
}
