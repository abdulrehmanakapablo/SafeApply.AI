// FILE: src/pages/recruiter/TalentProfile.tsx
// ROUTE: /recruiter/talent/:id
// PURPOSE: One opted-in candidate: what they're looking for, save to a
//          folder, invite them to apply to an open job.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { Skills } from '../../components/freelance/Bits'
import { LevelChip } from '../../components/trust/TrustBits'
import { WORK_MODE_LABEL } from '../../api/recruiter'
import { createFolder, getTalent, inviteTalent, removeFromFolder, saveToFolder, type TalentDetail } from '../../api/teams'
import { apiError } from '../../lib/axios'
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Icon, PageContainer, PageHeader, Select, Skeleton, cn, relativeDays } from '../../components/ui'

export default function TalentProfile() {
  const { id = '' } = useParams<{ id: string }>()
  const [t, setT] = useState<TalentDetail | null>(null)
  const [error, setError] = useState('')
  const [job, setJob] = useState('')
  const [inviting, setInviting] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [savingFolder, setSavingFolder] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await getTalent(id)
      setT(r.data)
      setJob((j) => j || r.data.open_jobs.find((o) => !r.data.invited_job_ids.includes(o.id))?.id || '')
    } catch (e) {
      setError(apiError(e, 'This profile isn’t available.'))
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  async function invite() {
    if (!job || !t) return
    setInviting(true)
    try {
      await inviteTalent(t.id, job)
      toast.success('Invite sent. They’ll get a notification.')
      setJob('')
      await load()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t send the invite.'))
    } finally {
      setInviting(false)
    }
  }

  async function toggleFolder(fid: string, saved: boolean) {
    if (!t) return
    setSavingFolder(fid)
    try {
      if (saved) await removeFromFolder(fid, t.id)
      else await saveToFolder(fid, t.id)
      setT({ ...t, folders: t.folders.map((f) => (f.id === fid ? { ...f, saved: !saved } : f)) })
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t update the folder.'))
    } finally {
      setSavingFolder(null)
    }
  }

  async function newFolder(e: FormEvent) {
    e.preventDefault()
    const name = folderName.trim()
    if (!name || !t) return
    setSavingFolder('new')
    try {
      const f = (await createFolder(name)).data
      await saveToFolder(f.id, t.id)
      setT({ ...t, folders: [...t.folders, { id: f.id, name: f.name, saved: true }].sort((a, b) => a.name.localeCompare(b.name)) })
      setFolderName('')
      toast.success(`Saved to ${f.name}`)
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t create the folder.'))
    } finally {
      setSavingFolder(null)
    }
  }

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="visibility_off" title="Profile unavailable" body="This person may have turned off visibility or hidden their profile from your company." action={<ButtonLink to="/recruiter/talent">Back to search</ButtonLink>} />
        </Card>
      </PageContainer>
    )
  }
  if (!t) {
    return (
      <PageContainer>
        <Skeleton className="h-9 w-64" />
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <Skeleton className="h-72 rounded-[16px]" />
          <Skeleton className="h-56 rounded-[16px]" />
        </div>
      </PageContainer>
    )
  }

  const available = t.open_jobs.filter((j) => !t.invited_job_ids.includes(j.id))
  const invitedTitles = t.open_jobs.filter((j) => t.invited_job_ids.includes(j.id)).map((j) => j.title)
  return (
    <>
      <SEO title={`${t.full_name} | Talent | SafeApply.AI`} description="Candidate profile." path={`/recruiter/talent/${id}`} noindex />
      <PageContainer>
        <PageHeader
          back={{ to: '/recruiter/talent', label: 'Find talent' }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{t.full_name}</span>
              {t.open_to_work && <Badge tone="accent">Open to work</Badge>}
              {t.trust_level > 0 && <LevelChip level={t.trust_level} link={false} />}
            </span>
          }
          description={[t.location, `updated ${relativeDays(t.updated_at)}`].filter(Boolean).join(' · ')}
        />
        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <Card>
              <CardHeader title="About" className="mb-3" />
              <p className="text-[15px] leading-relaxed break-words">{t.headline || 'No headline yet.'}</p>
              {t.desired_roles && (
                <>
                  <h3 className="mt-6 text-xs text-muted">Looking for</h3>
                  <p className="mt-1 text-sm leading-relaxed break-words">{t.desired_roles}</p>
                </>
              )}
              {t.work_modes.length > 0 && (
                <>
                  <h3 className="mt-6 text-xs text-muted">Work setup</h3>
                  <p className="mt-1 text-sm">{t.work_modes.map((m) => WORK_MODE_LABEL[m]).join(', ')}</p>
                </>
              )}
              {t.skills.length > 0 && (
                <>
                  <h3 className="mt-6 mb-2 text-xs text-muted">Skills</h3>
                  <Skills skills={t.skills} max={20} />
                </>
              )}
            </Card>
            <p className="text-xs text-muted flex items-start gap-2 leading-relaxed">
              <Icon name="lock" className="text-[16px] shrink-0" />
              Contact details stay private until this person applies. Invites are logged on your hiring record.
            </p>
          </div>

          <aside className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Invite to apply" description={`${t.invites_left} invite${t.invites_left === 1 ? '' : 's'} left this month`} className="mb-4" />
              {t.open_jobs.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted">You need an open job to invite someone.</p>
                  <ButtonLink to="/recruiter/jobs/new" size="sm" variant="secondary" icon="add">
                    Post a job
                  </ButtonLink>
                </div>
              ) : available.length === 0 ? (
                <p className="text-sm text-muted">Already invited to all of your open jobs.</p>
              ) : t.invites_left === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted">You’ve used this month’s invites.</p>
                  <ButtonLink to="/recruiter/billing" size="sm" variant="secondary">
                    See plans
                  </ButtonLink>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Select label="Job" value={job} onChange={(e) => setJob(e.target.value)} options={[{ value: '', label: 'Pick a job' }, ...available.map((j) => ({ value: j.id, label: j.title }))]} />
                  <Button onClick={invite} loading={inviting} disabled={!job} icon="send">
                    Send invite
                  </Button>
                  <p className="text-xs text-muted leading-relaxed">They get a notification with a link to the job. Applying is their choice.</p>
                </div>
              )}
              {invitedTitles.length > 0 && <p className="mt-4 pt-4 border-t border-line text-xs text-muted">Invited to: {invitedTitles.join(', ')}</p>}
            </Card>

            <Card>
              <CardHeader title="Save to folder" className="mb-3" />
              {t.folders.length > 0 && (
                <ul className="flex flex-col gap-1 mb-4">
                  {t.folders.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        disabled={savingFolder !== null}
                        onClick={() => toggleFolder(f.id, f.saved)}
                        aria-pressed={f.saved}
                        className={cn('w-full flex items-center gap-2.5 px-2 py-2 rounded-[8px] text-sm text-left hover:bg-line/60 transition-colors disabled:opacity-60')}
                      >
                        <Icon name={f.saved ? 'bookmark_added' : 'bookmark_add'} className={cn('text-[18px]', f.saved ? 'text-accent' : 'text-muted')} />
                        <span className="truncate">{f.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={newFolder} className="flex gap-2">
                <input value={folderName} onChange={(e) => setFolderName(e.target.value.slice(0, 80))} placeholder="New folder" aria-label="New folder name" className="flex-1 min-w-0 h-9 px-3 rounded-[var(--radius-input)] bg-ink border border-line text-sm focus:outline-none focus:border-accent" />
                <Button type="submit" size="sm" variant="secondary" loading={savingFolder === 'new'} disabled={!folderName.trim()}>
                  Save
                </Button>
              </form>
            </Card>
          </aside>
        </div>
      </PageContainer>
    </>
  )
}
