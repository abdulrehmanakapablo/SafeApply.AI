// FILE: src/pages/dashboard/ApplicationDetail.tsx
// ROUTE: /dashboard/tracker/:id (auth required)
// BACKEND: GET    /api/tracker/:id
//          PATCH  /api/tracker/:id
//          DELETE /api/tracker/:id
//          POST   /api/tracker/:id/communication
// PURPOSE: Single application detail with inline status change, notes autosave,
//          communication log, timeline, and stored JD.

import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import {
  getApplication,
  updateApplication,
  deleteApplication,
  addCommunication,
  type ApplicationDetail as AppDetail,
  type ApplicationStatus,
  type CommunicationType,
} from '../../api/tracker'

// ─── Types ────────────────────────────────────────────────
interface StatusMeta {
  value: ApplicationStatus
  label: string
  dotClass: string
  badgeClass: string
}

interface CommTypeMeta {
  value: CommunicationType
  label: string
  badgeClass: string
}

// ─── Config ───────────────────────────────────────────────
const STATUS_META: StatusMeta[] = [
  { value: 'saved',        label: 'Saved',              dotClass: 'bg-[#737373]', badgeClass: 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]' },
  { value: 'applied',      label: 'Applied',            dotClass: 'bg-[#22C55E]', badgeClass: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30' },
  { value: 'screening',    label: 'Screening',          dotClass: 'bg-[#EAB308]', badgeClass: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30' },
  { value: 'interviewing', label: 'Interviewing',       dotClass: 'bg-[#EAB308]', badgeClass: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30' },
  { value: 'offered',      label: 'Offer Received',     dotClass: 'bg-[#22C55E]', badgeClass: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30' },
  { value: 'rejected',     label: 'Archived / Rejected',dotClass: 'bg-[#EF4444]', badgeClass: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30' },
  { value: 'ghosted',      label: 'Ghosted',            dotClass: 'bg-[#737373]', badgeClass: 'bg-[#737373]/15 text-[#737373] border-[#737373]/30' },
]

const COMM_TYPES: CommTypeMeta[] = [
  { value: 'email',     label: 'Email',     badgeClass: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30' },
  { value: 'call',      label: 'Call',      badgeClass: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30' },
  { value: 'interview', label: 'Interview', badgeClass: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30' },
  { value: 'follow_up', label: 'Follow Up', badgeClass: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30' },
  { value: 'rejection', label: 'Rejection', badgeClass: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30' },
]

function statusMeta(status: ApplicationStatus): StatusMeta {
  return STATUS_META.find((s) => s.value === status) || STATUS_META[0]
}

function commMeta(type: CommunicationType): CommTypeMeta {
  return COMM_TYPES.find((c) => c.value === type) || COMM_TYPES[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(0, Math.round((now - then) / 86_400_000))
}

function formatSalary(min?: number | null, max?: number | null): string {
  if (!min && !max) return '—'
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`
  if (min && max) return `${fmt(min)} – ${fmt(max)} USD`
  if (min) return `${fmt(min)}+ USD`
  return `Up to ${fmt(max as number)} USD`
}

const DEMO_MATCHED_SKILLS: string[] = []

const DEMO_MISSING: { skill: string; severity: 'yellow' | 'red' }[] = []

// ─── Small building blocks ────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const r = 15.9155
  const circumference = 2 * Math.PI * r
  const dash = (score / 100) * circumference

  return (
    <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#141414"
          strokeWidth="3.5"
        />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="#22C55E"
          strokeWidth="3.5"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="material-symbols-outlined text-[#22C55E] text-[20px] absolute">
        verified
      </span>
    </div>
  )
}

function SectionHeading({
  icon,
  title,
  right,
}: {
  icon: string
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1A1A1A] gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="material-symbols-outlined text-[18px] text-[#737373] shrink-0">
          {icon}
        </span>
        <span className="text-[15px] font-semibold text-white tracking-tight truncate">
          {title}
        </span>
      </div>
      {right}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────
export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [app, setApp] = useState<AppDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [jdExpanded, setJdExpanded] = useState(true)
  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const [commModalOpen, setCommModalOpen] = useState(false)
  const [commForm, setCommForm] = useState<{
    type: CommunicationType
    notes: string
    date: string
  }>({
    type: 'email',
    notes: '',
    date: new Date().toISOString().slice(0, 10),
  })

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const statusMenuRef = useRef<HTMLDivElement>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedNotesRef = useRef<string>('')

  // ── Fetch application ──────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const res = await getApplication(id as string)
        if (cancelled) return
        if (res.success && res.data) {
          setApp(res.data)
          setNotes(res.data.notes || '')
          lastSavedNotesRef.current = res.data.notes || ''
        } else {
          setNotFound(true)
        }
      } catch {
        if (cancelled) return
        setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // ── Close status menu on outside click ─────────────────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setStatusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // ── Debounced notes autosave ───────────────────────────
  useEffect(() => {
    if (!app) return
    if (notes === lastSavedNotesRef.current) return
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)

    setNotesStatus('saving')
    notesTimerRef.current = setTimeout(async () => {
      try {
        if (!app.id.startsWith('demo-')) {
          await updateApplication(app.id, { notes })
        }
        lastSavedNotesRef.current = notes
        setNotesStatus('saved')
        setTimeout(() => setNotesStatus('idle'), 2500)
      } catch {
        setNotesStatus('idle')
      }
    }, 2000)

    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    }
  }, [notes, app])

  // ── Handlers ───────────────────────────────────────────
  async function handleStatusChange(next: ApplicationStatus) {
    if (!app || app.status === next) {
      setStatusMenuOpen(false)
      return
    }
    setStatusMenuOpen(false)
    const prev = app.status
    setApp({ ...app, status: next })
    setActionLoading(true)
    try {
      if (!app.id.startsWith('demo-')) {
        await updateApplication(app.id, { status: next })
        // refresh timeline
        const res = await getApplication(app.id)
        if (res.success && res.data) setApp(res.data)
      } else {
        // demo mode — append timeline entry locally
        setApp((curr) =>
          curr
            ? {
                ...curr,
                timeline: [
                  {
                    id: `demo-${Date.now()}`,
                    application_id: curr.id,
                    status: next,
                    changed_at: new Date().toISOString(),
                  },
                  ...curr.timeline,
                ],
              }
            : curr
        )
      }
    } catch {
      setApp((curr) => (curr ? { ...curr, status: prev } : curr))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAddComm(e: React.FormEvent) {
    e.preventDefault()
    if (!app) return
    if (!commForm.notes.trim()) return

    setActionLoading(true)
    try {
      if (!app.id.startsWith('demo-')) {
        const res = await addCommunication(app.id, {
          type: commForm.type,
          notes: commForm.notes.trim(),
          date: commForm.date,
        })
        if (res.success) {
          const refreshed = await getApplication(app.id)
          if (refreshed.success && refreshed.data) setApp(refreshed.data)
        }
      } else {
        setApp((curr) =>
          curr
            ? {
                ...curr,
                communication_log: [
                  {
                    id: `demo-${Date.now()}`,
                    application_id: curr.id,
                    type: commForm.type,
                    notes: commForm.notes.trim(),
                    date: `${commForm.date}T12:00:00Z`,
                    created_at: new Date().toISOString(),
                  },
                  ...curr.communication_log,
                ],
              }
            : curr
        )
      }
      setCommForm({
        type: 'email',
        notes: '',
        date: new Date().toISOString().slice(0, 10),
      })
      setCommModalOpen(false)
    } catch {
      // ignore — pilot mode
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete() {
    if (!app) return
    setActionLoading(true)
    try {
      if (!app.id.startsWith('demo-')) {
        await deleteApplication(app.id)
      }
      navigate('/dashboard/tracker')
    } catch {
      setActionLoading(false)
      setDeleteModalOpen(false)
    }
  }

  // Derived
  const meta = useMemo(
    () => (app ? statusMeta(app.status) : STATUS_META[0]),
    [app]
  )

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <SEO
          title="Application | SafeApply.AI"
          description="Application detail."
          path="/dashboard/tracker"
          noindex
        />
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-[#22c55e] text-4xl animate-spin">
              sync
            </span>
            <p className="text-sm text-[#737373]">Loading application…</p>
          </div>
        </div>
      </>
    )
  }

  if (notFound || !app) {
    return (
      <>
        <SEO
          title="Application not found | SafeApply.AI"
          description="Application not found."
          path="/dashboard/tracker"
          noindex
        />
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <span className="material-symbols-outlined text-[#737373] text-5xl mb-4">
            search_off
          </span>
          <h2 className="text-2xl font-bold text-white mb-2">
            Application not found
          </h2>
          <p className="text-sm text-[#737373] mb-6 max-w-sm">
            This application may have been deleted or the link is invalid.
          </p>
          <Link
            to="/dashboard/tracker"
            className="bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            Back to Tracker
          </Link>
        </div>
      </>
    )
  }

  const appliedDays = daysAgo(app.date_applied)

  return (
    <>
      <SEO
        title={`${app.company_name} — ${app.job_title} | SafeApply.AI`}
        description={`Application detail for ${app.job_title} at ${app.company_name}.`}
        path={`/dashboard/tracker/${app.id}`}
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ── Breadcrumb ─────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/tracker"
              className="inline-flex items-center gap-1.5 text-[#737373] hover:text-white transition-colors text-sm font-medium group"
            >
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-0.5">
                arrow_back
              </span>
              Back to Tracker
            </Link>
            <span className="text-[#353534] text-sm select-none">/</span>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#0D0D0D] border border-[#1A1A1A]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
              </span>
              <span className="font-mono text-[11px] tracking-wider text-[#737373] uppercase">
                TRACKER /{' '}
                <span className="text-[#22c55e] font-bold">
                  APP_ID: {app.id.slice(0, 12).toUpperCase()}
                </span>
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-[#737373]">
            <span>
              SYNC ENGINE: <span className="text-white">ONLINE (99.98%)</span>
            </span>
            <span className="text-[#353534]">•</span>
            <span>
              LAST TELEMETRY: <span className="text-white">2M AGO</span>
            </span>
          </div>
        </div>

        {/* ── Header card ────────────────────────────── */}
        <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-none">
                  {app.company_name}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
                  Tier-1 Target
                </span>
              </div>
              <p className="text-base text-[#737373] font-normal mt-1 truncate">
                {app.job_title}
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-[#737373]">
                <span>Applied {formatDate(app.date_applied)}</span>
                <span className="text-[#353534]">•</span>
                <span className="text-white font-medium">
                  {formatSalary(app.salary_min, app.salary_max)}
                </span>
                {app.location && (
                  <>
                    <span className="text-[#353534]">•</span>
                    <span>{app.location}</span>
                  </>
                )}
                <span className="text-[#353534]">•</span>
                <span>Full-Time</span>
                <span className="text-[#353534]">•</span>
                <span className="font-mono text-[11px]">
                  Requisition ID: #{app.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Status dropdown + action */}
            <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
              <div className="relative" ref={statusMenuRef}>
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold border transition-colors ${meta.badgeClass}`}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                  <span>Status: {meta.label}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    expand_more
                  </span>
                </button>

                {statusMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg py-1 z-30 shadow-2xl">
                    {STATUS_META.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => handleStatusChange(s.value)}
                        disabled={actionLoading}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${
                          s.value === app.status
                            ? 'bg-[#141414] text-white'
                            : 'text-[#737373] hover:bg-[#141414] hover:text-white'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${s.dotClass}`}
                        />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link
                to="/dashboard/company-report"
                className="inline-flex items-center gap-1.5 bg-[#0D0D0D] border border-[#22c55e] text-[#22c55e] hover:bg-[#141414] text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
              >
                <span>Run Company Report</span>
                <span className="material-symbols-outlined text-[15px]">
                  north_east
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── 3-column diagnostic matrix ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Col 1 — Application Info */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6 flex flex-col justify-between">
            <div>
              <SectionHeading
                icon="info"
                title="Application Info"
                right={
                  <button
                    type="button"
                    aria-label="Edit details"
                    className="text-[#737373] hover:text-[#22c55e] transition-colors p-1 rounded hover:bg-[#141414]"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      edit
                    </span>
                  </button>
                }
              />
              <div className="grid grid-cols-1 gap-3 text-sm">
                <InfoRow label="Company" value={`${app.company_name}`} sub="(Enterprise Fintech)" />
                <InfoRow label="Role" value={app.job_title} />
                <InfoRow
                  label="Date Applied"
                  value={
                    <>
                      {formatDate(app.date_applied)}{' '}
                      <span className="text-[#737373] text-[11px]">
                        ({appliedDays} days ago)
                      </span>
                    </>
                  }
                />
                <InfoRow
                  label="Salary Range"
                  value={
                    <span className="text-[#22c55e] font-mono">
                      {formatSalary(app.salary_min, app.salary_max)}
                    </span>
                  }
                />
                <InfoRow label="Location" value={app.location || '—'} />
                <InfoRow
                  label="Portal"
                  value="Greenhouse ATS"
                />
                {app.job_link && (
                  <div className="pt-1">
                    <span className="font-mono text-[10px] uppercase text-[#737373] tracking-wider">
                      Job Link
                    </span>
                    <a
                      href={app.job_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#22c55e] hover:underline font-mono text-xs mt-1 inline-flex items-center gap-1 break-all"
                    >
                      <span>{app.job_link.replace(/^https?:\/\//, '')}</span>
                      <span className="material-symbols-outlined text-[14px] shrink-0">
                        north_east
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#1A1A1A] flex items-center justify-between text-[11px] font-mono text-[#737373]">
              <span>SECURITY ENCLAVE</span>
              <span className="text-[#22c55e]">E2E ENCRYPTED</span>
            </div>
          </div>

          {/* Col 2 — Neural Match Telemetry */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6 flex flex-col justify-between">
            <div>
              <SectionHeading
                icon="psychology"
                title="Neural Match Telemetry"
                right={
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30 whitespace-nowrap">
                    ATS ENGINE V4.8
                  </span>
                }
              />

              {app.match_score ? (
                <>
                  <div className="bg-black border border-[#1A1A1A] rounded p-4 mb-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-4xl font-extrabold text-[#22c55e] leading-none">
                        {app.match_score}%
                      </div>
                      <div className="font-mono text-xs text-white mt-1">
                        High Resonance Match
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        Top 3rd percentile for this profile
                      </div>
                    </div>
                    <ScoreGauge score={app.match_score} />
                  </div>

                  <div className="mb-4">
                    <div className="font-mono text-[10px] uppercase text-[#737373] tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Skills Detected</span>
                      <span className="text-[#22c55e]">6 / 6 Critical</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DEMO_MATCHED_SKILLS.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="font-mono text-[10px] uppercase text-[#737373] tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Missing Competencies</span>
                      <span className="text-[#EAB308]">Low Impact</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DEMO_MISSING.map((m) => (
                        <span
                          key={m.skill}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            m.severity === 'yellow'
                              ? 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30'
                              : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                          }`}
                        >
                          {m.skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded bg-[#141414] border border-[#1A1A1A] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#22c55e] text-[18px] shrink-0">
                      check_circle
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-white font-medium">
                        ATS Format Health
                      </span>
                      <span className="text-[11px] text-[#737373]">
                        100% clean single-column structure verified
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-center py-8">
                  <span className="material-symbols-outlined text-[#737373] text-4xl mb-2">
                    psychology_alt
                  </span>
                  <p className="text-sm text-[#737373] mb-4">
                    No CV analysis yet for this role.
                  </p>
                  <Link
                    to="/dashboard/cv-match"
                    className="inline-flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <span>Run CV Match</span>
                    <span className="material-symbols-outlined text-[14px]">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              )}
            </div>

            {app.match_score && (
              <button
                type="button"
                className="mt-4 w-full bg-[#0D0D0D] border border-[#1A1A1A] text-white hover:border-[#22c55e]/50 hover:text-[#22c55e] text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">
                  sync
                </span>
                Re-run CV Match
              </button>
            )}
          </div>

          {/* Col 3 — History & Milestones */}
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6 flex flex-col justify-between">
            <div>
              <SectionHeading
                icon="history"
                title="History & Milestones"
                right={
                  <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
                    {app.timeline.length} AUDITED PHASES
                  </span>
                }
              />

              {app.timeline.length === 0 ? (
                <p className="text-xs text-[#737373]">No history yet.</p>
              ) : (
                <div className="relative pl-6 space-y-5 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-[#1A1A1A]">
                  {app.timeline.map((t, i) => {
                    const sm = statusMeta(t.status as ApplicationStatus)
                    return (
                      <div key={t.id} className="relative">
                        <div
                          className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#0D0D0D] border-2 flex items-center justify-center ring-4 ring-[#0D0D0D] ${
                            i === 0 ? 'border-[#EAB308]' : 'border-[#22c55e]'
                          }`}
                        >
                          <div
                            className={`w-1 h-1 rounded-full ${
                              i === 0 ? 'bg-[#EAB308]' : 'bg-[#22c55e]'
                            }`}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-white font-semibold">
                            {sm.label}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#737373] mt-0.5">
                            <span>{formatDate(t.changed_at)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="pt-3 mt-4 border-t border-[#1A1A1A] flex items-center justify-between">
              <span className="text-xs text-[#737373] uppercase tracking-wider font-semibold">
                ESTIMATED VELOCITY
              </span>
              <span className="font-mono text-[11px] text-[#22c55e]">
                RAPID (+2.4d avg)
              </span>
            </div>
          </div>
        </div>

        {/* ── Notes card ─────────────────────────────── */}
        <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#22c55e]">
                edit_note
              </span>
              <span className="text-[15px] font-semibold text-white tracking-tight">
                Internal Candidate Notes
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#22c55e] min-h-[18px]">
              {notesStatus === 'saving' && (
                <>
                  <span>Saving…</span>
                  <span className="material-symbols-outlined text-[14px] animate-spin">
                    sync
                  </span>
                </>
              )}
              {notesStatus === 'saved' && (
                <>
                  <span>Auto-saved</span>
                  <span className="material-symbols-outlined text-[14px]">
                    done
                  </span>
                </>
              )}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Type strategic notes, interview feedback, or debrief telemetry..."
            className="w-full bg-black border border-[#1A1A1A] rounded-lg p-4 text-white text-sm leading-relaxed focus:outline-none focus:border-[#22c55e] transition-colors resize-y placeholder:text-[#737373]"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-[#737373]">
            <span>MARKDOWN ENABLED</span>
            <span>{notes.length} CHARACTERS</span>
          </div>
        </div>

        {/* ── Communication log ──────────────────────── */}
        <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6">
          <SectionHeading
            icon="chat"
            title="Communication Log"
            right={
              <button
                type="button"
                onClick={() => setCommModalOpen(true)}
                className="inline-flex items-center gap-1 bg-[#0D0D0D] border border-[#22c55e] text-[#22c55e] hover:bg-[#141414] text-xs font-semibold py-1 px-3 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">
                  add
                </span>
                Add Entry
              </button>
            }
          />

          {app.communication_log.length === 0 ? (
            <p className="text-sm text-[#737373] py-4 text-center">
              No communication logged yet. Add the first entry to start tracking.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[#1A1A1A]">
              {app.communication_log.map((c) => {
                const cm = commMeta(c.type)
                return (
                  <div
                    key={c.id}
                    className="py-3 flex flex-col md:flex-row md:items-start gap-3 hover:bg-[#141414]/40 px-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 shrink-0 md:w-44">
                      <span className="font-mono text-xs text-[#737373]">
                        {formatDate(c.date)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cm.badgeClass}`}
                      >
                        {cm.label}
                      </span>
                    </div>
                    <p className="text-sm text-white leading-relaxed flex-1">
                      {c.notes}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── JD card (collapsible) ──────────────────── */}
        {app.jd_text && (
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[12px] p-6">
            <button
              type="button"
              onClick={() => setJdExpanded((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#737373]">
                  article
                </span>
                <span className="text-[15px] font-semibold text-white tracking-tight">
                  Stored Job Description
                </span>
              </div>
              <span className="text-xs text-[#737373] hover:text-white transition-colors flex items-center gap-1">
                <span>{jdExpanded ? 'Collapse JD' : 'Expand JD'}</span>
                <span className="material-symbols-outlined text-[16px]">
                  {jdExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </span>
            </button>

            {jdExpanded && (
              <div className="mt-4 bg-black border border-[#1A1A1A] rounded-lg p-5 text-[#737373] text-[13px] leading-relaxed font-mono whitespace-pre-wrap">
                {app.jd_text}
              </div>
            )}
          </div>
        )}

        {/* ── Bottom actions ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-[#1A1A1A]">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dashboard/company-report"
              className="inline-flex items-center gap-1.5 bg-[#0D0D0D] border border-[#1A1A1A] text-white hover:border-[#22c55e]/50 hover:text-[#22c55e] text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
            >
              <span>Run Company Report</span>
              <span className="material-symbols-outlined text-[16px]">
                open_in_new
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCommModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-[#0D0D0D] border border-[#1A1A1A] text-white hover:border-[#22c55e]/50 hover:text-[#22c55e] text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                notification_add
              </span>
              <span>+ Log Follow-up Reminder</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 bg-transparent border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              delete_forever
            </span>
            Delete Application
          </button>
        </div>
      </div>

      {/* ── Add Communication Modal ──────────────────── */}
      {commModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCommModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                Add Communication Entry
              </h3>
              <button
                type="button"
                onClick={() => setCommModalOpen(false)}
                className="text-[#737373] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddComm} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                  Type
                </label>
                <select
                  value={commForm.type}
                  onChange={(e) =>
                    setCommForm({
                      ...commForm,
                      type: e.target.value as CommunicationType,
                    })
                  }
                  className="w-full h-10 px-3 bg-black border border-[#1A1A1A] rounded text-white text-sm focus:outline-none focus:border-[#22c55e]"
                >
                  {COMM_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                  Date
                </label>
                <input
                  type="date"
                  value={commForm.date}
                  onChange={(e) =>
                    setCommForm({ ...commForm, date: e.target.value })
                  }
                  className="w-full h-10 px-3 bg-black border border-[#1A1A1A] rounded text-white text-sm focus:outline-none focus:border-[#22c55e]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                  Notes
                </label>
                <textarea
                  value={commForm.notes}
                  onChange={(e) =>
                    setCommForm({ ...commForm, notes: e.target.value })
                  }
                  required
                  rows={4}
                  placeholder="What happened? Recruiter, topics, next steps…"
                  className="w-full bg-black border border-[#1A1A1A] rounded p-3 text-white text-sm focus:outline-none focus:border-[#22c55e] resize-y placeholder:text-[#737373]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCommModalOpen(false)}
                  className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !commForm.notes.trim()}
                  className="bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {actionLoading ? 'Saving…' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────── */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#0D0D0D] border border-[#EF4444]/30 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#EF4444] text-[24px]">
                warning
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Delete this application?
            </h3>
            <p className="text-sm text-[#737373] leading-relaxed mb-6">
              This permanently removes{' '}
              <span className="text-white font-medium">
                {app.job_title}
              </span>{' '}
              at{' '}
              <span className="text-white font-medium">
                {app.company_name}
              </span>
              , along with all notes, timeline history, and communication log entries.
              This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                {actionLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Info row helper ──────────────────────────────────────
function InfoRow({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: string
}) {
  return (
    <div className="flex flex-col py-1 border-b border-[#1A1A1A]/50 last:border-0">
      <span className="font-mono text-[10px] uppercase text-[#737373] tracking-wider">
        {label}
      </span>
      <span className="text-white font-medium mt-0.5 text-sm">
        {value}
        {sub && (
          <span className="text-[#737373] text-[11px] font-normal ml-1">
            {sub}
          </span>
        )}
      </span>
    </div>
  )
}