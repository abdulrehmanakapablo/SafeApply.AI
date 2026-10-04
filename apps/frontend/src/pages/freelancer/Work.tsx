// FILE: src/pages/freelancer/Work.tsx
// ROUTE: /freelancer/work
// PURPOSE: Your verified record: contracts completed on SafeApply plus
//          outside work confirmed by clients, and the invites still open.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { getMyWork, money, revokeInvite, type WorkItem } from '../../api/freelance'
import { Alert, Badge, ButtonLink, Card, EmptyState, PageContainer, PageHeader, SkeletonRows, formatDate } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

type Data = Awaited<ReturnType<typeof getMyWork>>['data']
const TONE = { pending_client: 'warn', verified: 'accent', declined: 'danger' } as const
const LABEL = { pending_client: 'Waiting for client', verified: 'Verified', declined: 'Declined' } as const

export default function Work() {
  const uid = useAuthStore((s) => s.user?.id)
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyWork()
      .then((r) => setD(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load your work.')))
  }, [])

  async function revoke(w: WorkItem) {
    if (!w.invite) return
    try {
      await revokeInvite(w.invite.id)
      setD((cur) => cur && { ...cur, work: cur.work.map((x) => (x.id === w.id && x.invite ? { ...x, invite: { ...x.invite, status: 'revoked' } } : x)) })
      toast.success('Invite withdrawn')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t withdraw the invite.'))
    }
  }

  const verified = d ? d.contracts.length + d.work.filter((w) => w.status === 'verified').length : 0

  return (
    <>
      <SEO title="Verified work | SafeApply.AI" description="Your verified work." path="/freelancer/work" noindex />
      <PageContainer>
        <PageHeader
          title="Verified work"
          description={d ? `${verified} verified item${verified === 1 ? '' : 's'}. Shown on your public profile.` : 'Work clients have confirmed.'}
          actions={
            <>
              {uid && (
                <ButtonLink to={`/freelancers/${uid}`} variant="ghost" icon="visibility">
                  Public profile
                </ButtonLink>
              )}
              <ButtonLink to="/freelancer/clients/invite" icon="person_add">
                Invite a client
              </ButtonLink>
            </>
          }
        />
        {error && <Alert>{error}</Alert>}
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Outside clients</div>
          {!d ? (
            <div className="p-5">
              <SkeletonRows rows={3} />
            </div>
          ) : d.work.length === 0 ? (
            <EmptyState icon="person_add" title="No outside work yet" body="Invite clients you worked with elsewhere. Their confirmation turns your past work into verified work." />
          ) : (
            <ul className="divide-y divide-line">
              {d.work.map((w) => (
                <li key={w.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{w.title}</p>
                    <p className="text-xs text-muted tabular">
                      {w.invite?.client_name}
                      {w.amount != null && ` · ${money(w.amount, w.currency)}`}
                      {w.completed_on && ` · ${formatDate(w.completed_on)}`}
                    </p>
                    {w.client_note && <p className="mt-1 text-sm text-muted break-words">“{w.client_note}”</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={w.invite?.status === 'revoked' ? 'neutral' : TONE[w.status]}>{w.invite?.status === 'revoked' ? 'Withdrawn' : LABEL[w.status]}</Badge>
                    {w.status === 'pending_client' && w.invite?.status === 'pending' && (
                      <button type="button" onClick={() => revoke(w)} className="text-xs text-muted hover:text-danger underline-offset-4 hover:underline">
                        Withdraw
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Completed on SafeApply</div>
          {!d ? (
            <div className="p-5">
              <SkeletonRows rows={2} />
            </div>
          ) : d.contracts.length === 0 ? (
            <EmptyState icon="handshake" title="No completed contracts yet" body="Contracts appear here automatically when every milestone is approved." />
          ) : (
            <ul className="divide-y divide-line">
              {d.contracts.map((c) => (
                <li key={c.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.title}</p>
                    <p className="text-xs text-muted">
                      {c.client} · {formatDate(c.completed_at)}
                    </p>
                  </div>
                  <span className="text-sm tabular shrink-0">{money(c.amount, c.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageContainer>
    </>
  )
}
