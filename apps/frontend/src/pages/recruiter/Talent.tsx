// FILE: src/pages/recruiter/Talent.tsx
// ROUTE: /recruiter/talent
// PURPOSE: Search job seekers who chose to be found. People who hid their
//          profile from your company never appear. No contact details are
//          shown; you invite people to apply and they decide.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import TalentCard from '../../components/recruiter/TalentCard'
import { searchTalent, type Talent } from '../../api/teams'
import { WORK_MODE_LABEL } from '../../api/recruiter'
import { apiError } from '../../lib/axios'
import { Alert, ButtonLink, Card, EmptyState, Icon, PageContainer, PageHeader, Pagination, Skeleton, cn } from '../../components/ui'

const inputCls = 'w-full h-10 pl-9 pr-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent'

export default function TalentSearch() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const skill = params.get('skill') || ''
  const location = params.get('location') || ''
  const mode = params.get('mode') || ''
  const open = params.get('open') === '1'
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)

  const [draft, setDraft] = useState({ q, skill, location })
  const [rows, setRows] = useState<Talent[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (draft.q !== q || draft.skill !== skill || draft.location !== location) update({ q: draft.q.trim(), skill: draft.skill.trim().toLowerCase(), location: draft.location.trim() })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    searchTalent({ q: q || undefined, skill: skill || undefined, location: location || undefined, mode: mode || undefined, open: open ? '1' : undefined, page })
      .then((r) => {
        if (cancelled) return
        setRows(r.data)
        setTotal(r.total)
        setPages(r.total_pages || 1)
      })
      .catch((e) => {
        if (cancelled) return
        setError(apiError(e, 'Couldn’t search talent.'))
        setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [q, skill, location, mode, open, page])

  const filtered = Boolean(q || skill || location || mode || open)
  return (
    <>
      <SEO title="Find talent | Recruiter | SafeApply.AI" description="Search job seekers." path="/recruiter/talent" noindex />
      <PageContainer>
        <PageHeader
          title="Find talent"
          description="Only people who chose to be found. Invite them to apply; they decide."
          actions={
            <ButtonLink to="/recruiter/talent/saved" variant="secondary" icon="bookmarks">
              Saved
            </ButtonLink>
          }
        />
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <label className="relative">
            <span className="sr-only">Role or headline</span>
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input type="search" value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} placeholder="Product designer, backend…" maxLength={80} className={inputCls} />
          </label>
          <label className="relative">
            <span className="sr-only">Skill</span>
            <Icon name="sell" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input type="search" value={draft.skill} onChange={(e) => setDraft((d) => ({ ...d, skill: e.target.value }))} placeholder="One skill, e.g. react" maxLength={30} className={inputCls} />
          </label>
          <label className="relative">
            <span className="sr-only">Location</span>
            <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input type="search" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} placeholder="City or country" maxLength={60} className={inputCls} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['', 'remote', 'hybrid', 'onsite'] as const).map((m) => (
            <button
              key={m || 'any'}
              type="button"
              onClick={() => update({ mode: m })}
              aria-pressed={mode === m}
              className={cn('h-8 px-3 rounded-[8px] text-xs border transition-colors', mode === m ? 'border-accent text-accent bg-accent/10' : 'border-line text-muted hover:text-fg')}
            >
              {m ? WORK_MODE_LABEL[m] : 'Any setup'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ open: open ? '' : '1' })}
            aria-pressed={open}
            className={cn('h-8 px-3 rounded-[8px] text-xs border transition-colors inline-flex items-center gap-1.5', open ? 'border-accent text-accent bg-accent/10' : 'border-line text-muted hover:text-fg')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
            Open to work only
          </button>
        </div>

        {error && <Alert>{error}</Alert>}

        {!rows ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} as="div" className="flex flex-col gap-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-6 w-2/3" />
              </Card>
            ))}
          </div>
        ) : rows.length === 0 ? (
          !error && (
            <Card padded={false}>
              <EmptyState
                icon="person_search"
                title={filtered ? 'Nobody matches these filters' : 'No one is listed yet'}
                body={filtered ? 'Try a broader search or remove a filter.' : 'Job seekers appear here once they turn on visibility in their settings.'}
              />
            </Card>
          )
        ) : (
          <>
            <p className="text-sm text-muted tabular">
              {total.toLocaleString()} {total === 1 ? 'person' : 'people'}
            </p>
            <ul className="grid gap-3 md:grid-cols-2">
              {rows.map((t) => (
                <li key={t.id}>
                  <TalentCard t={t} />
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={pages} onChange={(n) => update({ page: String(n) })} />
          </>
        )}
      </PageContainer>
    </>
  )
}
