// FILE: src/pages/recruiter/Team.tsx
// ROUTE: /recruiter/team
// PURPOSE: Hiring team: members, pending invites, seats, and the website
//          badge snippet that shows the company's live SafeApply status.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { getTeam, leaveTeam, removeTeammate, revokeTeamInvite, type Team, type TeamMember } from '../../api/teams'
import api, { apiError } from '../../lib/axios'
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, ConfirmDialog, EmptyState, Icon, PageContainer, PageHeader, QuotaMeter, SkeletonRows, formatDate, initialsOf } from '../../components/ui'

export default function TeamPage() {
  const [team, setTeam] = useState<Team | null>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setTeam((await getTeam()).data)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load your team.'))
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await fn()
      toast.success(done)
      setRemoving(null)
      await load()
    } catch (e) {
      toast.error(apiError(e, 'Something went wrong.'))
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="group_off" title="Team unavailable" body={error} action={<ButtonLink to="/recruiter/company">Set up your company</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }

  const owner = team?.me.member_role === 'owner'
  const full = team ? team.seats.used >= team.seats.cap : false
  return (
    <>
      <SEO title="Team | Recruiter | SafeApply.AI" description="Your hiring team." path="/recruiter/team" noindex />
      <PageContainer>
        <PageHeader
          title="Hiring team"
          description="Teammates share jobs, applicants and notes. Everyone is accountable to the same hiring record."
          actions={
            owner && team?.company.verified ? (
              full ? (
                team.company.pro ? (
                  <Badge>All seats used</Badge>
                ) : (
                  <ButtonLink to="/recruiter/billing" variant="secondary" icon="lock">
                    Upgrade for more seats
                  </ButtonLink>
                )
              ) : (
                <ButtonLink to="/recruiter/team/invite" icon="person_add">
                  Invite teammate
                </ButtonLink>
              )
            ) : undefined
          }
        />
        {team && !team.company.verified && <Alert tone="warn">Your company must be verified before you can invite teammates.</Alert>}

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <Card padded={false}>
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Members</div>
              {!team ? (
                <div className="p-5">
                  <SkeletonRows rows={3} />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {team.members.map((m) => (
                    <li key={m.id} className="px-5 py-3.5 flex items-center gap-3">
                      <span className="w-9 h-9 shrink-0 rounded-[8px] bg-line grid place-items-center text-xs font-semibold" aria-hidden>
                        {initialsOf(m.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {m.full_name}
                          {m.is_me && <span className="text-muted font-normal"> (you)</span>}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {m.email} · joined {formatDate(m.created_at)}
                        </p>
                      </div>
                      <Badge tone={m.member_role === 'owner' ? 'accent' : 'neutral'}>{m.member_role === 'owner' ? 'Owner' : 'Recruiter'}</Badge>
                      {owner && m.member_role !== 'owner' && (
                        <button type="button" onClick={() => setRemoving(m)} aria-label={`Remove ${m.full_name}`} className="text-muted hover:text-danger p-1">
                          <Icon name="person_remove" className="text-[18px]" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {owner && team && team.invites.length > 0 && (
              <Card padded={false}>
                <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Pending invites</div>
                <ul className="divide-y divide-line">
                  {team.invites.map((i) => (
                    <li key={i.id} className="px-5 py-3 flex items-center gap-3">
                      <Icon name="schedule_send" className="text-[18px] text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{i.email}</p>
                        <p className="text-xs text-muted">Expires {formatDate(i.expires_at)}</p>
                      </div>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => revokeTeamInvite(i.id), 'Invite revoked')}>
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {team && !owner && (
              <div>
                <Button variant="ghost" size="sm" icon="logout" onClick={() => setLeaving(true)}>
                  Leave {team.company.name}
                </Button>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-6">
            {team && (
              <Card>
                <QuotaMeter used={team.seats.used} limit={team.seats.cap} label="Seats (members + pending)" />
                {!team.company.pro && <p className="mt-3 text-xs text-muted leading-relaxed">The free plan includes {team.seats.cap} seats. The recruiter plan adds more.</p>}
              </Card>
            )}
            {team?.company.verified && <BadgeSnippet slug={team.company.slug} />}
          </aside>
        </div>
      </PageContainer>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && act(() => removeTeammate(removing.id), 'Member removed')}
        title={`Remove ${removing?.full_name || 'member'}?`}
        body="They lose access to your jobs, applicants and notes immediately. Notes they wrote stay."
        confirmLabel="Remove"
        loading={busy}
      />
      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={() =>
          act(async () => {
            await leaveTeam()
            window.location.assign('/recruiter')
          }, 'You left the team')
        }
        title="Leave this company?"
        body="You lose access to its jobs and applicants. The owner can invite you again."
        confirmLabel="Leave"
        loading={busy}
      />
    </>
  )
}

function BadgeSnippet({ slug }: { slug: string }) {
  const src = `${String(api.defaults.baseURL).replace(/\/$/, '')}/badge/${slug}.svg`
  const href = `${window.location.origin}/companies/${slug}`
  const code = `<a href="${href}" target="_blank" rel="noopener"><img src="${src}" alt="Verified employer on SafeApply" width="236" height="44"></a>`
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Copied')
    } catch {
      toast.error('Couldn’t copy. Select the code and copy it manually.')
    }
  }
  return (
    <Card>
      <CardHeader title="Website badge" description="Add it to your careers page. It reads your live status (refreshed every minute), so it can’t keep showing a status you’ve lost." className="mb-4" />
      <img src={src} alt="Your SafeApply badge" width={236} height={44} className="max-w-full" />
      <pre className="mt-4 p-3 rounded-[var(--radius-input)] bg-ink border border-line text-[11px] text-muted whitespace-pre-wrap break-all font-mono">{code}</pre>
      <Button size="sm" variant="secondary" icon="content_copy" className="mt-3" onClick={copy}>
        Copy code
      </Button>
    </Card>
  )
}
