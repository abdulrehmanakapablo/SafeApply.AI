// FILE: src/pages/admin/CompanyVerification.tsx
// ROUTE: /admin/companies
// BACKEND: GET /api/admin/companies?status=&page=, PATCH /api/admin/companies/:id
// PURPOSE: Approve or reject recruiter companies. Only verified companies can
//          publish jobs, reply to reviews, or move applicants.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { getAdminCompanies, setCompanyPenalty, setCompanyVerification, type AdminCompany } from '../../api/admin'
import { Alert, Badge, Button, Card, EmptyState, PageContainer, PageHeader, Pagination, SkeletonRows, Tabs, TextArea, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Filter = 'pending' | 'verified' | 'rejected' | 'all'
const TONE = { pending: 'warn', verified: 'accent', rejected: 'danger', unverified: 'neutral' } as const

const safeHref = (url: string | null) => {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

export default function CompanyVerification() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminCompany[] | null>(null)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    try {
      const res = await getAdminCompanies({ status: filter === 'all' ? undefined : filter, page })
      setRows(res.data || [])
      setTotalPages(res.total_pages || 1)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load companies.'))
      setRows([])
    }
  }, [filter, page])

  useEffect(() => {
    void load()
  }, [load])

  const onDone = (id: string, status: AdminCompany['verification_status'], note: string | null) =>
    setRows((p) => (p ? (filter === 'all' ? p.map((c) => (c.id === id ? { ...c, verification_status: status, verification_note: note } : c)) : p.filter((c) => c.id !== id)) : p))

  return (
    <>
      <SEO title="Companies | Admin | SafeApply.AI" description="Company verification." path="/admin/companies" noindex />
      <PageContainer>
        <PageHeader title="Company verification" description="Check the website, the email domain and the details before approving. Approved companies can publish jobs." />
        <Tabs
          label="Filter companies"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          items={[
            { value: 'pending', label: 'Pending' },
            { value: 'verified', label: 'Verified' },
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
            <EmptyState icon="domain_verification" title="Nothing to review" body="New company requests show up here." />
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((c) => (
              <CompanyRow key={c.id} c={c} onDone={onDone} />
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </PageContainer>
    </>
  )
}

function CompanyRow({ c, onDone }: { c: AdminCompany; onDone: (id: string, s: AdminCompany['verification_status'], note: string | null) => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'verified' | 'rejected' | null>(null)
  const href = safeHref(c.website)

  async function act(status: 'verified' | 'rejected') {
    if (busy) return
    if (status === 'rejected' && note.trim().length < 5) return toast.error('Add a short reason so the recruiter can fix it.')
    setBusy(status)
    try {
      const res = await setCompanyVerification(c.id, status, note.trim())
      if (!res.success) throw new Error(res.error)
      toast.success(status === 'verified' ? `${c.name} verified` : `${c.name} rejected`)
      onDone(c.id, status, note.trim() || null)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t update the company.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <li className="bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold break-words">{c.name}</p>
          <p className="text-xs text-muted">Updated {formatDate(c.updated_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={c.domain_match ? 'accent' : 'warn'}>{c.domain_match ? 'Email domain matches' : 'Domain mismatch'}</Badge>
          <Badge tone={TONE[c.verification_status]}>{c.verification_status}</Badge>
        </div>
      </div>

      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-2 min-w-0">
          <dt className="text-muted shrink-0">Website</dt>
          <dd className="min-w-0 truncate">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent underline-offset-4 hover:underline">
                {c.domain || href}
              </a>
            ) : (
              'None'
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Industry</dt>
          <dd>{c.industry || 'Not set'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Size</dt>
          <dd>{c.size || 'Not set'}</dd>
        </div>
        <div className="flex gap-2 min-w-0">
          <dt className="text-muted shrink-0">Locations</dt>
          <dd className="truncate">{c.locations || 'Not set'}</dd>
        </div>
      </dl>
      {c.about && <p className="text-sm text-muted leading-relaxed whitespace-pre-line break-words line-clamp-4">{c.about}</p>}

      <div>
        <p className="text-xs text-muted mb-1.5">Members</p>
        <ul className="flex flex-wrap gap-2">
          {c.members.length ? (
            c.members.map((m) => (
              <li key={m.email} className="text-xs bg-line rounded-full px-2.5 py-1">
                {m.full_name} · {m.email}
              </li>
            ))
          ) : (
            <li className="text-xs text-muted">No members</li>
          )}
        </ul>
      </div>
      {c.verification_note && <Alert tone="warn">Last note: {c.verification_note}</Alert>}
      {c.verification_status === 'verified' && <PenaltyBox c={c} />}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end border-t border-line pt-4">
          <TextArea aria-label="Note to the recruiter" rows={2} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} placeholder="Note to the recruiter (required to reject)" className="flex-1" />
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" onClick={() => act('rejected')} loading={busy === 'rejected'} disabled={Boolean(busy) || c.verification_status === 'rejected'} className="hover:text-danger">
              Reject
            </Button>
            <Button onClick={() => act('verified')} loading={busy === 'verified'} disabled={Boolean(busy) || c.verification_status === 'verified'}>
              Approve
            </Button>
          </div>
        </div>
    </li>
  )
}

const LEVELS = [
  { value: 'auto', label: 'Automatic (ghosting rules)' },
  { value: '0', label: 'No penalty (manual)' },
  { value: '1', label: '1: one open job at a time' },
  { value: '2', label: '2: public warning' },
  { value: '3', label: '3: suspended from posting' },
]

function PenaltyBox({ c }: { c: AdminCompany }) {
  const score = Array.isArray(c.company_scores) ? c.company_scores[0] : c.company_scores
  const [level, setLevel] = useState(c.penalty_source === 'admin' ? String(c.penalty_level) : 'auto')
  const [reason, setReason] = useState(c.penalty_source === 'admin' ? c.penalty_reason || '' : '')
  const [busy, setBusy] = useState(false)

  async function save() {
    const n = level === 'auto' ? null : Number(level)
    if (n && reason.trim().length < 5) return toast.error('Add a reason the company will see.')
    setBusy(true)
    try {
      const r = await setCompanyPenalty(c.id, n, reason.trim())
      if (!r.success) throw new Error(r.error)
      toast.success('Penalty saved')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save the penalty.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-line pt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tabular">
        <span>{score?.applications ?? 0} applications</span>
        <span>CVs opened: {score?.opened_pct ?? '–'}%</span>
        <span>Replied in 7d: {score?.replied_7d_pct ?? '–'}%</span>
        <span className={score?.ghost_jobs_90d ? 'text-danger' : ''}>Ghost jobs (90d): {score?.ghost_jobs_90d ?? 0}</span>
        <span>
          Now: level {c.penalty_level} ({c.penalty_source || 'auto'}){c.suspended ? ', suspended' : ''}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Penalty
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 px-2 bg-ink border border-line rounded-[var(--radius-input)] text-sm text-fg">
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {level !== 'auto' && level !== '0' && (
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} placeholder="Reason shown to the company" className="flex-1 h-9 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm" />
        )}
        <Button size="sm" variant="secondary" onClick={save} loading={busy}>
          Save penalty
        </Button>
      </div>
    </div>
  )
}
