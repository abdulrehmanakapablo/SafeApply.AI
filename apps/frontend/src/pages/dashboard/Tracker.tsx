// FILE: src/pages/dashboard/Tracker.tsx
// ROUTE: /dashboard/tracker
// BACKEND: GET/POST /api/tracker, PATCH/DELETE /api/tracker/:id
// PURPOSE: Board + list of applications. Drag between columns, or use the
//          status menu on each card (keyboard and touch friendly).

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import ApplicationForm from '../../components/tracker/ApplicationForm'
import { createApplication, deleteApplication, getApplications, updateApplication, applicationHref, type Application, type ApplicationStatus } from '../../api/tracker'
import {
  APPLICATION_STATUSES,
  Alert,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  Icon,
  PageContainer,
  PageHeader,
  STATUS_META,
  Skeleton,
  StatusBadge,
  Tabs,
  cn,
  formatDate,
  relativeDays,
} from '../../components/ui'
import { apiError } from '../../lib/axios'

const MAX_PAGES = 10
type View = 'board' | 'list'

const DOT: Record<ApplicationStatus, string> = {
  saved: 'bg-muted',
  applied: 'bg-fg',
  screening: 'bg-accent/60',
  interviewing: 'bg-accent',
  offered: 'bg-accent',
  rejected: 'bg-danger',
  ghosted: 'bg-muted/50',
}

function salary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null
  const f = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
  if (min && max && min !== max) return `${f(min)} to ${f(max)}`
  return f((min || max) as number)
}

function readView(): View {
  try {
    return localStorage.getItem('sa_tracker_view') === 'list' ? 'list' : 'board'
  } catch {
    return 'board'
  }
}

export default function Tracker() {
  const reduce = useReducedMotion()
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [view, setViewState] = useState<View>(readView)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [pending, setPending] = useState<Application | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ApplicationStatus | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Phones get the list: a 7-column board doesn't fit and drag needs a mouse.
  const effectiveView: View = narrow ? 'list' : view

  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem('sa_tracker_view', v)
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const first = await getApplications({ page: 1 })
      let all = Array.isArray(first.data) ? first.data : []
      const pages = Math.min(first.total_pages || 1, MAX_PAGES)
      if (pages > 1) {
        const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => getApplications({ page: i + 2 })))
        rest.forEach((r) => (all = all.concat(Array.isArray(r.data) ? r.data : [])))
      }
      setTruncated((first.total_pages || 1) > MAX_PAGES)
      setApps(all)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load your applications.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return apps.filter(
      (a) =>
        (statusFilter === 'all' || a.status === statusFilter) &&
        (!q || a.company_name.toLowerCase().includes(q) || a.job_title.toLowerCase().includes(q) || (a.location || '').toLowerCase().includes(q)),
    )
  }, [apps, query, statusFilter])

  const counts = useMemo(() => {
    const c = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>
    apps.forEach((a) => (c[a.status] = (c[a.status] || 0) + 1))
    return c
  }, [apps])

  const active = counts.applied + counts.screening + counts.interviewing
  const responded = counts.screening + counts.interviewing + counts.offered + counts.rejected
  const sent = apps.length - counts.saved

  async function moveTo(app: Application, status: ApplicationStatus) {
    if (app.status === status) return
    const prev = app.status
    setApps((p) => p.map((a) => (a.id === app.id ? { ...a, status } : a)))
    try {
      const res = await updateApplication(app.id, { status })
      if (!res.success) throw new Error(res.error)
      toast.success(`${app.company_name} moved to ${STATUS_META[status].label}`)
    } catch (e) {
      setApps((p) => p.map((a) => (a.id === app.id ? { ...a, status: prev } : a)))
      toast.error(apiError(e, 'Couldn’t move it. Try again.'))
    }
  }

  function onDrop(e: DragEvent, status: ApplicationStatus) {
    e.preventDefault()
    const app = apps.find((a) => a.id === (dragId || e.dataTransfer.getData('text/plain')))
    setDragId(null)
    setOverCol(null)
    if (app) void moveTo(app, status)
  }

  async function confirmDelete() {
    if (!pending) return
    setDeleting(true)
    try {
      const res = await deleteApplication(pending.id)
      if (!res.success) throw new Error(res.error)
      setApps((p) => p.filter((a) => a.id !== pending.id))
      toast.success('Application deleted')
      setPending(null)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t delete it.'))
    } finally {
      setDeleting(false)
    }
  }

  const empty = !loading && !error && apps.length === 0
  const noMatches = !loading && apps.length > 0 && filtered.length === 0

  return (
    <>
      <SEO title="Applications | SafeApply.AI" description="Track your job applications." path="/dashboard/tracker" noindex />
      <PageContainer className="max-w-[1500px]">
        <PageHeader
          title="Applications"
          description="Every job you’ve applied to, and where it stands."
          actions={
            <>
              <ButtonLink to="/dashboard/analytics" variant="secondary" icon="insights" className="hidden sm:inline-flex">
                Analytics
              </ButtonLink>
              <Button icon="add" onClick={() => setAddOpen(true)}>
                Add application
              </Button>
            </>
          }
        />

        {error && (
          <Alert title="Couldn’t load applications">
            {error}{' '}
            <button type="button" onClick={load} className="underline underline-offset-2">
              Try again
            </button>
          </Alert>
        )}
        {truncated && <Alert tone="warn">Showing your {MAX_PAGES * 20} most recent applications.</Alert>}

        {!empty && (
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-[var(--radius-card)] overflow-hidden">
            {[
              { label: 'Tracked', value: apps.length },
              { label: 'In progress', value: active },
              { label: 'Interviews', value: counts.interviewing + counts.offered },
              { label: 'Response rate', value: sent ? `${Math.round((responded / sent) * 100)}%` : 'None yet' },
            ].map((m) => (
              <div key={m.label} className="bg-surface px-5 py-4">
                <dt className="text-[13px] text-muted">{m.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular tracking-tight">{loading ? <Skeleton className="h-7 w-12" /> : m.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {!empty && (
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search company, title or location"
                aria-label="Search applications"
                className="w-full h-10 pl-9 pr-10 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
              />
              <kbd className="hidden md:block absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted border border-line rounded px-1.5">/</kbd>
            </div>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
              className="h-10 px-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm focus:outline-none focus:border-accent"
            >
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label} ({counts[s]})
                </option>
              ))}
            </select>
            <Tabs
              label="View"
              value={view}
              onChange={setView}
              items={[
                { value: 'board', label: 'Board', icon: 'view_kanban' },
                { value: 'list', label: 'List', icon: 'view_list' },
              ]}
              className="hidden md:inline-flex md:ml-auto self-start"
            />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-24 w-full rounded-[12px]" />
                <Skeleton className="h-24 w-full rounded-[12px]" />
              </div>
            ))}
          </div>
        ) : empty ? (
          <Card padded={false}>
            <EmptyState
              icon="work_history"
              title="No applications yet"
              body="Add each job you apply to. You’ll see what’s waiting on a reply, which companies went quiet, and your response rate over time."
              action={
                <Button icon="add" onClick={() => setAddOpen(true)}>
                  Add your first application
                </Button>
              }
            />
          </Card>
        ) : noMatches ? (
          <Card padded={false}>
            <EmptyState
              icon="search_off"
              title="No applications match"
              body="Try another search or status."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setStatusFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : effectiveView === 'board' ? (
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto pb-2">
            <div className="grid grid-flow-col auto-cols-[minmax(232px,1fr)] gap-4">
              {APPLICATION_STATUSES.filter((s) => statusFilter === 'all' || s === statusFilter).map((status) => {
                const col = filtered.filter((a) => a.status === status)
                const isOver = overCol === status && dragId !== null
                return (
                  <section
                    key={status}
                    aria-label={STATUS_META[status].label}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (overCol !== status) setOverCol(status)
                    }}
                    onDragLeave={(e) => {
                      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOverCol(null)
                    }}
                    onDrop={(e) => onDrop(e, status)}
                    className={cn(
                      'flex flex-col gap-3 rounded-[14px] p-2 -m-2 min-h-[200px] transition-colors',
                      isOver && 'bg-accent/5 outline outline-1 outline-dashed outline-accent/40',
                    )}
                  >
                    <header className="flex items-center gap-2 px-1 h-7">
                      <span className={cn('w-2 h-2 rounded-full', DOT[status])} aria-hidden />
                      <h2 className="text-[13px] font-semibold">{STATUS_META[status].label}</h2>
                      <span className="text-xs text-muted tabular">{col.length}</span>
                    </header>
                    <ul className="flex flex-col gap-2">
                      <AnimatePresence initial={false}>
                        {col.map((a) => (
                          <motion.li
                            key={a.id}
                            layout={!reduce}
                            layoutId={reduce ? undefined : `app-${a.id}`}
                            initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          >
                            <BoardCard app={a} dragging={dragId === a.id} onDragStart={() => setDragId(a.id)} onDragEnd={() => setDragId(null)} onMove={(s) => moveTo(a, s)} onDelete={() => setPending(a)} />
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                    {col.length === 0 && <p className="text-xs text-muted/70 px-1 py-6 text-center border border-dashed border-line rounded-[12px]">Drop here</p>}
                  </section>
                )
              })}
            </div>
          </div>
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-line">
                    <th scope="col" className="font-medium px-5 py-3">Company</th>
                    <th scope="col" className="font-medium px-3 py-3 hidden md:table-cell">Location</th>
                    <th scope="col" className="font-medium px-3 py-3">Status</th>
                    <th scope="col" className="font-medium px-3 py-3 hidden sm:table-cell">Applied</th>
                    <th scope="col" className="font-medium px-3 py-3 hidden lg:table-cell">Salary</th>
                    <th scope="col" className="px-3 py-3 w-12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((a) => (
                    <tr key={a.id} className="group hover:bg-line/30 transition-colors">
                      <td className="px-5 py-3 max-w-[280px]">
                        <Link to={applicationHref(a)} className="block min-w-0">
                          <span className="block font-medium truncate group-hover:text-accent transition-colors">{a.company_name}</span>
                          <span className="block text-xs text-muted truncate">{a.job_title}</span>
                          <Receipt a={a} />
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-muted hidden md:table-cell truncate max-w-[180px]">{a.location || 'Not set'}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-3 py-3 text-muted tabular hidden sm:table-cell whitespace-nowrap">{formatDate(a.date_applied)}</td>
                      <td className="px-3 py-3 text-muted tabular hidden lg:table-cell">{salary(a.salary_min, a.salary_max) ?? 'Not set'}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setPending(a)}
                          aria-label={`Delete ${a.company_name}`}
                          className="w-8 h-8 rounded-[8px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <ApplicationForm
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSubmit={async (payload) => {
            try {
              const res = await createApplication(payload)
              if (res.success && res.data) {
                setApps((p) => [res.data as Application, ...p])
                setAddOpen(false)
                toast.success('Application added')
                return null
              }
              return res.error || 'Couldn’t add the application.'
            } catch (e) {
              return apiError(e, 'Couldn’t add the application.')
            }
          }}
        />

        <ConfirmDialog
          open={Boolean(pending)}
          onClose={() => !deleting && setPending(null)}
          onConfirm={confirmDelete}
          loading={deleting}
          title="Delete this application?"
          body={pending ? `${pending.company_name}, ${pending.job_title}. Its notes and history are deleted too.` : undefined}
        />
      </PageContainer>
    </>
  )
}

function BoardCard({
  app,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onDelete,
}: {
  app: Application
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (s: ApplicationStatus) => void
  onDelete: () => void
}) {
  const pay = salary(app.salary_min, app.salary_max)
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', app.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative bg-surface border border-line rounded-[12px] p-3.5 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing transition-[border-color,opacity] hover:border-muted/40',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="w-8 h-8 rounded-[8px] bg-line flex items-center justify-center text-xs font-semibold shrink-0" aria-hidden>
          {app.company_name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={applicationHref(app)} className="block text-sm font-medium truncate hover:text-accent transition-colors after:absolute after:inset-0" draggable={false}>
            {app.company_name}
          </Link>
          <p className="text-xs text-muted truncate">{app.job_title}</p>
          <Receipt a={app} />
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted min-w-0">
        <span className="tabular whitespace-nowrap" title={formatDate(app.date_applied)}>
          {relativeDays(app.date_applied)}
        </span>
        {app.location && (
          <>
            <span aria-hidden>·</span>
            <span className="truncate">{app.location}</span>
          </>
        )}
        {pay && (
          <>
            <span aria-hidden>·</span>
            <span className="tabular whitespace-nowrap">{pay}</span>
          </>
        )}
      </div>
      <div className="relative z-10 flex items-center gap-1 -mb-1 -mx-1">
        <label className="sr-only" htmlFor={`st-${app.id}`}>
          Move {app.company_name} to
        </label>
        <select
          id={`st-${app.id}`}
          value={app.status}
          onChange={(e) => onMove(e.target.value as ApplicationStatus)}
          className="h-7 flex-1 min-w-0 px-1.5 rounded-[6px] bg-transparent text-xs text-muted hover:bg-line focus:bg-line focus:outline-none cursor-pointer transition-colors"
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${app.company_name}`}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Icon name="delete" className="text-[16px]" />
        </button>
      </div>
    </article>
  )
}

/** Read receipt line for jobs-board applications. */
function Receipt({ a }: { a: Application }) {
  const r = a.receipt
  if (!r) return null
  const [icon, text, cls] = r.no_response
    ? ['hourglass_disabled', 'No reply after 21 days', 'text-warn']
    : r.first_response_at
      ? ['reply', 'Company replied', 'text-accent']
      : r.cv_opened_at
        ? ['visibility', `CV opened ${relativeDays(r.cv_opened_at)}`, 'text-accent']
        : ['visibility_off', 'CV not opened yet', 'text-muted']
  return (
    <span className={cn('mt-1 inline-flex items-center gap-1 text-[11px]', cls)}>
      <Icon name={icon} className="text-[13px]" />
      {text}
    </span>
  )
}
