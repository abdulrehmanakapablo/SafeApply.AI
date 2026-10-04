// FILE: src/pages/public/Jobs.tsx
// ROUTE: /jobs
// PURPOSE: Jobs board. Only verified companies, salary always shown, and
//          jobs nobody has touched in 60 days drop off automatically.

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { JobFacts } from '../../components/jobs/JobBits'
import { GhostFlag, OpenedBadge } from '../../components/jobs/HiringRecord'
import { listJobs, type PublicJob } from '../../api/recruiter'
import { Alert, Badge, Card, EmptyState, Icon, Pagination, Skeleton, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

const MODES = [
  { value: '', label: 'Any workplace' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]
const TYPES = [
  { value: '', label: 'Any type' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
]

const selectCls = 'h-10 px-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm focus:outline-none focus:border-accent'

export default function Jobs() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const location = params.get('location') || ''
  const mode = params.get('work_mode') || ''
  const type = params.get('employment_type') || ''
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1)

  const [draftQ, setDraftQ] = useState(q)
  const [draftLoc, setDraftLoc] = useState(location)
  const [jobs, setJobs] = useState<PublicJob[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // URL holds the filters so results are shareable and survive refresh.
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (draftQ !== q || draftLoc !== location) update({ q: draftQ.trim(), location: draftLoc.trim() })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQ, draftLoc])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    listJobs({ q: q || undefined, location: location || undefined, work_mode: mode || undefined, employment_type: type || undefined, page })
      .then((res) => {
        if (cancelled) return
        setJobs(res.data || [])
        setTotal(res.total || 0)
        setPages(res.total_pages || 1)
      })
      .catch((e) => !cancelled && setError(apiError(e, 'Couldn’t load jobs.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, location, mode, type, page])

  const filtered = Boolean(q || location || mode || type)

  return (
    <AdaptiveLayout>
      <SEO title="Jobs from verified companies | SafeApply.AI" description="Every job has a salary range and comes from a company we verified. Jobs nobody updates disappear." path="/jobs" />
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-20 flex flex-col gap-6">
        <header className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Jobs from verified companies</h1>
          <p className="mt-3 text-muted leading-relaxed">Every listing shows its salary range. Companies are checked by a person, and jobs nobody updates for 60 days are taken down.</p>
        </header>

        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto_auto]">
          <label className="relative">
            <span className="sr-only">Job title</span>
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input
              type="search"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Job title, e.g. accountant…"
              maxLength={80}
              className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Location</span>
            <Icon name="location_on" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input
              type="search"
              value={draftLoc}
              onChange={(e) => setDraftLoc(e.target.value)}
              placeholder="City or country…"
              maxLength={60}
              className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
            />
          </label>
          <select aria-label="Workplace" value={mode} onChange={(e) => update({ work_mode: e.target.value })} className={selectCls}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select aria-label="Job type" value={type} onChange={(e) => update({ employment_type: e.target.value })} className={selectCls}>
            {TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {error && <Alert>{error}</Alert>}

        {loading ? (
          <ul className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} as="div" className="flex flex-col gap-3">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </ul>
        ) : jobs.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="work_off"
              title={filtered ? 'No jobs match these filters' : 'No open jobs yet'}
              body={filtered ? 'Try a broader title or remove a filter.' : 'Verified companies are joining now. Check back soon, or run a company report on a job you found elsewhere.'}
            />
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted tabular">
              {total.toLocaleString()} job{total === 1 ? '' : 's'}
            </p>
            <ul className="flex flex-col gap-3">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    to={`/jobs/${j.id}`}
                    className="group block bg-surface border border-line rounded-[var(--radius-card)] p-5 hover:border-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-[17px] break-words group-hover:text-accent transition-colors">{j.title}</h2>
                        <p className="mt-0.5 text-sm text-muted flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{j.company.name}</span>
                          <Icon name="verified" fill className="text-[15px] text-accent shrink-0" label="Verified company" />
                        </p>
                      </div>
                      <Badge>{relativeDays(j.last_activity_at)}</Badge>
                    </div>
                    <JobFacts {...j} className="mt-4" />
                    {(j.ghost_flag || j.record.opened_pct != null) && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {j.ghost_flag && <GhostFlag />}
                        <OpenedBadge pct={j.record.opened_pct} />
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={pages} onChange={(p) => update({ page: String(p) })} />
          </>
        )}
      </section>
    </AdaptiveLayout>
  )
}
