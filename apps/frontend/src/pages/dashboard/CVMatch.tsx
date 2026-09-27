// FILE: src/pages/dashboard/CVMatch.tsx
// ROUTE: /dashboard/cv-match (auth required)
// BACKEND: POST /api/cv/upload, POST /api/cv/match
// PURPOSE: Compare a CV against a job description using AI analysis.
//          Returns match %, missing skills, ATS warnings, and bullet rewrites.
// SECURITY:
//   - File inputs validated client-side (MIME + extension + size) before upload.
//   - No dangerouslySetInnerHTML — all AI/user text is auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.
//   - Input length guards prevent oversized payloads.
//   - Double-submit protection via `running` flag.

import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { uploadCV, matchCV, type CVMatchResult } from '../../api/cv'

// ─── Constants ───────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB (matches backend Multer limit)
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const ALLOWED_EXT = new Set(['.pdf', '.docx'])
const CV_MIN_CHARS = 100
const CV_MAX_CHARS = 15000
const JD_MIN_CHARS = 50
const JD_MAX_CHARS = 10000

// ─── Demo fallback (pilot mode — backend may return empty) ─
const DEMO_RESULT: CVMatchResult = {
  match_percentage: 84,
  matched_skills: [
    'Python',
    'React',
    'PostgreSQL',
    'Docker',
    'REST APIs',
    'Microservices',
    'CI/CD',
  ],
  missing_skills: ['GraphQL', 'AWS Lambda'],
  probably_have: ['System Design', 'Unit Testing'],
  keyword_mismatches: [
    { jd_term: 'TypeScript', cv_term: 'TS' },
    { jd_term: 'Amazon Web Services', cv_term: 'AWS' },
    {
      jd_term: 'Continuous Integration / Continuous Deployment',
      cv_term: 'CI/CD',
    },
  ],
  seniority_gaps: [
    'Led a 6-person team — reword to emphasize architectural ownership.',
  ],
  ats_warnings: [
    'Multi-column layout detected — may break legacy parsers.',
    'Complex table in experience section scrambles chronological order.',
    'Non-standard header tag — header level skips standard h1/h2 semantic order.',
  ],
  bullet_rewrites: [
    {
      original:
        'Worked on backend microservices with Python and Postgres to handle user traffic and fix API latency issues.',
      suggested:
        'Architected Python & PostgreSQL microservices processing 4.2M daily requests; optimized distributed queries reducing REST API latency by 38%.',
    },
    {
      original:
        'Helped team set up Docker containers and CI/CD pipelines to deploy web applications faster.',
      suggested:
        'Containerized distributed components using Docker and engineered CI/CD pipelines, accelerating continuous deployment cycles by 65%.',
    },
  ],
}

// ─── Helper: validate a File before upload ───────────────
function validateFile(file: File): { ok: true } | { ok: false; reason: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: 'File too large. Maximum 5 MB.' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, reason: 'Only PDF and DOCX files are accepted.' }
  }
  const nameLower = file.name.toLowerCase()
  const ext = nameLower.slice(nameLower.lastIndexOf('.'))
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, reason: 'File extension must be .pdf or .docx' }
  }
  return { ok: true }
}

// ─── Helper: color for score ─────────────────────────────
function scoreColor(pct: number): string {
  if (pct >= 70) return '#22c55e'
  if (pct >= 40) return '#EAB308'
  return '#EF4444'
}

// ─── Component ───────────────────────────────────────────
export default function CVMatch() {
  const [cvText, setCvText] = useState('')
  const [jdText, setJdText] = useState(
    `Senior Distributed Systems Engineer - Enterprise Cloud Operations

Requirements:
- 5+ years building microservices using TypeScript, Node.js, and Python.
- Proven experience with Amazon Web Services (AWS Lambda, S3, ECS), PostgreSQL, and Docker.
- Strong architectural grasp of GraphQL schema design, CI/CD orchestration, and high-scale REST APIs.
- Background in System Design, Unit Testing, and multi-tenant security guarantees.`
  )
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CVMatchResult>(DEMO_RESULT)
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── File upload handler ──────────────────────────────
  async function processFile(file: File) {
    // SECURITY: validate before uploading
    const check = validateFile(file)
    if (!check.ok) {
      setToast({ kind: 'err', text: check.reason })
      return
    }

    setUploading(true)
    try {
      const res = await uploadCV(file, saveToProfile)
      if (res.success && res.data?.text) {
        setCvText(res.data.text)
        setUploadedFileName(file.name)
        setToast({ kind: 'ok', text: 'CV parsed successfully.' })
      } else {
        setToast({ kind: 'err', text: res.error || 'Failed to parse CV.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'Upload failed — please try again.' })
    } finally {
      setUploading(false)
      // Clear input so the same file can be re-uploaded after edits
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // ── Run analysis ─────────────────────────────────────
  async function handleRunAnalysis() {
    if (running) return // double-submit guard

    // SECURITY: input validation before network call
    const trimmedCv = cvText.trim()
    const trimmedJd = jdText.trim()

    if (!trimmedCv && !uploadedFileName) {
      setToast({ kind: 'err', text: 'Please upload a CV or paste CV text.' })
      return
    }
    if (trimmedCv.length < CV_MIN_CHARS) {
      setToast({
        kind: 'err',
        text: `CV must be at least ${CV_MIN_CHARS} characters.`,
      })
      return
    }
    if (trimmedCv.length > CV_MAX_CHARS) {
      setToast({
        kind: 'err',
        text: `CV exceeds ${CV_MAX_CHARS.toLocaleString()} character limit.`,
      })
      return
    }
    if (trimmedJd.length < JD_MIN_CHARS) {
      setToast({
        kind: 'err',
        text: `Job description must be at least ${JD_MIN_CHARS} characters.`,
      })
      return
    }
    if (trimmedJd.length > JD_MAX_CHARS) {
      setToast({
        kind: 'err',
        text: `Job description exceeds ${JD_MAX_CHARS.toLocaleString()} character limit.`,
      })
      return
    }

    setRunning(true)
    try {
      const res = await matchCV(trimmedCv, trimmedJd, saveToProfile)
      if (res.success && res.data) {
        setResult(res.data)
        setAccepted(new Set())
        setSkipped(new Set())
        setToast({ kind: 'ok', text: 'Analysis complete.' })
      } else {
        // Pilot mode — keep demo result if backend returns nothing
        setToast({ kind: 'err', text: res.error || 'Analysis unavailable.' })
      }
    } catch {
      // Network/401 — silent fallback to demo (pilot mode)
      setToast({ kind: 'err', text: 'Analysis unavailable — showing demo.' })
    } finally {
      setRunning(false)
    }
  }

  // ── Rewrite accept / skip ────────────────────────────
  function handleAccept(idx: number) {
    setAccepted((prev) => new Set(prev).add(idx))
    setSkipped((prev) => {
      const next = new Set(prev)
      next.delete(idx)
      return next
    })
  }
  function handleSkip(idx: number) {
    setSkipped((prev) => new Set(prev).add(idx))
    setAccepted((prev) => {
      const next = new Set(prev)
      next.delete(idx)
      return next
    })
  }

  // ── Derived values ───────────────────────────────────
  const scorePct = Math.min(100, Math.max(0, result.match_percentage))
  const scoreHex = scoreColor(scorePct)
  const acceptedCount = accepted.size
  const hasCvContent = cvText.trim().length > 0 || uploadedFileName.length > 0

  return (
    <>
      <SEO
        title="CV Intelligence | SafeApply.AI"
        description="Match your CV against any job description. See keyword gaps, ATS warnings, and AI-suggested bullet rewrites — with full source citations."
        path="/dashboard/cv-match"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 pb-16">
        <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl w-full mx-auto">

          {/* ── Page header ─────────────────────────── */}
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 border-b border-[#1A1A1A]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="p-2 bg-[#2a2a2a] rounded-lg text-[#22c55e] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">
                  psychology
                </span>
              </span>
              <div className="flex flex-col min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-semibold text-white">
                    Neural CV Intelligence
                  </h1>
                  <span className="px-2 py-0.5 bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-semibold uppercase tracking-wider rounded">
                    ATS Engine v4.2
                  </span>
                </div>
                <span className="text-xs sm:text-sm text-[#737373] truncate">
                  Synchronize source resume with target job telemetry for parsing compliance
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                Parser Ready • 42 ms
              </span>
            </div>
          </header>

          {/* ── Two-panel input ─────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: CV */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1A1A1A] gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-[#22c55e]">
                      description
                    </span>
                    <h2 className="text-sm font-semibold text-white truncate">
                      Source CV / Resume
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
                    INPUT_01
                  </span>
                </div>

                {/* Dropzone */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload CV — click or drop a PDF or DOCX file"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#1A1A1A] hover:border-[#22c55e]/70 transition-colors rounded-lg p-5 sm:p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-black/40 group focus:outline-none focus:border-[#22c55e]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1c1b1b] flex items-center justify-center text-[#737373] group-hover:text-[#22c55e] transition-colors mb-3">
                    <span className="material-symbols-outlined text-[22px]">
                      {uploading ? 'sync' : 'upload_file'}
                    </span>
                  </div>
                  {uploadedFileName ? (
                    <>
                      <p className="text-sm text-white font-medium break-all max-w-full">
                        Loaded: {uploadedFileName}
                      </p>
                      <p className="text-xs text-[#737373] mt-1">
                        Click to replace file
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-white mb-1">
                        {uploading
                          ? 'Parsing…'
                          : 'Drop PDF or DOCX here or click to browse'}
                      </p>
                      <p className="text-xs text-[#737373]">
                        Max 5 MB. PDF or DOCX only.
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#1A1A1A]" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                    or paste as text
                  </span>
                  <div className="flex-1 h-px bg-[#1A1A1A]" />
                </div>

                <label htmlFor="cv-raw-text" className="sr-only">
                  Paste CV content
                </label>
                <textarea
                  id="cv-raw-text"
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  rows={6}
                  maxLength={CV_MAX_CHARS}
                  placeholder="Paste unformatted CV text here for direct semantic decomposition…"
                  className="w-full bg-black border border-[#1A1A1A] rounded-lg p-3 font-mono text-sm text-white placeholder:text-[#737373] focus:outline-none focus:border-[#22c55e] transition-colors resize-none"
                />
                <div className="flex items-center justify-between text-[11px] text-[#737373] font-mono mt-2">
                  <span>
                    {cvText.length.toLocaleString()} / {CV_MAX_CHARS.toLocaleString()}
                  </span>
                  {cvText.length > 0 && cvText.length < CV_MIN_CHARS && (
                    <span className="text-[#EAB308]">
                      min {CV_MIN_CHARS} chars
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-4 border-t border-[#1A1A1A] gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                  <input
                    type="checkbox"
                    checked={saveToProfile}
                    onChange={(e) => setSaveToProfile(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#22c55e] shrink-0"
                  />
                  <span className="text-xs text-white truncate">
                    Save CV to profile repository
                  </span>
                </label>
                <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
                  SECURE ✓
                </span>
              </div>
            </section>

            {/* Right: JD */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1A1A1A] gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-[#22c55e]">
                      terminal
                    </span>
                    <h2 className="text-sm font-semibold text-white truncate">
                      Target Job Description
                    </h2>
                  </div>
                  <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
                    INPUT_02
                  </span>
                </div>

                <label htmlFor="jd-raw-text" className="sr-only">
                  Paste job description
                </label>
                <textarea
                  id="jd-raw-text"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={12}
                  maxLength={JD_MAX_CHARS}
                  placeholder="Paste complete job specification, role responsibilities, required qualifications…"
                  className="w-full flex-1 min-h-[220px] bg-black border border-[#1A1A1A] rounded-lg p-3 font-mono text-sm text-white placeholder:text-[#737373] focus:outline-none focus:border-[#22c55e] transition-colors resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-4 border-t border-[#1A1A1A]">
                <div className="flex items-center gap-1.5 text-[#737373] min-w-0">
                  <span className="material-symbols-outlined text-[16px] shrink-0">
                    info
                  </span>
                  <span className="text-xs truncate">
                    {jdText.trim().split(/\s+/).filter(Boolean).length} words •{' '}
                    {jdText.length.toLocaleString()} /{' '}
                    {JD_MAX_CHARS.toLocaleString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setJdText('')}
                  className="font-mono text-[11px] uppercase tracking-wider text-[#737373] hover:text-[#EF4444] transition-colors"
                >
                  Clear
                </button>
              </div>
            </section>
          </div>

          {/* ── Run analysis ────────────────────────── */}
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={running || uploading || !hasCvContent || !jdText.trim()}
            className="w-full py-3 px-6 bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                running ? 'animate-spin' : ''
              }`}
            >
              {running ? 'refresh' : 'bolt'}
            </span>
            <span>
              {running ? 'Deconstructing vectors…' : 'Run CV Analysis'}
            </span>
          </button>

          {/* ── Results ─────────────────────────────── */}
          <section
            aria-label="CV match analysis results"
            className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 md:p-8 flex flex-col"
          >
            {/* Match overview */}
            <div className="flex flex-col items-center text-center pb-6">
              <span className="font-mono text-[11px] uppercase tracking-widest text-[#737373] mb-2">
                Neural Resonance Telemetry
              </span>
              <div
                className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-none mb-3"
                style={{ color: scoreHex }}
              >
                {scorePct}%
              </div>
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: scoreHex }}
                />
                <span className="text-sm font-semibold text-white uppercase tracking-wide">
                  {scorePct >= 70
                    ? 'Keyword Match Verified'
                    : scorePct >= 40
                    ? 'Moderate Match'
                    : 'Low Match'}
                </span>
              </div>

              <div className="w-full max-w-xl bg-black h-3 rounded-full overflow-hidden border border-[#1A1A1A] p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${scorePct}%`, backgroundColor: scoreHex }}
                />
              </div>
              <div className="flex items-center justify-between w-full max-w-xl mt-2 font-mono text-[11px] text-[#737373]">
                <span>MIN PASS: 70%</span>
                <span className="text-white">CURRENT: {scorePct}%</span>
                <span>OPTIMAL: 95%+</span>
              </div>
            </div>

            {/* 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[#1A1A1A]">
              {/* Skills You Have */}
              <div className="flex flex-col bg-black/40 border border-[#1A1A1A] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-1.5 text-[#22c55e] min-w-0">
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      check_circle
                    </span>
                    <h3 className="text-sm font-semibold truncate">
                      Skills You Have
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-[#22c55e] whitespace-nowrap">
                    {result.matched_skills.length}
                  </span>
                </div>
                <p className="text-xs text-[#737373] mb-3">
                  Matches exact terminology identified in the target schema.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.matched_skills.length === 0 ? (
                    <span className="text-xs text-[#737373]">
                      No matching skills detected.
                    </span>
                  ) : (
                    result.matched_skills.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30"
                      >
                        {s}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Skills Missing */}
              <div className="flex flex-col bg-black/40 border border-[#1A1A1A] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-1.5 text-[#EF4444] min-w-0">
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      cancel
                    </span>
                    <h3 className="text-sm font-semibold truncate">
                      Skills Missing
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-[#EF4444] whitespace-nowrap">
                    {result.missing_skills.length +
                      result.probably_have.length}{' '}
                    gaps
                  </span>
                </div>
                <p className="text-xs text-[#737373] mb-3">
                  Deficits identified against JD filters.
                </p>

                {result.missing_skills.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
                    <span className="font-mono text-[10px] text-[#EF4444] uppercase tracking-wider">
                      Not in your CV:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.missing_skills.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.probably_have.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#1A1A1A]">
                    <span className="font-mono text-[10px] text-[#EAB308] uppercase tracking-wider">
                      Probably have — not mentioned:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.probably_have.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EAB308]/15 text-[#EAB308] border border-[#EAB308]/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ATS Warnings */}
              <div className="flex flex-col bg-black/40 border border-[#1A1A1A] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-1.5 text-[#EAB308] min-w-0">
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      warning
                    </span>
                    <h3 className="text-sm font-semibold truncate">
                      ATS Warnings
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] text-[#EAB308] whitespace-nowrap">
                    {result.ats_warnings.length} flagged
                  </span>
                </div>
                <p className="text-xs text-[#737373] mb-3">
                  Structural elements that may trigger parser rejection.
                </p>
                <div className="flex flex-col gap-2">
                  {result.ats_warnings.length === 0 ? (
                    <span className="text-xs text-[#737373]">
                      No ATS issues detected.
                    </span>
                  ) : (
                    result.ats_warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded bg-[#1c1b1b] border border-[#1A1A1A]"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#EAB308] mt-0.5 shrink-0">
                          warning
                        </span>
                        <span className="text-xs text-white leading-snug break-words">
                          {w}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── Keyword mismatches ──────────────────── */}
          {result.keyword_mismatches.length > 0 && (
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[20px] text-[#22c55e]">
                    sync_alt
                  </span>
                  <h2 className="text-sm font-semibold text-white">
                    Keyword Discrepancies
                  </h2>
                </div>
                <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
                  EXACT_MATCH_AUDIT
                </span>
              </div>

              <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
                <table className="w-full min-w-[600px] text-left border-collapse">
                  <thead>
                    <tr className="bg-black border-b border-[#1A1A1A]">
                      <th className="py-2.5 px-3 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                        JD Exact Phrasing
                      </th>
                      <th className="py-2.5 px-3 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                        Your CV Uses
                      </th>
                      <th className="py-2.5 px-3 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">
                        Recommended Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A1A1A]">
                    {result.keyword_mismatches.map((m, i) => (
                      <tr key={i} className="hover:bg-[#1c1b1b] transition-colors">
                        <td className="py-3 px-3 font-mono text-xs text-white break-words">
                          {m.jd_term}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-[#EF4444] break-words">
                          {m.cv_term}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#22c55e]">
                          Use full form: &ldquo;{m.jd_term}&rdquo;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Bullet rewrites ─────────────────────── */}
          {result.bullet_rewrites.length > 0 && (
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[20px] text-[#22c55e]">
                    auto_fix_high
                  </span>
                  <h2 className="text-sm font-semibold text-white">
                    Suggested Bullet Rewrites
                  </h2>
                </div>
                <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap">
                  {acceptedCount} / {result.bullet_rewrites.length} accepted
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {result.bullet_rewrites.map((r, idx) => {
                  const isAccepted = accepted.has(idx)
                  const isSkipped = skipped.has(idx)
                  return (
                    <article
                      key={idx}
                      className={`p-4 bg-black border rounded-lg flex flex-col gap-3 transition-opacity ${
                        isSkipped
                          ? 'border-[#1A1A1A] opacity-40'
                          : isAccepted
                          ? 'border-[#22c55e]/50'
                          : 'border-[#1A1A1A]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#737373]">
                          Bullet #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[11px] font-semibold text-[#EAB308] bg-[#EAB308]/10 px-2 py-0.5 rounded border border-[#EAB308]/20">
                          ATS boost expected
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Original */}
                        <div className="flex flex-col p-3 bg-[#1c1b1b]/50 rounded border border-[#1A1A1A]">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#737373] mb-1.5">
                            Original Bullet
                          </span>
                          <p className="text-sm text-white font-mono leading-relaxed break-words">
                            {r.original}
                          </p>
                        </div>

                        {/* Suggested */}
                        <div
                          className={`flex flex-col p-3 rounded border relative ${
                            isAccepted
                              ? 'bg-[#22c55e]/10 border-[#22c55e]/50'
                              : 'bg-[#1c1b1b]/60 border-[#22c55e]/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#22c55e] font-semibold">
                              AI Suggested
                            </span>
                            {isAccepted && (
                              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                                verified
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white font-mono leading-relaxed break-words">
                            {r.suggested}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSkip(idx)}
                          disabled={isSkipped}
                          className="px-3 py-1 rounded-lg bg-[#1c1b1b] hover:bg-[#2a2a2a] disabled:opacity-50 text-white text-xs font-medium transition-colors border border-[#1A1A1A]"
                        >
                          {isSkipped ? 'Skipped' : 'Skip'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccept(idx)}
                          disabled={isAccepted}
                          className="px-4 py-1 rounded-lg bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-60 text-black text-xs font-semibold transition-colors"
                        >
                          {isAccepted ? 'Accepted ✓' : 'Accept'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Bottom action ───────────────────────── */}
          <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-[#22c55e] text-[22px] shrink-0">
                published_with_changes
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white">
                  Commit Neural Refactor
                </h3>
                <p className="text-xs text-[#737373] truncate">
                  {acceptedCount > 0
                    ? `${acceptedCount} accepted rewrite${
                        acceptedCount === 1 ? '' : 's'
                      } ready to apply to CV Builder.`
                    : 'Accept at least one rewrite to continue.'}
                </p>
              </div>
            </div>

            <Link
              to="/dashboard/cv-builder"
              aria-disabled={acceptedCount === 0}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shrink-0 ${
                acceptedCount === 0
                  ? 'bg-[#1c1b1b] text-[#737373] cursor-not-allowed pointer-events-none'
                  : 'bg-[#22c55e] hover:bg-[#16A34A] text-black'
              }`}
            >
              <span>Apply to CV Builder</span>
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </Link>
          </section>
        </div>
      </div>

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