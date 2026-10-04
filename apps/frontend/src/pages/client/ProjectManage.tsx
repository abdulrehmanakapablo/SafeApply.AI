// FILE: src/pages/client/ProjectManage.tsx
// ROUTE: /client/projects/:id
// PURPOSE: Review proposals, shortlist or decline, and hire with milestones
//          that add up exactly to the agreed price.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { ProjectBadge, ProjectFacts, ProposalBadge, Rating } from '../../components/freelance/Bits'
import { LevelChip } from '../../components/trust/TrustBits'
import { getClientProject, hireProposal, money, setProposalStatus, updateProject, type ClientProjectDetail, type ClientProposal } from '../../api/freelance'
import { Alert, Button, ButtonLink, Card, Dialog, EmptyState, Icon, PageContainer, PageHeader, Skeleton, Tabs, cn, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function ProjectManage() {
  const { id = '' } = useParams<{ id: string }>()
  const [p, setP] = useState<ClientProjectDetail | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [hiring, setHiring] = useState<ClientProposal | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  const load = useCallback(() => {
    getClientProject(id)
      .then((r) => setP(r.data))
      .catch((e) => setError(apiError(e, 'Project not found.')))
  }, [id])
  useEffect(load, [load])

  const lists = useMemo(() => {
    const all = p?.proposals || []
    return { active: all.filter((x) => x.status === 'pending' || x.status === 'shortlisted').sort((a, b) => Number(b.status === 'shortlisted') - Number(a.status === 'shortlisted') || b.freelancer.trust_level - a.freelancer.trust_level), closed: all.filter((x) => !['pending', 'shortlisted'].includes(x.status)) }
  }, [p])

  async function decide(prop: ClientProposal, status: 'shortlisted' | 'declined') {
    try {
      await setProposalStatus(prop.id, status)
      setP((cur) => cur && { ...cur, proposals: cur.proposals.map((x) => (x.id === prop.id ? { ...x, status } : x)) })
      toast.success(status === 'shortlisted' ? 'Shortlisted' : 'Declined')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t update the proposal.'))
    }
  }

  async function setStatus(status: 'open' | 'closed') {
    if (!p || statusBusy) return
    setStatusBusy(true)
    try {
      const r = await updateProject(p.id, { status })
      setP({ ...p, ...r.data })
      toast.success(status === 'open' ? 'Project is live' : 'Project closed')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t change the project.'))
    } finally {
      setStatusBusy(false)
    }
  }

  if (error) {
    return (
      <PageContainer>
        <Card padded={false}>
          <EmptyState icon="folder_off" title="Project not found" body={error} action={<ButtonLink to="/client/projects">Back to projects</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }
  if (!p) {
    return (
      <PageContainer>
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-64 rounded-[16px]" />
      </PageContainer>
    )
  }

  const canHire = p.status === 'open'
  const shown = lists[tab]
  return (
    <>
      <SEO title={`${p.title} | Client | SafeApply.AI`} description="Project proposals." path={`/client/projects/${id}`} noindex />
      <PageContainer>
        <PageHeader
          back={{ to: '/client/projects', label: 'My projects' }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{p.title}</span>
              <ProjectBadge status={p.status} />
            </span>
          }
          description={<ProjectFacts p={p} />}
          actions={
            <>
              {p.status !== 'draft' && (
                <ButtonLink to={`/projects/${p.id}`} variant="ghost" icon="visibility">
                  Public page
                </ButtonLink>
              )}
              {(p.status === 'draft' || p.status === 'open') && (
                <ButtonLink to={`/client/projects/${p.id}/edit`} variant="secondary" icon="edit">
                  Edit
                </ButtonLink>
              )}
              {p.status === 'open' && (
                <Button variant="secondary" onClick={() => setStatus('closed')} loading={statusBusy}>
                  Close
                </Button>
              )}
              {(p.status === 'draft' || p.status === 'closed') && (
                <Button icon="play_arrow" onClick={() => setStatus('open')} loading={statusBusy}>
                  {p.status === 'draft' ? 'Publish' : 'Reopen'}
                </Button>
              )}
            </>
          }
        />

        {p.contract && (
          <Alert tone="accent">
            You hired someone for this project.{' '}
            <Link to={`/client/contracts/${p.contract.id}`} className="underline underline-offset-4 font-medium">
              Open the contract
            </Link>
          </Alert>
        )}

        <Tabs
          label="Proposals"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'active', label: 'To review', count: lists.active.length },
            { value: 'closed', label: 'Closed', count: lists.closed.length },
          ]}
          className="self-start"
        />

        {shown.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="send"
              title={tab === 'active' ? 'No proposals to review' : 'Nothing here'}
              body={tab === 'active' ? (p.status === 'open' ? 'Proposals appear here as freelancers send them.' : 'Publish the project to start receiving proposals.') : undefined}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {shown.map((x) => (
              <ProposalCard key={x.id} x={x} currency={p.currency} canAct={canHire} onDecide={decide} onHire={() => setHiring(x)} />
            ))}
          </ul>
        )}
      </PageContainer>
      {hiring && <HireDialog proposal={hiring} currency={p.currency} onClose={() => setHiring(null)} />}
    </>
  )
}

function ProposalCard({ x, currency, canAct, onDecide, onHire }: { x: ClientProposal; currency: string; canAct: boolean; onDecide: (x: ClientProposal, s: 'shortlisted' | 'declined') => void; onHire: () => void }) {
  const [open, setOpen] = useState(false)
  const long = x.cover_letter.length > 360
  const active = canAct && (x.status === 'pending' || x.status === 'shortlisted')
  return (
    <li className={cn('bg-surface border rounded-[var(--radius-card)] p-5 flex flex-col gap-4', x.status === 'shortlisted' ? 'border-warn/40' : 'border-line')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/freelancers/${x.freelancer_id}`} className="font-semibold hover:text-accent break-words">
            {x.freelancer.name}
          </Link>
          {x.freelancer.headline && <p className="text-sm text-muted break-words">{x.freelancer.headline}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <LevelChip level={x.freelancer.trust_level} />
            <Rating rating={x.freelancer.rating} reviews={x.freelancer.reviews} />
            <span className="text-xs text-muted tabular">{x.freelancer.completed} completed</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular">{money(x.amount, currency)}</p>
          <p className="text-xs text-muted tabular">
            {x.duration_days} day{x.duration_days === 1 ? '' : 's'} · {relativeDays(x.created_at)}
          </p>
        </div>
      </div>
      <div>
        <p className="text-sm text-muted leading-relaxed whitespace-pre-line break-words">{open || !long ? x.cover_letter : `${x.cover_letter.slice(0, 340).trimEnd()}…`}</p>
        {long && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-xs underline underline-offset-4">
            {open ? 'Show less' : 'Read all'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <ProposalBadge status={x.status} />
        {active && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => onDecide(x, 'declined')} className="hover:text-danger">
              Decline
            </Button>
            {x.status === 'pending' && (
              <Button size="sm" variant="secondary" icon="star" onClick={() => onDecide(x, 'shortlisted')}>
                Shortlist
              </Button>
            )}
            <Button size="sm" icon="handshake" onClick={onHire}>
              Hire
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

interface Row {
  key: number
  title: string
  amount: string
  due_date: string
}

function HireDialog({ proposal, currency, onClose }: { proposal: ClientProposal; currency: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([{ key: 1, title: 'Complete the project', amount: String(proposal.amount), due_date: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const total = rows.reduce((n, r) => n + (parseInt(r.amount.replace(/[^0-9]/g, ''), 10) || 0), 0)
  const diff = proposal.amount - total
  const today = new Date().toISOString().slice(0, 10)

  const patch = (key: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [k]: v } : r)))

  async function hire() {
    if (busy) return
    if (rows.some((r) => r.title.trim().length < 3)) return setError('Give each milestone a short title.')
    if (rows.some((r) => !(parseInt(r.amount, 10) > 0))) return setError('Each milestone needs an amount.')
    if (diff !== 0) return setError(`Milestones must add up to ${money(proposal.amount, currency)}.`)
    setError('')
    setBusy(true)
    try {
      const res = await hireProposal(
        proposal.id,
        rows.map((r) => ({ title: r.title.trim(), amount: parseInt(r.amount, 10), due_date: r.due_date || null })),
      )
      toast.success(`${proposal.freelancer.name} is hired`)
      navigate(`/client/contracts/${res.data.contract_id}`)
    } catch (e) {
      setError(apiError(e, 'Couldn’t hire this freelancer.'))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      size="lg"
      title={`Hire ${proposal.freelancer.name}`}
      description={`Split the agreed ${money(proposal.amount, currency)} into milestones. ${proposal.freelancer.name.split(' ')[0]} hands in each one and you approve it.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button icon="handshake" onClick={hire} loading={busy} disabled={diff !== 0}>
            Hire and start contract
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_110px] sm:grid-cols-[1fr_120px_150px_36px] gap-2 items-end">
            <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
              <span className="text-xs text-muted">Milestone {i + 1}</span>
              <input value={r.title} maxLength={140} onChange={(e) => patch(r.key, 'title', e.target.value)} className="h-10 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm focus:outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Amount</span>
              <input inputMode="numeric" value={r.amount} onChange={(e) => patch(r.key, 'amount', e.target.value.replace(/\D/g, '').slice(0, 8))} className="h-10 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm tabular focus:outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Due (optional)</span>
              <input type="date" min={today} value={r.due_date} onChange={(e) => patch(r.key, 'due_date', e.target.value)} className="h-10 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm focus:outline-none focus:border-accent" />
            </label>
            <button
              type="button"
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              aria-label={`Remove milestone ${i + 1}`}
              className="h-10 w-9 inline-flex items-center justify-center rounded-[8px] text-muted hover:text-danger hover:bg-line disabled:opacity-30 disabled:pointer-events-none"
            >
              <Icon name="delete" className="text-[18px]" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button
            size="sm"
            variant="ghost"
            icon="add"
            disabled={rows.length >= 20}
            onClick={() => setRows((rs) => [...rs, { key: Math.max(...rs.map((x) => x.key)) + 1, title: '', amount: diff > 0 ? String(diff) : '', due_date: '' }])}
          >
            Add milestone
          </Button>
          <p className={cn('text-sm tabular', diff === 0 ? 'text-accent' : 'text-warn')}>
            {money(total, currency)} of {money(proposal.amount, currency)}
            {diff !== 0 && ` (${diff > 0 ? `${money(diff, currency)} left` : `${money(-diff, currency)} over`})`}
          </p>
        </div>
        {error && <Alert>{error}</Alert>}
        <p className="text-xs text-muted">Hiring declines the other proposals on this project. Amounts are a record of what you agreed; payment is arranged between you.</p>
      </div>
    </Dialog>
  )
}
