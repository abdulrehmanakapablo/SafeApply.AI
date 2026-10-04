// FILE: src/pages/admin/Trust.tsx
// ROUTE: /admin/trust
// PURPOSE: See computed trust levels and, rarely, override one. Every
//          override needs a reason and is written to an audit log.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { LevelChip } from '../../components/trust/TrustBits'
import { adminSetTrust, adminTrustAudit, adminTrustList, type TrustRow } from '../../api/progress'
import { LEVELS } from '../../lib/trust'
import { Alert, Button, Card, EmptyState, Icon, PageContainer, PageHeader, Pagination, SkeletonRows, Tabs, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Kind = 'user' | 'company'
type Audit = Awaited<ReturnType<typeof adminTrustAudit>>['data']

export default function AdminTrust() {
  const [kind, setKind] = useState<Kind>('company')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<TrustRow[] | null>(null)
  const [pages, setPages] = useState(1)
  const [audit, setAudit] = useState<Audit>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setRows(null)
    try {
      const [r, a] = await Promise.all([adminTrustList({ type: kind, q: q.trim() || undefined, page }), adminTrustAudit()])
      setRows(r.data)
      setPages(r.total_pages || 1)
      setAudit(a.data)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load trust levels.'))
      setRows([])
    }
  }, [kind, q, page])
  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <>
      <SEO title="Trust | Admin | SafeApply.AI" description="Trust levels." path="/admin/trust" noindex />
      <PageContainer>
        <PageHeader title="Trust levels" description="Levels are computed hourly. Override only with evidence; the reason is logged." />
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            label="Kind"
            value={kind}
            onChange={(v) => {
              setKind(v)
              setPage(1)
            }}
            items={[
              { value: 'company', label: 'Companies' },
              { value: 'user', label: 'Freelancers and clients' },
            ]}
          />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" maxLength={80} className="h-9 px-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm" />
        </div>
        {error && <Alert>{error}</Alert>}
        <Card padded={false} className="overflow-hidden">
          {!rows ? (
            <div className="p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon="shield" title="Nothing here" />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <Row key={r.id} r={r} kind={kind} onSaved={load} />
              ))}
            </ul>
          )}
        </Card>
        <Pagination page={page} totalPages={pages} onChange={setPage} />
        <Card padded={false}>
          <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Recent overrides</div>
          {audit.length === 0 ? (
            <p className="p-5 text-sm text-muted">No overrides yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {audit.map((a) => (
                <li key={a.id} className="px-5 py-3 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-muted tabular">{formatDate(a.created_at)}</span>
                  <span>
                    {a.subject_type} {a.subject_id.slice(0, 8)}: {a.old_override ?? 'auto'} → {a.new_override ?? 'auto'}
                  </span>
                  <span className="text-muted break-words">{a.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageContainer>
    </>
  )
}

function Row({ r, kind, onSaved }: { r: TrustRow; kind: Kind; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(r.trust_override === null ? 'auto' : String(r.trust_override))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (reason.trim().length < 3) return toast.error('Add a reason.')
    setBusy(true)
    try {
      await adminSetTrust(kind, r.id, level === 'auto' ? null : Number(level), reason.trim())
      toast.success('Saved')
      setOpen(false)
      onSaved()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-5 py-3.5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{r.name || r.full_name}</p>
          <p className="text-xs text-muted truncate">{kind === 'user' ? `${r.role} · ${r.email}` : r.slug}</p>
        </div>
        <LevelChip level={r.trust_level} link={false} />
        {r.trust_override !== null && <span className="text-[11px] text-warn">override</span>}
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-muted hover:text-fg inline-flex items-center gap-1">
          <Icon name="tune" className="text-[16px]" />
          Override
        </button>
      </div>
      {open && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 px-2 bg-ink border border-line rounded-[var(--radius-input)] text-sm">
            <option value="auto">Automatic</option>
            {LEVELS.map((l) => (
              <option key={l.n} value={l.n}>
                {l.n}: {l.name}
              </option>
            ))}
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="Reason (logged)" className="flex-1 h-9 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm" />
          <Button size="sm" onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      )}
    </li>
  )
}
