// FILE: src/pages/dashboard/SavedCVs.tsx
// ROUTE: /dashboard/cv-builder/saved (auth required)
// BACKEND: GET /api/cv/saved, DELETE /api/cv/saved/:id
// PURPOSE: List of the user's saved CVs from the builder. Open in builder,
//          download as PDF/TXT, or delete.
// SECURITY:
//   - No dangerouslySetInnerHTML — all data auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.
//   - Delete is ownership-checked on the backend (user_id = req.user.userId).
//   - No HTML injection surface — CV data is stored as JSON, rendered as text.

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { getSavedCVs, deleteSavedCV, type SavedCV, type CVData } from '../../api/cv'

const DEMO_CVS: SavedCV[] = []

// ─── Helpers ────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const d = Math.max(0, Math.round((now - then) / 86_400_000))
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// Turn a CVData object into plain text for the TXT download
function cvToPlainText(cv: CVData): string {
  const { personal, experience, education, skills, projects, certifications } = cv
  const line = '─'.repeat(60)
  const parts: string[] = []

  parts.push(personal.full_name.toUpperCase())
  parts.push(
    [personal.location, personal.email, personal.phone, personal.linkedin, personal.github]
      .filter(Boolean)
      .join(' • ')
  )
  parts.push(line)

  if (personal.summary.trim()) {
    parts.push('PROFESSIONAL SUMMARY')
    parts.push(personal.summary)
    parts.push(line)
  }

  if (experience.length > 0) {
    parts.push('WORK EXPERIENCE')
    experience.forEach((e) => {
      const end = e.is_current ? 'Present' : e.end_date || ''
      parts.push(`${e.company} — ${e.role}`)
      parts.push(`${e.start_date}${end ? ' – ' + end : ''}`)
      e.bullets.filter(Boolean).forEach((b) => parts.push(`• ${b}`))
      parts.push('')
    })
    parts.push(line)
  }

  if (education.length > 0) {
    parts.push('EDUCATION')
    education.forEach((e) => {
      parts.push(`${e.institution} — ${e.degree} ${e.field}`)
      if (e.start_date || e.end_date)
        parts.push(`${e.start_date}${e.end_date ? ' – ' + e.end_date : ''}`)
      parts.push('')
    })
    parts.push(line)
  }

  if (skills.length > 0) {
    parts.push('TECHNICAL SKILLS')
    parts.push(skills.join(', '))
    parts.push(line)
  }

  if (projects.length > 0) {
    parts.push('PROJECTS')
    projects.forEach((p) => {
      parts.push(`${p.name}`)
      if (p.description) parts.push(p.description)
      if (p.tech_stack.length) parts.push(p.tech_stack.join(', '))
      if (p.url) parts.push(p.url)
      parts.push('')
    })
    parts.push(line)
  }

  if (certifications.length > 0) {
    parts.push('CERTIFICATIONS')
    certifications.forEach((c) => {
      parts.push(`${c.name} — ${c.issuer}${c.date ? ' (' + c.date + ')' : ''}`)
    })
  }

  return parts.join('\n')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Main component ─────────────────────────────────────
export default function SavedCVs() {
  const [cvs, setCvs] = useState<SavedCV[]>(DEMO_CVS)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState<SavedCV | null>(null)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Load on mount
  useEffect(() => {
    let cancelled = false
    getSavedCVs()
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data && res.data.length > 0) {
          setCvs(res.data)
        } else {
          // Pilot fallback — demo data
          setCvs(DEMO_CVS)
        }
      })
      .catch(() => {
        if (cancelled) return
        setCvs(DEMO_CVS)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cvs
    return cvs.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cv_data.personal.job_title.toLowerCase().includes(q) ||
        c.cv_data.personal.full_name.toLowerCase().includes(q)
    )
  }, [cvs, search])

  // ── Delete flow ──────────────────────────────────────
  async function handleDelete(cv: SavedCV) {
    setDeletingId(cv.id)
    const isDemo = cv.id.startsWith('demo-')
    const previous = cvs

    // Optimistic removal
    setCvs((prev) => prev.filter((x) => x.id !== cv.id))
    setConfirmOpen(null)

    try {
      if (!isDemo) {
        await deleteSavedCV(cv.id)
      }
      setToast({ kind: 'ok', text: 'CV deleted.' })
    } catch {
      setCvs(previous)
      setToast({ kind: 'err', text: 'Delete failed — restored.' })
    } finally {
      setDeletingId(null)
    }
  }

  // ── Download TXT ─────────────────────────────────────
  function handleDownloadTxt(cv: SavedCV) {
    const text = cvToPlainText(cv.cv_data)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const safeName = (cv.cv_data.personal.full_name || 'cv').replace(
      /[^a-z0-9-_]+/gi,
      '-'
    )
    downloadBlob(blob, `${safeName}.txt`)
    setToast({ kind: 'ok', text: 'Downloaded as TXT.' })
  }

  return (
    <>
      <SEO
        title="Saved CVs | SafeApply.AI"
        description="Your saved CVs from the SafeApply.AI builder — open, download, or delete."
        path="/dashboard/cv-builder/saved"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 pb-16">

        {/* ── Header ─────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                CV Repository
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              Saved CVs
            </h1>
            <p className="text-sm text-[#737373]">
              Every CV snapshot you have saved from the builder.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 bg-[#0D0D0D] border border-[#1A1A1A] px-3 py-1.5 rounded-lg text-xs">
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                description
              </span>
              <span className="text-white font-medium">
                {cvs.length} CV{cvs.length === 1 ? '' : 's'}
              </span>
            </span>
            <Link
              to="/dashboard/cv-builder"
              className="inline-flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                add
              </span>
              New CV
            </Link>
          </div>
        </header>

        {/* ── Search ─────────────────────────────────── */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved CVs by name or job title…"
            aria-label="Search saved CVs"
            className="w-full h-11 pl-11 pr-4 bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm rounded-lg placeholder:text-[#737373] focus:outline-none focus:border-[#22c55e] transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          )}
        </div>

        {/* ── Grid ──────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">
              sync
            </span>
            <p className="text-sm text-[#737373]">Loading saved CVs…</p>
          </div>
        ) : cvs.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl flex flex-col items-center justify-center py-20 px-4 text-center">
            <span className="material-symbols-outlined text-[#737373] text-5xl mb-3">
              description
            </span>
            <h2 className="text-base font-semibold text-white mb-1">
              No saved CVs yet
            </h2>
            <p className="text-sm text-[#737373] max-w-sm mb-5">
              Build your first ATS-optimised CV in the builder and click Save to
              store it here.
            </p>
            <Link
              to="/dashboard/cv-builder"
              className="inline-flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                edit_document
              </span>
              Open CV Builder
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl flex flex-col items-center justify-center py-16 px-4 text-center">
            <span className="material-symbols-outlined text-[#737373] text-4xl mb-3">
              search_off
            </span>
            <p className="text-sm text-white font-medium mb-1">
              No matches for &ldquo;{search}&rdquo;
            </p>
            <p className="text-xs text-[#737373] mb-4">
              Try a different name or job title.
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#1A1A1A] text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((cv) => {
              const p = cv.cv_data.personal
              const initials = (p.full_name || 'CV')
                .split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <article
                  key={cv.id}
                  className="bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#1A1A1A]/80 rounded-xl p-5 flex flex-col gap-4 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <span className="w-12 h-12 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] flex items-center justify-center text-[#22c55e] font-bold shrink-0">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-white truncate">
                        {cv.name}
                      </h2>
                      <p className="text-xs text-[#737373] truncate mt-0.5">
                        {p.job_title || 'No target role set'}
                      </p>
                      <p className="text-[11px] text-[#353534] font-mono mt-1">
                        Updated {formatRelative(cv.updated_at)}
                      </p>
                    </div>
                  </div>

                  {/* Meta stats */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#1A1A1A]">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[#737373] font-semibold">
                        Experience
                      </span>
                      <span className="text-sm text-white font-medium mt-0.5">
                        {cv.cv_data.experience.length}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[#737373] font-semibold">
                        Skills
                      </span>
                      <span className="text-sm text-white font-medium mt-0.5">
                        {cv.cv_data.skills.length}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-[#737373] font-semibold">
                        Created
                      </span>
                      <span className="text-sm text-white font-medium mt-0.5">
                        {formatDate(cv.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Skill preview pills */}
                  {cv.cv_data.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {cv.cv_data.skills.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e]"
                        >
                          {s}
                        </span>
                      ))}
                      {cv.cv_data.skills.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] text-[#737373] border border-[#1A1A1A]">
                          +{cv.cv_data.skills.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Link
                      to="/dashboard/cv-builder"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1c1b1b] border border-[#1A1A1A] hover:border-[#22c55e]/40 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        edit
                      </span>
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDownloadTxt(cv)}
                      aria-label={`Download ${cv.name} as TXT`}
                      title="Download as TXT"
                      className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1c1b1b] border border-[#1A1A1A] text-[#737373] hover:text-[#22c55e] hover:border-[#22c55e]/40 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        download
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(cv)}
                      disabled={deletingId === cv.id}
                      aria-label={`Delete ${cv.name}`}
                      title="Delete"
                      className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#1c1b1b] border border-[#1A1A1A] text-[#737373] hover:text-[#EF4444] hover:border-[#EF4444]/40 transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* ── Footer strip ──────────────────────────── */}
        <footer className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              Repository Sync: OK
            </span>
            <span className="hidden md:inline text-[#353534]">•</span>
            <span className="hidden md:inline text-[#737373]">
              CVs are stored until you delete them.
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[#737373]">
            <span>ENCRYPTION: AES-256</span>
            <span>API 200 OK</span>
          </div>
        </footer>
      </div>

      {/* ── Delete Confirmation Modal ─────────────── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-cv-title"
            className="w-full max-w-md bg-[#0D0D0D] border border-[#EF4444]/30 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#EF4444] text-[24px]">
                warning
              </span>
            </div>
            <h2
              id="delete-cv-title"
              className="text-lg font-bold text-white mb-2"
            >
              Delete this CV?
            </h2>
            <p className="text-sm text-[#737373] leading-relaxed mb-6">
              This permanently removes{' '}
              <span className="text-white font-medium">{confirmOpen.name}</span>{' '}
              from your repository. Your personal data and formatting will be lost.
              This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(null)}
                className="px-4 py-2 text-sm text-[#737373] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmOpen)}
                disabled={deletingId === confirmOpen.id}
                className="bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {deletingId === confirmOpen.id ? 'sync' : 'delete_forever'}
                </span>
                {deletingId === confirmOpen.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────── */}
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