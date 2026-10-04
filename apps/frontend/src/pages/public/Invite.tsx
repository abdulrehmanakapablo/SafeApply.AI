// FILE: src/pages/public/Invite.tsx
// ROUTE: /invite/:token
// PURPOSE: A client confirms (or declines) work a freelancer listed for
//          them. Must be logged in with the invited email address.

import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { getInvitePreview, money, respondInvite, type InvitePreview } from '../../api/freelance'
import { Alert, Button, ButtonLink, Card, EmptyState, Icon, Skeleton, TextArea, formatDate } from '../../components/ui'
import { useIsAuthed } from '../../store/authStore'
import { apiError } from '../../lib/axios'

export default function Invite() {
  const { token = '' } = useParams<{ token: string }>()
  const here = useLocation().pathname
  const authed = useIsAuthed()
  const [inv, setInv] = useState<InvitePreview | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'yes' | 'no' | ''>('')
  const [wrongAccount, setWrongAccount] = useState(false)

  useEffect(() => {
    getInvitePreview(token)
      .then((r) => setInv(r.data))
      .catch((e) => setError(apiError(e, 'This invite link isn’t valid.')))
  }, [token])

  async function answer(confirmed: boolean) {
    if (busy) return
    setBusy(confirmed ? 'yes' : 'no')
    try {
      await respondInvite(token, confirmed, note.trim())
      setInv((i) => (i ? { ...i, status: confirmed ? 'accepted' : 'declined' } : i))
      toast.success(confirmed ? 'Thanks for confirming' : 'Noted')
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data?.code === 'WRONG_ACCOUNT') setWrongAccount(true)
      else toast.error(apiError(e, 'Couldn’t save your answer.'))
    } finally {
      setBusy('')
    }
  }

  return (
    <AdaptiveLayout>
      <SEO title="Confirm work | SafeApply.AI" description="Confirm work a freelancer did for you." path="/invite" noindex />
      <section className="max-w-xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-20 flex flex-col gap-6">
        {error ? (
          <Card padded={false}>
            <EmptyState icon="link_off" title="Invite not found" body={error} />
          </Card>
        ) : !inv ? (
          <Skeleton className="h-72 rounded-[16px]" />
        ) : (
          <>
            <header>
              <p className="text-xs font-medium text-accent uppercase tracking-wide">Confirm work</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
                Did {inv.freelancer.name} do this work for you, {inv.client_name.split(' ')[0]}?
              </h1>
            </header>
            {inv.work && (
              <Card>
                <p className="font-semibold break-words">{inv.work.title}</p>
                {inv.work.description && <p className="mt-2 text-sm text-muted whitespace-pre-line break-words">{inv.work.description}</p>}
                <p className="mt-3 text-sm text-muted tabular">
                  {inv.work.amount != null && money(inv.work.amount, inv.work.currency)}
                  {inv.work.amount != null && inv.work.completed_on && ' · '}
                  {inv.work.completed_on && `finished ${formatDate(inv.work.completed_on)}`}
                </p>
              </Card>
            )}
            {inv.status !== 'pending' ? (
              <Alert tone={inv.status === 'accepted' ? 'accent' : 'warn'}>
                {inv.status === 'accepted' ? 'Confirmed. It now shows as verified work on their profile.' : inv.status === 'declined' ? 'You declined this.' : 'This invite has expired or was withdrawn.'}
              </Alert>
            ) : !authed ? (
              <Card>
                <p className="text-sm text-muted">Log in or create a free account with the email this invite was sent to. It takes a minute and nothing is charged.</p>
                <div className="mt-4 grid sm:grid-cols-2 gap-2">
                  <ButtonLink to={`/login?role=client&from=${encodeURIComponent(here)}`}>Log in</ButtonLink>
                  <ButtonLink to={`/signup?role=client&redirect=${encodeURIComponent(here)}`} variant="secondary">
                    Create account
                  </ButtonLink>
                </div>
              </Card>
            ) : (
              <Card>
                {wrongAccount && <Alert className="mb-4">You’re logged in with a different email. Log out and log in with the address this invite was sent to.</Alert>}
                <TextArea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} hint="Shown to the freelancer only." />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button icon="verified" onClick={() => answer(true)} loading={busy === 'yes'}>
                    Yes, confirm
                  </Button>
                  <Button variant="secondary" onClick={() => answer(false)} loading={busy === 'no'}>
                    No, this isn’t right
                  </Button>
                </div>
              </Card>
            )}
            <p className="text-xs text-muted flex items-center gap-1.5">
              <Icon name="info" className="text-[16px]" />
              <span>
                Confirming only verifies the work happened. It doesn’t create a contract or a payment.{' '}
                <Link to={`/freelancers/${inv.freelancer.id}`} className="underline underline-offset-4 hover:text-fg">
                  Their profile
                </Link>
              </span>
            </p>
          </>
        )}
      </section>
    </AdaptiveLayout>
  )
}
