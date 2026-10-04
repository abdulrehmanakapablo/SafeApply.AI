// FILE: src/pages/freelancer/Proposals.tsx
// ROUTE: /freelancer/proposals

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { ProposalBadge } from '../../components/freelance/Bits'
import { listMyProposals, money, withdrawProposal, type MyProposal } from '../../api/freelance'
import { Alert, ButtonLink, Card, ConfirmDialog, EmptyState, PageContainer, PageHeader, SkeletonRows, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function Proposals() {
  const [rows, setRows] = useState<MyProposal[] | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<MyProposal | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listMyProposals()
      .then((r) => setRows(r.data))
      .catch((e) => {
        setError(apiError(e, 'Couldn’t load proposals.'))
        setRows([])
      })
  }, [])

  async function withdraw() {
    if (!confirm || busy) return
    setBusy(true)
    try {
      await withdrawProposal(confirm.id)
      setRows((p) => p && p.map((x) => (x.id === confirm.id ? { ...x, status: 'withdrawn' } : x)))
      toast.success('Proposal withdrawn')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t withdraw the proposal.'))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <>
      <SEO title="Proposals | Freelancer | SafeApply.AI" description="Your proposals." path="/freelancer/proposals" noindex />
      <PageContainer>
        <PageHeader
          title="Proposals"
          description="Everything you’ve sent and where it stands."
          actions={
            <ButtonLink to="/projects" icon="travel_explore">
              Find projects
            </ButtonLink>
          }
        />
        {error && <Alert>{error}</Alert>}
        <Card padded={false} className="overflow-hidden">
          {!rows ? (
            <div className="p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon="send" title="No proposals yet" body="Find a project that fits and send your first proposal." action={<ButtonLink to="/projects">Browse projects</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    {r.project ? (
                      <Link to={`/projects/${r.project.id}`} className="font-medium hover:text-accent break-words">
                        {r.project.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-muted">Project removed</span>
                    )}
                    <p className="text-xs text-muted tabular">
                      {r.project ? money(r.amount, r.project.currency) : r.amount} · {r.duration_days} day{r.duration_days === 1 ? '' : 's'} · sent {relativeDays(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ProposalBadge status={r.status} />
                    {(r.status === 'pending' || r.status === 'shortlisted') && (
                      <button type="button" onClick={() => setConfirm(r)} className="text-xs text-muted hover:text-danger underline-offset-4 hover:underline">
                        Withdraw
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <ConfirmDialog
          open={Boolean(confirm)}
          onClose={() => !busy && setConfirm(null)}
          onConfirm={withdraw}
          loading={busy}
          title="Withdraw this proposal?"
          body="The client won’t be able to hire you for this project. You can’t send another proposal to it."
          confirmLabel="Withdraw"
        />
      </PageContainer>
    </>
  )
}
