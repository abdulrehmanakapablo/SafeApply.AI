// FILE: src/pages/freelance/Contract.tsx
// ROUTES: /freelancer/contracts/:id, /client/contracts/:id
// PURPOSE: One contract for both sides. Freelancer hands in each milestone;
//          client approves it or asks for changes. Messages, cancellation
//          (only before any work is handed in) and reviews at the end.

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import ContractChat from '../../components/freelance/ContractChat'
import { ContactCard, PaymentLogPanel } from '../../components/freelance/ContractExtras'
import { ContractBadge, MilestoneBadge } from '../../components/freelance/Bits'
import { Stars } from '../../components/ui/Stars'
import {
  approveMilestone,
  cancelContract,
  getContract,
  money,
  requestRevision,
  reviewContract,
  submitMilestone,
  type ContractDetail,
  type Milestone,
} from '../../api/freelance'
import { Alert, Button, ButtonLink, Card, CardHeader, ConfirmDialog, Dialog, EmptyState, Icon, PageContainer, PageHeader, Skeleton, TextArea, cn, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function ContractPage() {
  const { id = '' } = useParams<{ id: string }>()
  const urlSide = useLocation().pathname.startsWith('/client') ? 'client' : 'freelancer'
  const [c, setC] = useState<ContractDetail | null>(null)
  const [error, setError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setC((await getContract(id)).data)
    } catch (e) {
      setError(apiError(e, 'Contract not found.'))
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="handshake" title="Contract not found" body={error} action={<ButtonLink to={`/${urlSide}/contracts`}>Back to contracts</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }
  if (!c) {
    return (
      <PageContainer>
        <Skeleton className="h-9 w-72" />
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          <Skeleton className="h-80 rounded-[16px]" />
          <Skeleton className="h-80 rounded-[16px]" />
        </div>
      </PageContainer>
    )
  }
  // Opened from the other portal's URL: send them to their own side.
  if (c.side !== 'admin' && c.side !== urlSide) return <Navigate to={`/${c.side}/contracts/${c.id}`} replace />

  const approved = c.milestones.filter((m) => m.status === 'approved').reduce((n, m) => n + m.amount, 0)
  const pct = Math.round((approved / c.amount) * 100)
  const other = c.side === 'client' ? c.freelancer.name : c.client.name
  const canCancel = c.side !== 'admin' && c.status === 'active' && !c.milestones.some((m) => m.status === 'submitted' || m.status === 'approved')
  const myReview = c.side !== 'admin' && c.reviews.find((r) => r.by === c.side)
  const updateMilestone = (m: Milestone, patch: Partial<Milestone>) => setC((cur) => cur && { ...cur, milestones: cur.milestones.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) })

  return (
    <>
      <SEO title={`${c.title} | Contract | SafeApply.AI`} description="Contract." path={`/${urlSide}/contracts/${id}`} noindex />
      <PageContainer>
        <PageHeader
          back={{ to: `/${c.side === 'admin' ? urlSide : c.side}/contracts`, label: 'Contracts' }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{c.title}</span>
              <ContractBadge status={c.status} />
            </span>
          }
          description={
            <>
              {c.side === 'client' ? (
                <>
                  Freelancer:{' '}
                  <Link to={`/freelancers/${c.freelancer.id}`} className="text-fg hover:text-accent">
                    {c.freelancer.name}
                  </Link>
                </>
              ) : (
                <>Client: {other}</>
              )}{' '}
              · started {formatDate(c.created_at)}
            </>
          }
          actions={
            <ButtonLink to={`/projects/${c.project_id}`} variant="ghost" icon="description">
              Project
            </ButtonLink>
          }
        />
        {c.side === 'admin' && <Alert tone="warn">You’re viewing this contract as an admin. Actions are disabled.</Alert>}
        {c.status === 'cancelled' && (
          <Alert>
            Cancelled by the {c.cancelled_by_side}. {c.cancel_reason && <span className="break-words">Reason: {c.cancel_reason}</span>}
          </Alert>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <Card>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">Approved</p>
                  <p className="text-2xl font-semibold tabular">
                    {money(approved, c.currency)} <span className="text-base text-muted font-normal">of {money(c.amount, c.currency)}</span>
                  </p>
                </div>
                <span className="text-sm text-muted tabular">{pct}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Approved share of the contract">
                <div className="h-full bg-accent rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-xs text-muted">Amounts are a record of what you agreed. Pay however suits you, and log it below so both sides have a record.</p>
            </Card>

            <Card padded={false}>
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Milestones</div>
              <ol className="divide-y divide-line">
                {c.milestones.map((m) => (
                  <MilestoneRow key={m.id} m={m} c={c} onChange={updateMilestone} onCompleted={load} />
                ))}
              </ol>
            </Card>

            <PaymentLogPanel c={c} />

            {c.status === 'completed' && (
              <Card>
                <CardHeader title="Reviews" className="mb-3" />
                {c.reviews.length > 0 && (
                  <ul className="flex flex-col gap-4 mb-5">
                    {c.reviews.map((r) => (
                      <li key={r.by}>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{r.by === c.side ? 'Your review' : `From the ${r.by}`}</span>
                          <Stars rating={r.rating} size={14} />
                        </div>
                        <p className="mt-1 text-sm text-muted leading-relaxed whitespace-pre-line break-words">{r.comment}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {c.side !== 'admin' && !myReview && <ReviewForm contractId={c.id} other={other} onDone={load} />}
              </Card>
            )}

            {canCancel && (
              <button type="button" onClick={() => setCancelOpen(true)} className="self-start text-xs text-muted hover:text-danger underline underline-offset-4">
                Cancel this contract
              </button>
            )}
          </div>

          <aside className="lg:sticky lg:top-20 flex flex-col gap-6">
            <ContactCard c={c} />
            <Card padded={false}>
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Messages with {other.split(' ')[0]}</div>
              <ContractChat contractId={c.id} readOnly={c.side === 'admin'} />
            </Card>
          </aside>
        </div>
      </PageContainer>
      {cancelOpen && <CancelDialog contractId={c.id} onClose={() => setCancelOpen(false)} onDone={load} />}
    </>
  )
}

function MilestoneRow({ m, c, onChange, onCompleted }: { m: Milestone; c: ContractDetail; onChange: (m: Milestone, p: Partial<Milestone>) => void; onCompleted: () => void }) {
  const [mode, setMode] = useState<'submit' | 'revision' | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const active = c.status === 'active'
  const canSubmit = active && c.side === 'freelancer' && (m.status === 'pending' || m.status === 'revision')
  const canReview = active && c.side === 'client' && m.status === 'submitted'

  async function run(kind: 'submit' | 'revision' | 'approve') {
    if (busy) return
    if (kind === 'revision' && text.trim().length < 5) return toast.error('Say what needs to change.')
    setBusy(true)
    try {
      if (kind === 'submit') {
        await submitMilestone(c.id, m.id, text.trim())
        onChange(m, { status: 'submitted', note: text.trim() || null, submitted_at: new Date().toISOString() })
        toast.success('Work handed in')
      } else if (kind === 'revision') {
        await requestRevision(c.id, m.id, text.trim())
        onChange(m, { status: 'revision', feedback: text.trim() })
        toast.success('Changes requested')
      } else {
        const r = await approveMilestone(c.id, m.id)
        if (r.data.contract_status === 'completed') {
          toast.success('Contract complete')
          onCompleted()
        } else {
          onChange(m, { status: 'approved', approved_at: new Date().toISOString() })
          toast.success('Milestone approved')
        }
      }
      setMode(null)
      setText('')
    } catch (e) {
      toast.error(apiError(e, 'That didn’t work. Try again.'))
    } finally {
      setBusy(false)
      setConfirmApprove(false)
    }
  }

  return (
    <li className="p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={cn('mt-0.5 w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center shrink-0', m.status === 'approved' ? 'bg-accent text-ink' : 'bg-line text-muted')}>
            {m.status === 'approved' ? <Icon name="check" className="text-[16px]" /> : m.position}
          </span>
          <div className="min-w-0">
            <p className="font-medium break-words">{m.title}</p>
            <p className="text-xs text-muted tabular">
              {money(m.amount, c.currency)}
              {m.due_date && ` · due ${formatDate(m.due_date)}`}
            </p>
          </div>
        </div>
        <MilestoneBadge status={m.status} />
      </div>
      {m.note && (m.status === 'submitted' || m.status === 'approved') && (
        <p className="ml-9 text-sm text-muted border-l-2 border-line pl-3 whitespace-pre-line break-words">
          <span className="text-xs block text-fg/80 mb-0.5">Handed in</span>
          {m.note}
        </p>
      )}
      {m.feedback && m.status === 'revision' && (
        <p className="ml-9 text-sm border-l-2 border-danger/60 pl-3 whitespace-pre-line break-words">
          <span className="text-xs block text-danger mb-0.5">Changes requested</span>
          {m.feedback}
        </p>
      )}

      {mode ? (
        <div className="ml-9 flex flex-col gap-2">
          <TextArea
            aria-label={mode === 'submit' ? 'Note for the client' : 'What needs to change'}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            placeholder={mode === 'submit' ? 'What you delivered and where to find it (links are fine).' : 'What needs to change before you approve.'}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => run(mode)} loading={busy}>
              {mode === 'submit' ? 'Hand in' : 'Send back'}
            </Button>
          </div>
        </div>
      ) : canSubmit ? (
        <Button size="sm" icon="upload" className="ml-9 self-start" onClick={() => setMode('submit')}>
          Hand in work
        </Button>
      ) : canReview ? (
        <div className="ml-9 flex flex-wrap gap-2">
          <Button size="sm" icon="check" onClick={() => setConfirmApprove(true)}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setMode('revision')}>
            Ask for changes
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmApprove}
        onClose={() => !busy && setConfirmApprove(false)}
        onConfirm={() => run('approve')}
        loading={busy}
        tone="primary"
        title={`Approve “${m.title}”?`}
        body={`This confirms the work is done and records ${money(m.amount, c.currency)} as approved. It can’t be undone.`}
        confirmLabel="Approve"
      />
    </li>
  )
}

function CancelDialog({ contractId, onClose, onDone }: { contractId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    if (reason.trim().length < 5 || busy) return toast.error('Add a short reason.')
    setBusy(true)
    try {
      await cancelContract(contractId, reason.trim())
      toast.success('Contract cancelled')
      onClose()
      onDone()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t cancel the contract.'))
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title="Cancel this contract?"
      description="Only possible before any work is handed in. The other side is notified and the project is closed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep contract
          </Button>
          <Button variant="danger" onClick={go} loading={busy}>
            Cancel contract
          </Button>
        </>
      }
    >
      <TextArea label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 1000))} />
    </Dialog>
  )
}

function ReviewForm({ contractId, other, onDone }: { contractId: string; other: string; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (busy) return
    if (!rating) return toast.error('Pick a rating.')
    if (comment.trim().length < 20) return toast.error('Write at least 20 characters.')
    setBusy(true)
    try {
      await reviewContract(contractId, rating, comment.trim())
      toast.success('Review posted')
      onDone()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t post the review.'))
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-sm font-medium">How was working with {other.split(' ')[0]}?</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className="p-0.5">
            <Icon name="star" fill={n <= rating} className={cn('text-[26px]', n <= rating ? 'text-warn' : 'text-muted')} />
          </button>
        ))}
      </div>
      <TextArea aria-label="Your review" rows={4} value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1500))} hint={`${comment.length} / 1,500. Reviews are public and can’t be deleted.`} />
      <Button className="self-end" onClick={submit} loading={busy}>
        Post review
      </Button>
    </div>
  )
}
