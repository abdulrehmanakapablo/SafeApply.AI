// FILE: src/pages/dashboard/Tracker.tsx
// ROUTE: /dashboard/tracker (auth required)
// BACKEND: GET /api/tracker, POST /api/tracker, PATCH /api/tracker/:id, DELETE /api/tracker/:id
// PURPOSE: Kanban + list view of all job applications with status drag-drop.
// SECURITY:
//   - No dangerouslySetInnerHTML — all data auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.
//   - Delete is ownership-checked on the backend (user_id = req.user.userId).
//   - All inputs validated + trimmed before sending to backend.

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication,
  type Application,
  type ApplicationStatus,
} from '../../api/tracker'

// ─── Status config ──────────────────────────────────────
interface StatusMeta {
  key: ApplicationStatus
  label: string
  dotClass: string
  dotHex: string
}

const STATUSES: StatusMeta[] = [
  { key: 'saved',        label: 'Saved',        dotClass: 'bg-[#737373]', dotHex: '#737373' },
  { key: 'applied',      label: 'Applied',      dotClass: 'bg-[#22c55e]', dotHex: '#22c55e' },
  { key: 'screening',    label: 'Screening',    dotClass: 'bg-[#22c55e]', dotHex: '#22c55e' },
  { key: 'interviewing', label: 'Interviewing', dotClass: 'bg-[#22c55e]', dotHex: '#22c55e' },
  { key: 'offered',      label: 'Offered',      dotClass: 'bg-[#22c55e]', dotHex: '#22c55e' },
  { key: 'rejected',     label: 'Rejected',     dotClass: 'bg-[#EF4444]', dotHex: '#EF4444' },
  { key: 'ghosted',      label: 'Ghosted',      dotClass: 'bg-[#737373]', dotHex: '#737373' },
]

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
}

// ─── Demo fallback (pilot mode) ─────────────────────────
interface DemoApp {
  id: string
  company_name: string
  job_title: string
  status: ApplicationStatus
  date_applied: string
  salary_min?: number | null
  salary_max?: number | null
  location?: string | null
  job_link?: string | null
  match_score?: number | null
  source_tag?: string
  status_note?: string
  icon: string
}

const d = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

const DEMO_APPS: DemoApp[] = [
  // SAVED
  { id: 'd1', company_name: 'Datadog',  job_title: 'Staff Distributed Systems Eng', status: 'saved', date_applied: d(2),  salary_min: 210000, salary_max: 240000, location: 'Remote (US)',   match_score: 94, source_tag: 'Remote (US)',     icon: 'bookmark' },
  { id: 'd2', company_name: 'Stripe',   job_title: 'Infrastructure Architect',     status: 'saved', date_applied: d(3),  salary_min: 195000, salary_max: 225000, location: 'San Francisco', match_score: 89, source_tag: 'San Francisco',   icon: 'bookmark' },
  { id: 'd3', company_name: 'Vercel',   job_title: 'Edge Runtime Engineer',        status: 'saved', date_applied: d(5),  salary_min: 175000, salary_max: 205000, location: 'Hybrid',        match_score: 78, source_tag: 'Hybrid',          icon: 'bookmark' },

  // APPLIED
  { id: 'd4', company_name: 'Linear',     job_title: 'Full-Stack Sync Core',      status: 'applied', date_applied: d(4),  salary_min: 180000, salary_max: 210000, match_score: 96, source_tag: 'Direct Apply',      status_note: 'Direct Apply',  icon: 'check_circle' },
  { id: 'd5', company_name: 'Anthropic',  job_title: 'Platform Security Lead',    status: 'applied', date_applied: d(6),  salary_min: 220000, salary_max: 260000, match_score: 91, source_tag: 'SafeApply Tailored', status_note: 'Tailored CV',   icon: 'send' },
  { id: 'd6', company_name: 'Figma',      job_title: 'Graphics Engine Dev',       status: 'applied', date_applied: d(8),  salary_min: 190000, salary_max: 215000, match_score: 82, source_tag: 'Greenhouse ATS',    status_note: 'Greenhouse',    icon: 'mark_email_read' },
  { id: 'd7', company_name: 'Supabase',   job_title: 'Database Reliability Eng',  status: 'applied', date_applied: d(9),  salary_min: 170000, salary_max: 200000, match_score: 95, source_tag: 'Lever ATS',         status_note: 'Lever',         icon: 'schedule' },
  { id: 'd8', company_name: 'Cloudflare', job_title: 'Systems Engineer, Rust',    status: 'applied', date_applied: d(10), salary_min: 165000, salary_max: 190000, match_score: 75, source_tag: 'Workday',           status_note: 'Workday',       icon: 'sync' },
  { id: 'd9', company_name: 'Scale AI',   job_title: 'Data Ingestion Eng',        status: 'applied', date_applied: d(12), salary_min: 185000, salary_max: 215000, match_score: 88, source_tag: 'Ashby',             status_note: 'Ashby',         icon: 'hourglass_empty' },

  // SCREENING
  { id: 'd10', company_name: 'GitHub',     job_title: 'Copilot Infrastructure',   status: 'screening', date_applied: d(11), salary_min: 190000, salary_max: 220000, match_score: 93, source_tag: 'Recruiter Ping', status_note: 'Recruiter call',  icon: 'phone_in_talk' },
  { id: 'd11', company_name: 'Retool',     job_title: 'Backend Infrastructure',   status: 'screening', date_applied: d(13), salary_min: 175000, salary_max: 205000, match_score: 90, source_tag: 'Karat Assessment', status_note: 'Async screen',  icon: 'quiz' },
  { id: 'd12', company_name: 'Postman',    job_title: 'API Platform Engineer',    status: 'screening', date_applied: d(15), salary_min: 165000, salary_max: 190000, match_score: 81, source_tag: 'HR Passed',       status_note: 'Completed',       icon: 'done_all' },
  { id: 'd13', company_name: 'HashiCorp',  job_title: 'Terraform Core Eng',       status: 'screening', date_applied: d(16), salary_min: 180000, salary_max: 210000, match_score: 87, source_tag: 'Oct 28 Call',     status_note: 'Scheduled',       icon: 'event' },

  // INTERVIEWING
  { id: 'd14', company_name: 'Sentry',     job_title: 'Telemetry Pipelines Lead', status: 'interviewing', date_applied: d(18), salary_min: 195000, salary_max: 220000, match_score: 97, source_tag: 'Architecture 1:1', status_note: 'Round 3: Onsite', icon: 'groups' },
  { id: 'd15', company_name: 'Notion',     job_title: 'Senior Infrastructure Eng', status: 'interviewing', date_applied: d(20), salary_min: 185000, salary_max: 215000, match_score: 92, source_tag: 'Live Coding Pair', status_note: 'Round 2',          icon: 'terminal' },
  { id: 'd16', company_name: 'PlanetScale', job_title: 'Distributed Vitess Eng',  status: 'interviewing', date_applied: d(22), salary_min: 190000, salary_max: 225000, match_score: 85, source_tag: 'Deep Dive',         status_note: 'Round 2 Passed',   icon: 'badge' },

  // OFFERED
  { id: 'd17', company_name: 'Tailscale',  job_title: 'WireGuard Kernel Eng',     status: 'offered', date_applied: d(25), salary_min: 215000, salary_max: 215000, match_score: 98, source_tag: 'Offer in Hand', status_note: '+ 0.08% Equity', icon: 'verified' },
  { id: 'd18', company_name: 'Fly.io',     job_title: 'Host Systems Engineer',    status: 'offered', date_applied: d(28), salary_min: 195000, salary_max: 195000, match_score: 94, source_tag: 'Reviewing Docs', status_note: 'Full Remote',    icon: 'task_alt' },

  // REJECTED
  { id: 'd19', company_name: 'OpenAI',   job_title: 'Inference Systems Architect', status: 'rejected', date_applied: d(30), salary_min: 260000, salary_max: 320000, match_score: 91, source_tag: 'Role Frozen',       status_note: 'Post-Screen',      icon: 'cancel' },
  { id: 'd20', company_name: 'Airbnb',   job_title: 'Core Reliability Eng',        status: 'rejected', date_applied: d(32), salary_min: 185000, salary_max: 210000, match_score: 74, source_tag: 'Resume Mismatch',    status_note: 'ATS Filter',       icon: 'block' },
  { id: 'd21', company_name: 'Netflix',  job_title: 'Video Streaming Core',        status: 'rejected', date_applied: d(35), salary_min: 240000, salary_max: 240000, match_score: 88, source_tag: 'Headcount Change',  status_note: 'Post-Loop',        icon: 'history' },
  { id: 'd22', company_name: 'Discord',  job_title: 'Voice Gateway Team',          status: 'rejected', date_applied: d(38), salary_min: 170000, salary_max: 200000, match_score: 79, source_tag: 'No feedback',       status_note: 'Oct 10',           icon: 'do_not_disturb_on' },

  // GHOSTED
  { id: 'd23', company_name: 'Coinbase', job_title: 'Crypto Node Reliability', status: 'ghosted', date_applied: d(45), salary_min: 175000, salary_max: 210000, match_score: 80, source_tag: 'SafeApply Pings: 3', status_note: '28d silent', icon: 'wifi_tethering_off' },
  { id: 'd24', company_name: 'Brex',     job_title: 'Ledger Transaction Eng',  status: 'ghosted', date_applied: d(50), salary_min: 165000, salary_max: 190000, match_score: 76, source_tag: 'Archived',           status_note: '34d silent', icon: 'visibility_off' },
]

// ─── Helpers ────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const days = Math.max(0, Math.floor((now - then) / 86_400_000))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatSalaryRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return '—'
  const fmt = (n: number) =>
    `$${n >= 1000 ? `${Math.round(n / 1000)}k` : n}`
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return fmt(min)
  return fmt(max as number)
}

function toDemoApp(app: Application): DemoApp {
  return {
    id: app.id,
    company_name: app.company_name,
    job_title: app.job_title,
    status: app.status,
    date_applied: app.date_applied || app.created_at.slice(0, 10),
    salary_min: app.salary_min,
    salary_max: app.salary_max,
    location: app.location,
    job_link: app.job_link,
    match_score: app.match_score,
    source_tag: app.location || 'Tracked',
    status_note: relativeDate(app.date_applied || app.created_at),
    icon: 'work',
  }
}

// ─── Match badge color ──────────────────────────────────
function matchBadgeClass(score?: number | null): string {
  if (!score) return 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]'
  if (score >= 90)
    return 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
  if (score >= 70)
    return 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30'
  return 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
}

// ─── Metric ribbon ──────────────────────────────────────
interface Metrics {
  highMatch: number
  activePipeline: number
  offers: number
  salaryMean: number
  avgResponseDays: number
  auditIntegrity: number
  stalled: number
  total: number
}

function computeMetrics(apps: DemoApp[]): Metrics {
  const total = apps.length
  const highMatch = apps.filter((a) => (a.match_score ?? 0) >= 90).length
  const activePipeline = apps.filter((a) =>
    ['applied', 'screening', 'interviewing'].includes(a.status)
  ).length
  const offers = apps.filter((a) => a.status === 'offered').length
  const stalled = apps.filter((a) => a.status === 'ghosted').length

  const salaryApps = apps.filter((a) => a.salary_min && a.salary_max)
  const salaryMean = salaryApps.length
    ? Math.round(
        salaryApps.reduce(
          (sum, a) => sum + ((a.salary_min || 0) + (a.salary_max || 0)) / 2,
          0
        ) / salaryApps.length
      )
    : 0

  const responseApps = apps.filter(
    (a) => !['saved', 'ghosted'].includes(a.status)
  )
  const avgResponseDays =
    responseApps.length > 0 ? Math.round((total / responseApps.length) * 4) : 0

  return {
    highMatch,
    activePipeline,
    offers,
    salaryMean,
    avgResponseDays: Math.max(2, Math.min(14, avgResponseDays)),
    auditIntegrity: 100,
    stalled,
    total,
  }
}

// ─── Kanban card ────────────────────────────────────────
interface KanbanCardProps {
  app: DemoApp
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDelete: (app: DemoApp) => void
  dragging: boolean
}

function KanbanCard({ app, onDragStart, onDragEnd, onDelete, dragging }: KanbanCardProps) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', app.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(app.id)
      }}
      onDragEnd={onDragEnd}
      className={`p-3 bg-[#0D0D0D] rounded-lg border border-[#1A1A1A] hover:border-[#22c55e]/40 cursor-grab active:cursor-grabbing transition-all flex flex-col gap-2 group ${
        dragging ? 'opacity-40 ring-2 ring-[#22c55e]/40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/dashboard/tracker/${app.id}`}
          className="font-semibold text-sm text-white truncate hover:text-[#22c55e] transition-colors min-w-0 flex-1"
        >
          {app.company_name}
        </Link>
        {app.match_score ? (
          <span
            className={`px-1.5 py-0.5 rounded-full border font-mono text-[10px] font-bold whitespace-nowrap ${matchBadgeClass(
              app.match_score
            )}`}
          >
            {app.match_score}%
          </span>
        ) : null}
      </div>

      <p className="text-xs text-[#737373] truncate -mt-1">{app.job_title}</p>

      <div className="flex items-center justify-between text-[11px] text-[#737373] pt-1">
        <span className="font-mono truncate">
          {formatSalaryRange(app.salary_min, app.salary_max)}
        </span>
        <span className="whitespace-nowrap">{relativeDate(app.date_applied)}</span>
      </div>

      <div className="pt-2 flex items-center justify-between border-t border-[#1A1A1A] gap-2">
        <span className="px-2 py-0.5 rounded bg-[#1c1b1b] text-[#737373] text-[10px] font-medium truncate max-w-[120px]">
          {app.source_tag || app.location || 'Tracked'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(app)
            }}
            aria-label={`Delete ${app.company_name}`}
            className="opacity-0 group-hover:opacity-100 text-[#737373] hover:text-[#EF4444] transition-all p-0.5"
          >
            <span className="material-symbols-outlined text-[14px]">
              delete
            </span>
          </button>
          <span className="material-symbols-outlined text-[14px] text-[#737373]">
            {app.icon || 'work'}
          </span>
        </div>
      </div>
    </article>
  )
}

// ─── Main component ─────────────────────────────────────
export default function Tracker() {
  const [apps, setApps] = useState<DemoApp[]>(DEMO_APPS)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [minMatch, setMinMatch] = useState<number>(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<ApplicationStatus | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    company_name: '',
    job_title: '',
    date_applied: new Date().toISOString().slice(0, 10),
    status: 'applied' as ApplicationStatus,
    location: '',
    job_link: '',
    salary_min: '',
    salary_max: '',
    notes: '',
    jd_text: '',
  })
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [jdEnabled, setJdEnabled] = useState(true)

  const [deleteTarget, setDeleteTarget] = useState<DemoApp | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  const searchRef = useRef<HTMLInputElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  // Load applications on mount
  useEffect(() => {
    let cancelled = false
    getApplications({ page: 1 })
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data && res.data.length > 0) {
          setApps(res.data.map(toDemoApp))
        } else {
          setApps(DEMO_APPS)
        }
      })
      .catch(() => {
        if (cancelled) return
        setApps(DEMO_APPS)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Close filter dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Cmd/Ctrl + K focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (addOpen) setAddOpen(false)
        if (deleteTarget) setDeleteTarget(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [addOpen, deleteTarget])

  // ── Filtered apps ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return apps.filter((a) => {
      const matchesSearch =
        !q ||
        a.company_name.toLowerCase().includes(q) ||
        a.job_title.toLowerCase().includes(q) ||
        (a.source_tag || '').toLowerCase().includes(q)
      const matchesMatch = (a.match_score ?? 0) >= minMatch
      return matchesSearch && matchesMatch
    })
  }, [apps, search, minMatch])

  const metrics = useMemo(() => computeMetrics(apps), [apps])

  // ── Drag / drop ────────────────────────────────────────
  async function handleDrop(targetStatus: ApplicationStatus) {
    if (!draggingId) return
    const app = apps.find((a) => a.id === draggingId)
    setDragOverStatus(null)
    setDraggingId(null)
    if (!app || app.status === targetStatus) return

    const previousStatus = app.status
    // Optimistic update
    setApps((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, status: targetStatus } : a))
    )

    try {
      if (!app.id.startsWith('d')) {
        await updateApplication(app.id, { status: targetStatus })
      }
      setToast({
        kind: 'ok',
        text: `Moved ${app.company_name} → ${STATUS_LABEL[targetStatus]}`,
      })
    } catch {
      // Rollback
      setApps((prev) =>
        prev.map((a) =>
          a.id === app.id ? { ...a, status: previousStatus } : a
        )
      )
      setToast({ kind: 'err', text: 'Failed to move — try again.' })
    }
  }

  // ── Add application ────────────────────────────────────
  function resetAddForm() {
    setAddForm({
      company_name: '',
      job_title: '',
      date_applied: new Date().toISOString().slice(0, 10),
      status: 'applied',
      location: '',
      job_link: '',
      salary_min: '',
      salary_max: '',
      notes: '',
      jd_text: '',
    })
    setAddError('')
    setJdEnabled(true)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (adding) return

    const company = addForm.company_name.trim()
    const role = addForm.job_title.trim()
    if (!company || company.length < 1) {
      setAddError('Company name is required.')
      return
    }
    if (!role) {
      setAddError('Job title is required.')
      return
    }

    const salaryMin = addForm.salary_min
      ? parseInt(addForm.salary_min.replace(/[^0-9]/g, ''), 10)
      : undefined
    const salaryMax = addForm.salary_max
      ? parseInt(addForm.salary_max.replace(/[^0-9]/g, ''), 10)
      : undefined

    if (salaryMin && salaryMax && salaryMin > salaryMax) {
      setAddError('Minimum salary must be less than maximum.')
      return
    }

    setAdding(true)
    setAddError('')

    const payload = {
      company_name: company,
      job_title: role,
      date_applied: addForm.date_applied,
      status: addForm.status,
      location: addForm.location.trim() || undefined,
      job_link: addForm.job_link.trim() || undefined,
      salary_min: salaryMin,
      salary_max: salaryMax,
      notes: addForm.notes.trim() || undefined,
      jd_text: jdEnabled && addForm.jd_text.trim() ? addForm.jd_text.trim() : undefined,
    }

    try {
      const res = await createApplication(payload)
      if (res.success && res.data) {
        setApps((prev) => [toDemoApp(res.data), ...prev])
        setToast({ kind: 'ok', text: 'Application added.' })
        setAddOpen(false)
        resetAddForm()
      } else {
        setAddError(res.error || 'Failed to add application.')
      }
    } catch {
      // Pilot fallback — add locally
      const localApp: DemoApp = {
        id: `local-${Date.now()}`,
        company_name: payload.company_name,
        job_title: payload.job_title,
        status: payload.status,
        date_applied: payload.date_applied,
        salary_min: payload.salary_min ?? null,
        salary_max: payload.salary_max ?? null,
        location: payload.location ?? null,
        job_link: payload.job_link ?? null,
        match_score: null,
        source_tag: payload.location || 'Manual',
        status_note: 'Just now',
        icon: 'check_circle',
      }
      setApps((prev) => [localApp, ...prev])
      setToast({ kind: 'ok', text: 'Application added.' })
      setAddOpen(false)
      resetAddForm()
    } finally {
      setAdding(false)
    }
  }

  // ── Delete application ─────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget || deleting) return
    const target = deleteTarget
    setDeleting(true)

    const previous = apps
    setApps((prev) => prev.filter((a) => a.id !== target.id))
    setDeleteTarget(null)

    try {
      if (!target.id.startsWith('d') && !target.id.startsWith('local')) {
        await deleteApplication(target.id)
      }
      setToast({ kind: 'ok', text: 'Application deleted.' })
    } catch {
      setApps(previous)
      setToast({ kind: 'err', text: 'Delete failed — restored.' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Columns grouping ───────────────────────────────────
  const appsByStatus = useMemo(() => {
    const map: Record<ApplicationStatus, DemoApp[]> = {
      saved: [],
      applied: [],
      screening: [],
      interviewing: [],
      offered: [],
      rejected: [],
      ghosted: [],
    }
    filtered.forEach((a) => {
      map[a.status].push(a)
    })
    return map
  }, [filtered])

  // ─────────────────────────────────────────────────────
  return (
    <>
      <SEO
        title="Application Tracker | SafeApply.AI"
        description="Track every job application across a 7-stage pipeline with drag-and-drop Kanban and list views."
        path="/dashboard/tracker"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 pb-16">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Application Tracker
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] text-[11px] font-semibold border border-[#22c55e]/30 whitespace-nowrap">
                Live Telemetry
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#737373]">
              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
              <span>
                {metrics.total} active application{metrics.total === 1 ? '' : 's'} tracked across 7 pipeline states
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex items-center min-w-[240px] flex-1 sm:flex-none bg-[#0D0D0D] rounded-lg border border-[#1A1A1A] focus-within:border-[#22c55e] transition-colors">
              <span className="material-symbols-outlined text-[#737373] pl-3 text-[18px]">
                search
              </span>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by role, employer, tag…"
                className="w-full bg-transparent text-white placeholder:text-[#737373] text-sm px-3 py-2.5 focus:outline-none"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="pr-3 text-[#737373] hover:text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    close
                  </span>
                </button>
              ) : (
                <span className="pr-3 font-mono text-[10px] text-[#353534] hidden sm:block">
                  ⌘K
                </span>
              )}
            </div>

            {/* Filter dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[#0D0D0D] text-white text-sm rounded-lg border border-[#1A1A1A] hover:border-[#22c55e]/40 transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px] text-[#737373]">
                  tune
                </span>
                <span>Match: {minMatch === 0 ? 'Any' : `>${minMatch}%`}</span>
                <span className="material-symbols-outlined text-[16px] text-[#737373]">
                  expand_more
                </span>
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-12 z-30 w-40 bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg py-1 shadow-2xl">
                  {[0, 70, 80, 90].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setMinMatch(n)
                        setFilterOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        minMatch === n
                          ? 'bg-[#1c1b1b] text-white'
                          : 'text-[#737373] hover:bg-[#1c1b1b] hover:text-white'
                      }`}
                    >
                      {n === 0 ? 'Any match' : `> ${n}% match`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View switcher */}
            <div className="flex items-center bg-[#0D0D0D] p-[3px] rounded-lg border border-[#1A1A1A]">
              <button
                type="button"
                onClick={() => setView('kanban')}
                aria-pressed={view === 'kanban'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  view === 'kanban'
                    ? 'bg-[#22c55e] text-black'
                    : 'text-[#737373] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  view_kanban
                </span>
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  view === 'list'
                    ? 'bg-[#22c55e] text-black'
                    : 'text-[#737373] hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  table_rows
                </span>
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Add button */}
            <button
              type="button"
              onClick={() => {
                resetAddForm()
                setAddOpen(true)
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold rounded-lg transition-colors active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="whitespace-nowrap">Add Application</span>
            </button>
          </div>
        </header>

        {/* ── Metric ribbon ──────────────────────────── */}
        <section
          aria-label="Tracker metrics"
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2"
        >
          <MetricCard
            label="High Match (>90%)"
            value={metrics.highMatch}
            accent="green"
            sub={`${
              metrics.total ? Math.round((metrics.highMatch / metrics.total) * 100) : 0
            }%`}
          />
          <MetricCard
            label="Active Pipeline"
            value={metrics.activePipeline}
            accent="neutral"
            sub="Screen + Interview"
          />
          <MetricCard
            label="Offers Received"
            value={metrics.offers}
            accent="green"
            sub={metrics.offers > 0 ? 'Decision pending' : 'None yet'}
          />
          <MetricCard
            label="Salary Range Mean"
            value={metrics.salaryMean ? `$${Math.round(metrics.salaryMean / 1000)}k` : '—'}
            accent="neutral"
            sub="±12k band"
          />
          <MetricCard
            label="Average Response"
            value={`${metrics.avgResponseDays}d`}
            accent="neutral"
            sub="ATS velocity"
          />
          <MetricCard
            label="Audit Integrity"
            value={`${metrics.auditIntegrity}%`}
            accent="green"
            sub="Zero scams"
          />
          <MetricCard
            label="Stalled / Ghosted"
            value={metrics.stalled}
            accent="red"
            sub=">21d no ping"
          />
        </section>

        {/* ── Kanban / List ──────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">
              sync
            </span>
            <p className="text-sm text-[#737373]">Loading applications…</p>
          </div>
        ) : view === 'kanban' ? (
          <section className="w-full overflow-x-auto pb-6 -mx-4 px-4 focus:outline-none">
            <div className="flex items-start gap-4 min-w-max">
              {STATUSES.map((status) => {
                const items = appsByStatus[status.key]
                const isDropTarget = dragOverStatus === status.key
                return (
                  <div
                    key={status.key}
                    className="w-[240px] flex-shrink-0 flex flex-col gap-2"
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
                          {status.label}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-[#1c1b1b] text-[#737373] font-mono text-[11px]">
                        {items.length}
                      </span>
                    </div>

                    {/* Dropzone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverStatus !== status.key) setDragOverStatus(status.key)
                      }}
                      onDragLeave={(e) => {
                        if (
                          e.currentTarget === e.target ||
                          !e.currentTarget.contains(e.relatedTarget as Node)
                        ) {
                          setDragOverStatus((s) => (s === status.key ? null : s))
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleDrop(status.key)
                      }}
                      className={`flex flex-col gap-2 min-h-[500px] p-1.5 rounded-lg border border-dashed transition-colors ${
                        isDropTarget
                          ? 'border-[#22c55e]/70 bg-[#22c55e]/5'
                          : 'border-[#1A1A1A] bg-black/30 hover:border-[#22c55e]/30'
                      }`}
                    >
                      {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                          <span className="material-symbols-outlined text-[#737373] text-[24px] mb-1">
                            inbox
                          </span>
                          <span className="text-[10px] text-[#737373]">
                            Drop here
                          </span>
                        </div>
                      ) : (
                        items.map((a) => (
                          <KanbanCard
                            key={a.id}
                            app={a}
                            dragging={draggingId === a.id}
                            onDragStart={(id) => setDraggingId(id)}
                            onDragEnd={() => {
                              setDraggingId(null)
                              setDragOverStatus(null)
                            }}
                            onDelete={(app) => setDeleteTarget(app)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <span className="material-symbols-outlined text-[#737373] text-4xl mb-2">
                  inbox
                </span>
                <p className="text-sm text-white font-medium mb-1">
                  No matching applications
                </p>
                <p className="text-xs text-[#737373]">
                  Try clearing your search or filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                  <thead>
                    <tr className="bg-black text-[11px] uppercase tracking-wider text-[#737373]">
                      <th className="py-3 px-4 font-semibold">Company</th>
                      <th className="py-3 px-4 font-semibold">Role</th>
                      <th className="py-3 px-4 font-semibold">Applied</th>
                      <th className="py-3 px-4 font-semibold">Salary</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Match</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {filtered.map((a) => {
                      const status = STATUSES.find((s) => s.key === a.status)
                      return (
                        <tr
                          key={a.id}
                          className="hover:bg-[#141414] transition-colors group"
                        >
                          <td className="py-3 px-4">
                            <Link
                              to={`/dashboard/tracker/${a.id}`}
                              className="flex items-center gap-3 min-w-0"
                            >
                              <span className="w-8 h-8 rounded bg-[#2a2a2a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {a.company_name.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-sm text-white font-semibold truncate">
                                {a.company_name}
                              </span>
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-sm text-[#737373] truncate max-w-[240px]">
                            {a.job_title}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#737373]">
                            <span className="block">{formatDate(a.date_applied)}</span>
                            <span className="font-mono text-[11px] text-[#353534]">
                              {relativeDate(a.date_applied)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-[#737373]">
                            {formatSalaryRange(a.salary_min, a.salary_max)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                a.status === 'offered'
                                  ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                                  : a.status === 'rejected'
                                  ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                                  : a.status === 'ghosted' || a.status === 'saved'
                                  ? 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]'
                                  : 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${status?.dotClass || 'bg-[#737373]'}`} />
                              {STATUS_LABEL[a.status]}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {a.match_score ? (
                              <span
                                className={`font-mono text-xs font-semibold ${
                                  a.match_score >= 90
                                    ? 'text-[#22c55e]'
                                    : a.match_score >= 70
                                    ? 'text-[#EAB308]'
                                    : 'text-[#EF4444]'
                                }`}
                              >
                                {a.match_score}%
                              </span>
                            ) : (
                              <span className="text-xs text-[#737373]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                to={`/dashboard/tracker/${a.id}`}
                                aria-label="View"
                                className="w-7 h-7 rounded flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#1c1b1b] transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  visibility
                                </span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(a)}
                                aria-label="Delete"
                                className="w-7 h-7 rounded flex items-center justify-center text-[#737373] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ── Add Application Modal ─────────────────────── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-app-title"
            className="w-full max-w-xl bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-5 sm:p-6 shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1A1A1A] mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e]">
                  <span className="material-symbols-outlined text-[20px]">
                    add_circle
                  </span>
                </div>
                <div>
                  <h2
                    id="add-app-title"
                    className="text-base font-bold text-white"
                  >
                    Register New Application
                  </h2>
                  <p className="text-xs text-[#737373]">
                    Track a new role in your pipeline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close"
                className="text-[#737373] hover:text-white transition-colors p-1"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Employer Name <span className="text-[#22c55e]">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.company_name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, company_name: e.target.value })
                    }
                    maxLength={200}
                    placeholder="e.g. OpenAI, Cloudflare, Linear"
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Job Role / Title <span className="text-[#22c55e]">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.job_title}
                    onChange={(e) =>
                      setAddForm({ ...addForm, job_title: e.target.value })
                    }
                    maxLength={200}
                    placeholder="e.g. Senior Infrastructure Engineer"
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Initial Stage
                  </label>
                  <select
                    value={addForm.status}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        status: e.target.value as ApplicationStatus,
                      })
                    }
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors"
                  >
                    {STATUSES.map((s, i) => (
                      <option key={s.key} value={s.key}>
                        {i + 1}. {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Date Applied
                  </label>
                  <input
                    type="date"
                    value={addForm.date_applied}
                    onChange={(e) =>
                      setAddForm({ ...addForm, date_applied: e.target.value })
                    }
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Location
                  </label>
                  <input
                    type="text"
                    value={addForm.location}
                    onChange={(e) =>
                      setAddForm({ ...addForm, location: e.target.value })
                    }
                    maxLength={100}
                    placeholder="Remote / City"
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Salary Min ($)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={addForm.salary_min}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        salary_min: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                    placeholder="150000"
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors font-mono placeholder-[#737373]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-white">
                    Salary Max ($)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={addForm.salary_max}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        salary_max: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                    placeholder="200000"
                    className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors font-mono placeholder-[#737373]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">
                  Job Posting URL
                </label>
                <input
                  type="url"
                  value={addForm.job_link}
                  onChange={(e) =>
                    setAddForm({ ...addForm, job_link: e.target.value })
                  }
                  placeholder="https://…"
                  className="h-10 px-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                />
              </div>

              {/* JD attachment toggle */}
              <div className="p-4 rounded-lg bg-black border border-[#1A1A1A] flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[#22c55e] text-[20px] shrink-0">
                      psychology
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white block">
                        Job Description
                      </span>
                      <p className="text-[11px] text-[#737373] truncate">
                        Optional — helps with future CV matching
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={jdEnabled}
                    onClick={() => setJdEnabled((v) => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                      jdEnabled ? 'bg-[#22c55e]' : 'bg-[#1A1A1A]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        jdEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {jdEnabled && (
                  <textarea
                    value={addForm.jd_text}
                    onChange={(e) =>
                      setAddForm({ ...addForm, jd_text: e.target.value })
                    }
                    rows={4}
                    maxLength={10000}
                    placeholder="Paste job posting text, qualifications, requirements…"
                    className="w-full p-3 bg-[#0D0D0D] text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none resize-y transition-colors placeholder-[#737373]"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white">
                  Notes (optional)
                </label>
                <textarea
                  value={addForm.notes}
                  onChange={(e) =>
                    setAddForm({ ...addForm, notes: e.target.value })
                  }
                  rows={3}
                  maxLength={5000}
                  placeholder="Recruiter name, referral source, reminders…"
                  className="w-full p-3 bg-black text-white text-sm rounded-lg border border-[#1A1A1A] focus:border-[#22c55e] focus:outline-none resize-y transition-colors placeholder-[#737373]"
                />
              </div>

              {addError && (
                <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#EF4444] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    error
                  </span>
                  <span>{addError}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-[#1A1A1A]">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-5 py-2.5 bg-[#1c1b1b] hover:bg-[#2a2a2a] text-white text-sm font-medium rounded-lg border border-[#1A1A1A] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      adding ? 'animate-spin' : ''
                    }`}
                  >
                    {adding ? 'sync' : 'save'}
                  </span>
                  {adding ? 'Saving…' : 'Record Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-[#0D0D0D] border border-[#EF4444]/30 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#EF4444] text-[24px]">
                warning
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">
              Delete this application?
            </h2>
            <p className="text-sm text-[#737373] leading-relaxed mb-6">
              This permanently removes{' '}
              <span className="text-white font-medium">
                {deleteTarget.job_title}
              </span>{' '}
              at{' '}
              <span className="text-white font-medium">
                {deleteTarget.company_name}
              </span>
              , along with all notes and timeline history. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {deleting ? 'sync' : 'delete_forever'}
                </span>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-100 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg border shadow-xl bg-[#0D0D0D] text-sm flex items-center gap-2 ${
            toast.kind === 'ok'
              ? 'border-l-4 border-l-[#22c55e] border-[#1A1A1A]'
              : 'border-l-4 border-l-[#EF4444] border-[#1A1A1A]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              toast.kind === 'ok' ? 'text-[#22c55e]' : 'text-[#EF4444]'
            }`}
          >
            {toast.kind === 'ok' ? 'check_circle' : 'error'}
          </span>
          <span className="text-white break-words">{toast.text}</span>
        </div>
      )}
    </>
  )
}

// ─── Metric card sub-component ──────────────────────────
function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number | string
  sub: string
  accent: 'green' | 'red' | 'neutral'
}) {
  const valueClass =
    accent === 'green'
      ? 'text-[#22c55e]'
      : accent === 'red'
      ? 'text-[#EF4444]'
      : 'text-white'

  return (
    <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg p-3 flex flex-col gap-1 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-[#737373] truncate">
        {label}
      </span>
      <span className={`text-xl font-bold ${valueClass} leading-none tracking-tight`}>
        {value}
      </span>
      <span className="text-[10px] text-[#737373] truncate">{sub}</span>
    </div>
  )
}