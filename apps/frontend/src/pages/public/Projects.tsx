// FILE: src/pages/public/Projects.tsx
// ROUTE: /projects
// PURPOSE: Freelance project board. Every project shows its budget, and
//          projects nobody touches for 30 days drop off.

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { ProjectFacts, Skills } from '../../components/freelance/Bits'
import { LevelChip } from '../../components/trust/TrustBits'
import { listProjects, type Project } from '../../api/freelance'
import { Alert, Badge, ButtonLink, Card, EmptyState, Icon, Pagination, Skeleton, relativeDays } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

const inputCls = 'w-full h-10 pl-9 pr-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent'

export default function Projects() {
  const role = useAuthStore((s) => s.user?.role)
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const skill = params.get('skill') || ''
  const type = params.get('budget_type') || ''
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)

  const [draftQ, setDraftQ] = useState(q)
  const [draftSkill, setDraftSkill] = useState(skill)
  const [rows, setRows] = useState<Project[] | null>(null)
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
      if (draftQ !== q || draftSkill !== skill) update({ q: draftQ.trim(), skill: draftSkill.trim().toLowerCase() })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ, draftSkill])

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    listProjects({ q: q || undefined, skill: skill || undefined, budget_type: type || undefined, page })
      .then((res) => {
        if (cancelled) return
        setRows(res.data || [])
        setTotal(res.total || 0)
        setPages(res.total_pages || 1)
      })
      .catch((e) => {
        if (cancelled) return
        setError(apiError(e, 'Couldn’t load projects.'))
        setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [q, skill, type, page])

  const filtered = Boolean(q || skill || type)

  return (
    <AdaptiveLayout>
      <SEO title="Freelance projects | SafeApply.AI" description="Freelance projects with a budget on every post. Milestones agreed up front, work approved step by step." path="/projects" />
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-20 flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Freelance projects</h1>
            <p className="mt-3 text-muted leading-relaxed">Every project shows its budget. Projects nobody updates for 30 days are taken down.</p>
          </div>
          {(role === 'client' || role === 'admin') && (
            <ButtonLink to="/client/projects/new" icon="add">
              Post a project
            </ButtonLink>
          )}
        </header>

        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
          <label className="relative">
            <span className="sr-only">Search projects</span>
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input type="search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Logo design, React app…" maxLength={80} className={inputCls} />
          </label>
          <label className="relative">
            <span className="sr-only">Skill</span>
            <Icon name="sell" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input type="search" value={draftSkill} onChange={(e) => setDraftSkill(e.target.value)} placeholder="One skill, e.g. figma" maxLength={30} className={inputCls} />
          </label>
          <select
            aria-label="Budget type"
            value={type}
            onChange={(e) => update({ budget_type: e.target.value })}
            className="h-10 px-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm focus:outline-none focus:border-accent"
          >
            <option value="">Any budget</option>
            <option value="fixed">Fixed price</option>
            <option value="hourly">Hourly</option>
          </select>
        </div>

        {error && <Alert>{error}</Alert>}

        {!rows ? (
          <ul className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Card key={i} as="div" className="flex flex-col gap-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="work_off"
              title={filtered ? 'No projects match these filters' : 'No open projects yet'}
              body={filtered ? 'Try a broader search or remove a filter.' : 'Clients are posting now. Set up your freelancer profile so you’re ready.'}
            />
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted tabular">
              {total.toLocaleString()} project{total === 1 ? '' : 's'}
            </p>
            <ul className="flex flex-col gap-3">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="group block bg-surface border border-line rounded-[var(--radius-card)] p-5 hover:border-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="font-semibold text-[17px] break-words group-hover:text-accent transition-colors">{p.title}</h2>
                      <span className="flex items-center gap-2 shrink-0">
                        {!!p.client_trust && <LevelChip level={p.client_trust} link={false} />}
                        <Badge>{relativeDays(p.last_activity_at)}</Badge>
                      </span>
                    </div>
                    <ProjectFacts p={p} className="mt-2" />
                    <p className="mt-3 text-sm text-muted leading-relaxed line-clamp-2 break-words">{p.description}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <Skills skills={p.skills} max={6} />
                      <span className="text-xs text-muted tabular">
                        {p.proposals_count ?? 0} proposal{p.proposals_count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={pages} onChange={(n) => update({ page: String(n) })} />
          </>
        )}
      </section>
    </AdaptiveLayout>
  )
}
