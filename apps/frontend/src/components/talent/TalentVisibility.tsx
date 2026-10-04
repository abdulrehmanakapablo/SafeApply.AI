// FILE: src/components/talent/TalentVisibility.tsx
// PURPOSE: Seeker settings: be found by verified recruiters, signal "open to
//          work", and hide from chosen companies (e.g. a current employer).
//          Off by default. Contact details are never shown to recruiters.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getMyTalent, saveMyTalent, type MyTalent } from '../../api/teams'
import { getCompanies, type CompanyListItem } from '../../api/reviews'
import { WORK_MODE_LABEL, type WorkMode } from '../../api/recruiter'
import { apiError } from '../../lib/axios'
import { Button, Card, CardHeader, Field, Icon, SkeletonRows, TextArea, cn } from '../ui'

const MODES: WorkMode[] = ['remote', 'hybrid', 'onsite']
const SKILL_RE = /^[a-z0-9][a-z0-9 +#./-]{0,29}$/

function Switch({ on, onChange, id, disabled }: { on: boolean; onChange: () => void; id: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-labelledby={id} disabled={disabled} onClick={onChange} className={cn('relative w-10 h-6 rounded-full shrink-0 transition-colors disabled:opacity-60', on ? 'bg-accent' : 'bg-line')}>
      <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-fg transition-transform duration-200', on && 'translate-x-4')} />
    </button>
  )
}

export default function TalentVisibility() {
  const [p, setP] = useState<MyTalent | null>(null)
  const [skillsText, setSkillsText] = useState('')
  const [hidden, setHidden] = useState<{ id: string; name: string }[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CompanyListItem[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMyTalent()
      .then((r) => {
        setP(r.data)
        setSkillsText(r.data.skills.join(', '))
        setHidden(r.data.hidden_companies)
      })
      .catch((e) => toast.error(apiError(e, 'Couldn’t load visibility settings.')))
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return setResults([])
    const t = setTimeout(() => {
      getCompanies({ search: term })
        .then((r) => setResults((r.data || []).slice(0, 6)))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  if (!p) {
    return (
      <Card as="section">
        <SkeletonRows rows={3} />
      </Card>
    )
  }

  const set = <K extends keyof MyTalent>(k: K, v: MyTalent[K]) => setP({ ...p, [k]: v })
  const skills = [...new Set(skillsText.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))]
  const badSkill = skills.find((s) => !SKILL_RE.test(s))

  async function save() {
    if (!p) return
    if (badSkill) return toast.error(`“${badSkill}” isn’t a valid skill. Use letters, numbers and + # . / -`)
    if (skills.length > 20) return toast.error('Up to 20 skills.')
    setBusy(true)
    try {
      const r = await saveMyTalent({
        visible: p.visible,
        open_to_work: p.open_to_work,
        headline: p.headline || '',
        skills,
        location: p.location || '',
        desired_roles: p.desired_roles || '',
        work_modes: p.work_modes,
        hidden_company_ids: hidden.map((h) => h.id),
      })
      toast.success(r.message || 'Saved')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card as="section">
      <CardHeader title="Recruiter visibility" description="Let verified companies find you. They see what you write here, never your email, phone or CV. You apply only if you want to." />
      <ul className="mt-2 flex flex-col divide-y divide-line">
        <li className="flex items-center justify-between gap-4 py-3.5">
          <div>
            <p id="tv-visible" className="text-sm font-medium">
              Visible to recruiters
            </p>
            <p className="text-[13px] text-muted">Off by default. Turning it off removes you from every search and saved list immediately.</p>
          </div>
          <Switch id="tv-visible" on={p.visible} onChange={() => set('visible', !p.visible)} />
        </li>
        <li className="flex items-center justify-between gap-4 py-3.5">
          <div>
            <p id="tv-open" className="text-sm font-medium">
              Open to work
            </p>
            <p className="text-[13px] text-muted">Recruiters see a green “Open to work” label. It’s never shown publicly.</p>
          </div>
          <Switch id="tv-open" on={p.open_to_work} onChange={() => set('open_to_work', !p.open_to_work)} />
        </li>
      </ul>

      <div className={cn('mt-4 grid gap-4 transition-opacity', !p.visible && 'opacity-60')}>
        <Field label="Headline" value={p.headline || ''} onChange={(e) => set('headline', e.target.value.slice(0, 120))} placeholder="Backend engineer, 4 years with Node and Postgres" />
        <Field label="Skills" value={skillsText} onChange={(e) => setSkillsText(e.target.value.slice(0, 700))} placeholder="node, postgres, aws" hint={`Comma separated, up to 20. ${skills.length} added.`} error={badSkill ? `“${badSkill}” has characters we don’t allow.` : undefined} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Location" value={p.location || ''} onChange={(e) => set('location', e.target.value.slice(0, 120))} placeholder="Lahore, Pakistan" />
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Work setup</legend>
            <div className="flex gap-2">
              {MODES.map((m) => {
                const on = p.work_modes.includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('work_modes', on ? p.work_modes.filter((x) => x !== m) : [...p.work_modes, m])}
                    className={cn('h-10 px-3 rounded-[8px] text-sm border transition-colors', on ? 'border-accent text-accent bg-accent/10' : 'border-line text-muted hover:text-fg')}
                  >
                    {WORK_MODE_LABEL[m]}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>
        <TextArea label="What you’re looking for" value={p.desired_roles || ''} onChange={(e) => set('desired_roles', e.target.value.slice(0, 300))} rows={2} placeholder="Senior backend roles, remote, product companies" />

        <div>
          <p className="text-sm font-medium">Hide from these companies</p>
          <p className="text-[13px] text-muted">Your current employer, for example. They’ll never see you in search, even if you’re visible.</p>
          {hidden.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {hidden.map((h) => (
                <li key={h.id} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-[8px] bg-line text-sm">
                  <Icon name="visibility_off" className="text-[14px] text-muted" />
                  {h.name}
                  <button type="button" onClick={() => setHidden((xs) => xs.filter((x) => x.id !== h.id))} aria-label={`Stop hiding from ${h.name}`} className="w-6 h-6 grid place-items-center rounded-[4px] text-muted hover:text-fg">
                    <Icon name="close" className="text-[14px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hidden.length < 20 && (
            <div className="relative mt-3">
              <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Search a company" aria-label="Search a company to hide from" className="w-full h-10 px-3 rounded-[var(--radius-input)] bg-ink border border-line text-sm focus:outline-none focus:border-accent" />
              {results.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-line rounded-[8px] shadow-lg py-1">
                  {results
                    .filter((c) => !hidden.some((h) => h.id === c.id))
                    .map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setHidden((xs) => [...xs, { id: c.id, name: c.name }])
                            setQ('')
                            setResults([])
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-line/60"
                        >
                          {c.name}
                          {c.industry && <span className="text-muted"> · {c.industry}</span>}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-5">
        <Button onClick={save} loading={busy}>
          Save visibility
        </Button>
      </div>
    </Card>
  )
}
