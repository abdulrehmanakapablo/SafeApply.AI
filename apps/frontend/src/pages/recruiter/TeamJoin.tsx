// FILE: src/pages/recruiter/TeamJoin.tsx
// ROUTE: /team/join/:token
// PURPOSE: Accept a hiring-team invite. Only the invited email, signed in
//          with a recruiter account, can accept.

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { joinTeam, previewTeamInvite, type InvitePreview } from '../../api/teams'
import { apiError } from '../../lib/axios'
import { Button, ButtonLink, Card, EmptyState, Icon, PageContainer, Skeleton } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'

export default function TeamJoin() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const email = useAuthStore((s) => s.user?.email)
  const [inv, setInv] = useState<InvitePreview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    previewTeamInvite(token)
      .then((r) => setInv(r.data))
      .catch((e) => setError(apiError(e, 'This invite link isn’t valid.')))
  }, [token])

  async function accept() {
    setBusy(true)
    try {
      const r = await joinTeam(token)
      toast.success(`You joined ${r.data.company}`)
      navigate('/recruiter', { replace: true })
    } catch (e) {
      setError(apiError(e, 'Couldn’t join the team.'))
    } finally {
      setBusy(false)
    }
  }

  const problem =
    error ||
    (inv && inv.status !== 'pending' ? (inv.status === 'expired' ? 'This invite has expired. Ask for a new one.' : 'This invite was already used or revoked.') : '') ||
    (inv && !inv.email_matches ? `This invite was sent to a different email. You’re signed in as ${email}.` : '') ||
    (inv && !inv.is_recruiter ? 'You’re signed in with a job seeker or freelance account. Log out and sign up as a recruiter with the invited email.' : '')

  return (
    <>
      <SEO title="Join hiring team | SafeApply.AI" description="Join a hiring team." path="/team/join" noindex />
      <PageContainer narrow>
        {!inv && !error ? (
          <Skeleton className="h-56 rounded-[16px]" />
        ) : problem ? (
          <Card padded={false}>
            <EmptyState icon="link_off" title="Can’t use this invite" body={problem} action={<ButtonLink to="/">Go home</ButtonLink>} />
          </Card>
        ) : (
          <Card className="text-center py-10">
            <span className="mx-auto w-12 h-12 rounded-[16px] bg-accent/10 text-accent grid place-items-center">
              <Icon name="group_add" className="text-[26px]" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">Join {inv!.company}</h1>
            <p className="mt-2 text-sm text-muted max-w-sm mx-auto">You’ll see the company’s jobs, applicants and team notes. You can leave any time.</p>
            <Button className="mt-6" onClick={accept} loading={busy} icon="check">
              Join the team
            </Button>
          </Card>
        )}
      </PageContainer>
    </>
  )
}
