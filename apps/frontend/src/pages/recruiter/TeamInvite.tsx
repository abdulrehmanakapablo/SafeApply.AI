// FILE: src/pages/recruiter/TeamInvite.tsx
// ROUTE: /recruiter/team/invite
// PURPOSE: Owner invites a colleague by work email. The link is shown once
//          so it can be shared directly when email isn't configured.

import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { getTeam, inviteTeammate, type Team } from '../../api/teams'
import { apiError } from '../../lib/axios'
import { Alert, Button, ButtonLink, Card, Field, Icon, PageContainer, PageHeader, Skeleton } from '../../components/ui'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function TeamInvite() {
  const [team, setTeam] = useState<Team | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ link: string; emailed: boolean; email: string } | null>(null)

  useEffect(() => {
    getTeam()
      .then((r) => setTeam(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load your team.')))
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = email.trim().toLowerCase()
    if (!EMAIL_RE.test(v)) return setError('Enter a valid email address.')
    setBusy(true)
    setError('')
    try {
      const r = await inviteTeammate(v)
      setSent({ link: `${window.location.origin}${r.data.link}`, emailed: r.data.emailed, email: v })
      setEmail('')
    } catch (err) {
      setError(apiError(err, 'Couldn’t send the invite.'))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!sent) return
    try {
      await navigator.clipboard.writeText(sent.link)
      toast.success('Link copied')
    } catch {
      toast.error('Couldn’t copy. Select the link and copy it manually.')
    }
  }

  const blocked = team && (team.me.member_role !== 'owner' || !team.company.verified)
  return (
    <>
      <SEO title="Invite teammate | Recruiter | SafeApply.AI" description="Invite a teammate." path="/recruiter/team/invite" noindex />
      <PageContainer narrow>
        <PageHeader back={{ to: '/recruiter/team', label: 'Team' }} title="Invite a teammate" description="They’ll see your jobs, applicants and team notes." />
        {!team && !error ? (
          <Skeleton className="h-48 rounded-[16px]" />
        ) : blocked ? (
          <Alert tone="warn">{team!.me.member_role !== 'owner' ? 'Only the company owner can invite teammates.' : 'Your company must be verified before you can invite teammates.'}</Alert>
        ) : (
          <>
            {sent && (
              <Card className="border-accent/40">
                <div className="flex items-start gap-3">
                  <Icon name="mark_email_read" className="text-[22px] text-accent mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Invite created for {sent.email}</p>
                    <p className="mt-1 text-sm text-muted">{sent.emailed ? 'We emailed them the link. You can also share it directly.' : 'Email isn’t set up, so share this link with them directly.'} It works once, for 7 days, and only for that email.</p>
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input readOnly value={sent.link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" className="flex-1 min-w-0 h-9 px-3 rounded-[var(--radius-input)] bg-ink border border-line text-xs font-mono" />
                      <Button size="sm" variant="secondary" icon="content_copy" onClick={copy}>
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            <Card>
              <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
                <Field
                  label="Work email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 254))}
                  placeholder="name@yourcompany.com"
                  hint="Must be on your company’s domain. They sign in or create a recruiter account with this email."
                  error={error || undefined}
                  required
                />
                {team && <p className="text-xs text-muted tabular">{team.seats.cap - team.seats.used} of {team.seats.cap} seats left</p>}
                <div className="flex gap-2">
                  <Button type="submit" loading={busy} icon="send">
                    Send invite
                  </Button>
                  <ButtonLink to="/recruiter/team" variant="ghost">
                    Done
                  </ButtonLink>
                </div>
              </form>
            </Card>
          </>
        )}
        {error && !team && <Alert>{error}</Alert>}
      </PageContainer>
    </>
  )
}
