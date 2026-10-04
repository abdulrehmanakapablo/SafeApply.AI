// FILE: src/pages/public/ProjectDetail.tsx
// ROUTE: /projects/:id
// PURPOSE: One project. Freelancers send a proposal here; the owner gets a
//          link to manage it. Clients are shown as "First L." only.

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { ProjectBadge, ProjectFacts, ProposalBadge, Skills } from '../../components/freelance/Bits'
import { LevelChip } from '../../components/trust/TrustBits'
import { getProject, money, sendProposal, type ProjectDetail as Detail } from '../../api/freelance'
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Skeleton, TextArea, formatDate, relativeDays } from '../../components/ui'
import { useAuthStore, useIsAuthed } from '../../store/authStore'
import { apiError } from '../../lib/axios'
import axios from 'axios'

export default function ProjectDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const authed = useIsAuthed()
  const role = useAuthStore((s) => s.user?.role)
  const [p, setP] = useState<Detail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setP(null)
    getProject(id)
      .then((r) => !cancelled && setP(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Project not found.')))
    return () => {
      cancelled = true
    }
  }, [id, authed])

  return (
    <AdaptiveLayout>
      <SEO title={`${p?.title || 'Project'} | Freelance | SafeApply.AI`} description={p ? p.description.slice(0, 150) : 'Freelance project.'} path={`/projects/${id}`} />
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-20">
        <Link to="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg mb-5">
          ← All projects
        </Link>
        {error ? (
          <Card padded={false}>
            <EmptyState icon="work_off" title="Project not found" body={error} action={<ButtonLink to="/projects">Browse projects</ButtonLink>} />
          </Card>
        ) : !p ? (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <Skeleton className="h-96 rounded-[16px]" />
            <Skeleton className="h-64 rounded-[16px]" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
            <article className="min-w-0 flex flex-col gap-6">
              <header>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-words">{p.title}</h1>
                  {p.status !== 'open' && <ProjectBadge status={p.status} />}
                </div>
                <ProjectFacts p={p} className="mt-3" />
                <p className="mt-2 text-xs text-muted">
                  Posted {formatDate(p.created_at)} · active {relativeDays(p.last_activity_at)} · {p.proposals_count} proposal{p.proposals_count === 1 ? '' : 's'}
                </p>
              </header>
              <Card>
                <p className="text-sm leading-relaxed whitespace-pre-line break-words">{p.description}</p>
                {p.skills.length > 0 && <Skills skills={p.skills} max={10} className="mt-5" />}
              </Card>
            </article>

            <aside className="flex flex-col gap-6 lg:sticky lg:top-20">
              <Card>
                <p className="text-xs text-muted">Client</p>
                <p className="mt-1 font-semibold flex items-center gap-2">
                  {p.client.name}
                  <LevelChip level={p.client.trust_level} />
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Projects posted</dt>
                    <dd className="tabular font-medium">{p.client.projects_posted}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Hires</dt>
                    <dd className="tabular font-medium">{p.client.hires}</dd>
                  </div>
                </dl>
                {p.client.member_since && <p className="mt-3 text-xs text-muted">Member since {formatDate(p.client.member_since)}</p>}
              </Card>
              <ProposalBox p={p} authed={authed} role={role} onSent={(mine) => setP({ ...p, proposals_count: p.proposals_count + 1, viewer: { ...p.viewer, my_proposal: mine } })} />
            </aside>
          </div>
        )}
      </section>
    </AdaptiveLayout>
  )
}

function ProposalBox({ p, authed, role, onSent }: { p: Detail; authed: boolean; role?: string; onSent: (m: Detail['viewer']['my_proposal']) => void }) {
  const [cover, setCover] = useState('')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)

  if (p.viewer.is_owner) {
    return (
      <Card>
        <p className="text-sm text-muted">This is your project.</p>
        <ButtonLink to={`/client/projects/${p.id}`} className="mt-4 w-full">
          Manage proposals
        </ButtonLink>
      </Card>
    )
  }
  const mine = p.viewer.my_proposal
  if (mine) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">Your proposal</p>
          <ProposalBadge status={mine.status} />
        </div>
        <p className="mt-2 text-sm text-muted tabular">
          {money(mine.amount, p.currency)} in {mine.duration_days} day{mine.duration_days === 1 ? '' : 's'} · sent {relativeDays(mine.created_at)}
        </p>
        <ButtonLink to="/freelancer/proposals" variant="secondary" className="mt-4 w-full">
          All my proposals
        </ButtonLink>
      </Card>
    )
  }
  if (p.status !== 'open' || !p.fresh) return <Alert tone="warn">This project isn’t accepting proposals.</Alert>
  if (!authed) {
    return (
      <Card>
        <p className="font-semibold">Interested?</p>
        <p className="mt-1 text-sm text-muted">Log in with a freelancer account to send a proposal.</p>
        <div className="mt-4 grid gap-2">
          <ButtonLink to={`/login?role=freelancer&from=${encodeURIComponent(`/projects/${p.id}`)}`}>Log in</ButtonLink>
          <ButtonLink to="/signup?role=freelancer" variant="secondary">
            Create a freelancer account
          </ButtonLink>
        </div>
      </Card>
    )
  }
  if (role !== 'freelancer' && role !== 'admin') {
    return <Alert tone="accent">Proposals are sent from a freelancer account.</Alert>
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const n = parseInt(amount.replace(/[^0-9]/g, ''), 10)
    const d = parseInt(days, 10)
    const next: Record<string, string> = {}
    if (cover.trim().length < 50) next.cover = `At least 50 characters (${cover.trim().length} so far)`
    if (!Number.isFinite(n) || n < 1) next.amount = 'Enter your price'
    if (!Number.isFinite(d) || d < 1 || d > 365) next.days = '1 to 365 days'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const res = await sendProposal(p.id, { cover_letter: cover.trim(), amount: n, duration_days: d })
      toast.success('Proposal sent')
      onSent(res.data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.code === 'NO_PROFILE') setNeedsProfile(true)
      else toast.error(apiError(err, 'Couldn’t send the proposal.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="font-semibold">Send a proposal</p>
        {needsProfile && (
          <Alert tone="warn">
            Set up your freelancer profile first.{' '}
            <Link to="/freelancer/profile" className="underline underline-offset-4">
              Open profile
            </Link>
          </Alert>
        )}
        <TextArea
          label="Why you"
          rows={7}
          value={cover}
          onChange={(e) => setCover(e.target.value.slice(0, 5000))}
          error={errors.cover}
          hint="How you’d approach it, relevant work, and any questions."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Total price (${p.currency})`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
          <Field label="Days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))} error={errors.days} />
        </div>
        <Button type="submit" loading={busy}>
          Send proposal
        </Button>
      </form>
    </Card>
  )
}
