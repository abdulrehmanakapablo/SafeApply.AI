// FILE: src/pages/dashboard/CVBuilder.tsx
// ROUTE: /dashboard/cv-builder (auth required)
// BACKEND: POST /api/cv/saved, POST /api/cv/rewrite-bullet, POST /api/cv/generate-summary
// PURPOSE: Two-panel CV builder — form editor left, live white-paper preview right.
//          Supports AI rewrite, AI summary, save, and PDF/DOCX/TXT export.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { useAuthStore } from '../../store/authStore'
import {
  saveCV,
  rewriteBullet,
  generateSummary,
  type CVData,
  type CVExperience,
  type CVEducation,
  type CVProject,
  type CVCertification,
} from '../../api/cv'

// ─── Tabs ────────────────────────────────────────────────
type TabKey =
  | 'personal'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'personal', label: 'Personal', icon: 'person' },
  { key: 'experience', label: 'Experience', icon: 'work' },
  { key: 'education', label: 'Education', icon: 'school' },
  { key: 'skills', label: 'Skills', icon: 'bolt' },
  { key: 'projects', label: 'Projects', icon: 'folder' },
  { key: 'certifications', label: 'Certifications', icon: 'verified' },
]

// ─── Template options ────────────────────────────────────
type TemplateKey = 'terminal' | 'classic' | 'executive'

interface TemplateOption {
  key: TemplateKey
  label: string
  badge?: string
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  { key: 'terminal', label: 'Modern Terminal', badge: 'ATS-1' },
  { key: 'classic', label: 'Minimal Classic' },
  { key: 'executive', label: 'Executive ATS' },
]

// ─── ID helper ───────────────────────────────────────────
function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Default (demo) CV ───────────────────────────────────
const DEFAULT_CV: CVData = {
  personal: {
    full_name: 'Alex Vance',
    job_title: 'Staff Distributed Systems Engineer',
    email: 'alex.vance@neural-systems.io',
    phone: '(415) 890-2104',
    location: 'San Francisco, CA',
    linkedin: 'linkedin.com/in/alexvance',
    github: 'github.com/alexvance',
    summary:
      'Staff-level Distributed Systems & Infrastructure Engineer with 8+ years architecting fault-tolerant primitives, low-latency consensus algorithms, and telemetry fabrics across multi-region Kubernetes clusters.',
  },
  experience: [
    {
      id: uid('exp'),
      company: 'Chronos Distributed Labs',
      role: 'Senior Distributed Systems Engineer',
      start_date: 'Jan 2022',
      end_date: null,
      is_current: true,
      bullets: [
        'Architected real-time raft consensus engine handling 4.2M daily telemetry requests; reduced P99 latency by 38%.',
        'Engineered zero-knowledge proof verification pipeline using Go & Rust, passing all SOC2 compliance audits.',
      ],
    },
    {
      id: uid('exp'),
      company: 'Datadog',
      role: 'Software Engineer II',
      start_date: 'Jun 2019',
      end_date: 'Dec 2021',
      is_current: false,
      bullets: [
        'Maintained telemetry aggregation agents across 10,000+ Kubernetes clusters with 99.99% reliability.',
        'Refactored ingest pipelines to reduce agent memory footprint by 22% across multi-tenant fleet environments.',
      ],
    },
  ],
  education: [
    {
      id: uid('edu'),
      institution: 'University of California, Berkeley',
      degree: 'B.S.',
      field: 'Electrical Engineering & Computer Science',
      start_date: '2015',
      end_date: '2019',
    },
  ],
  skills: [
    'Go',
    'Rust',
    'TypeScript',
    'Python',
    'C++',
    'gRPC',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
    'AWS',
    'Terraform',
    'Prometheus',
  ],
  projects: [],
  certifications: [],
}

// ─── ATS score computation ───────────────────────────────
interface ATSResult {
  score: number
  tips: string[]
}

function computeATS(cv: CVData): ATSResult {
  let score = 0
  const tips: string[] = []

  const { personal, experience, education, skills } = cv

  if (personal.full_name.trim() && personal.email.trim()) score += 15
  else tips.push('Add your full name and email in the Personal tab.')

  if (personal.location.trim()) score += 8
  else tips.push('Add a location — many ATS filters by region.')

  if (personal.linkedin.trim() || personal.github.trim()) score += 7
  else tips.push('Add a LinkedIn or GitHub link.')

  if (personal.summary.trim().length >= 100) score += 15
  else tips.push('Expand your professional summary to 100+ characters.')

  if (experience.length >= 1) score += 15
  else tips.push('Add at least one work experience.')

  const hasBullets = experience.every((e) => e.bullets.length >= 1)
  if (hasBullets && experience.length > 0) score += 15
  else if (experience.length > 0)
    tips.push('Each experience should have at least one bullet point.')

  if (skills.length >= 5) score += 15
  else tips.push('Add at least 5 technical skills.')

  if (education.length >= 1) score += 10
  else tips.push('Add your education history.')

  if (score > 100) score = 100

  if (tips.length === 0) {
    tips.push('Strong ATS profile — all core checks passed.')
  }

  return { score, tips }
}

// ─── Blank factories ─────────────────────────────────────
function blankExperience(): CVExperience {
  return {
    id: uid('exp'),
    company: '',
    role: '',
    start_date: '',
    end_date: null,
    is_current: false,
    bullets: [''],
  }
}

function blankEducation(): CVEducation {
  return {
    id: uid('edu'),
    institution: '',
    degree: '',
    field: '',
    start_date: '',
    end_date: '',
  }
}

function blankProject(): CVProject {
  return {
    id: uid('prj'),
    name: '',
    description: '',
    url: '',
    tech_stack: [],
  }
}

function blankCertification(): CVCertification {
  return {
    id: uid('cert'),
    name: '',
    issuer: '',
    date: '',
    url: '',
  }
}

// ─── Small input primitives ──────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full h-10 px-3 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373] ${
          disabled ? 'opacity-60 cursor-not-allowed text-[#22c55e]' : ''
        }`}
      />
    </div>
  )
}

// ─── Main component ──────────────────────────────────────
export default function CVBuilder() {
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<TabKey>('experience')
  const [cv, setCv] = useState<CVData>(DEFAULT_CV)
  const [zoom, setZoom] = useState(100)
  const [template, setTemplate] = useState<TemplateKey>('terminal')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [rewritingId, setRewritingId] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  const ats = computeATS(cv)
  const completion = Math.round((ats.score / 100) * 100)
  const sessionLabel = `Session: OP-${(user?.id || '7492')
    .slice(0, 4)
    .toUpperCase()}_${cv.personal.full_name.split(' ')[0] || 'Vance'}_Resume_v4`

  const scale = Math.max(50, Math.min(150, zoom)) / 100

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Personal updates ─────────────────────────────────
  function updatePersonal<K extends keyof CVData['personal']>(
    key: K,
    value: CVData['personal'][K]
  ) {
    setCv((prev) => ({
      ...prev,
      personal: { ...prev.personal, [key]: value },
    }))
  }

  // ── Experience updates ────────────────────────────────
  function addExperience() {
    setCv((prev) => ({
      ...prev,
      experience: [...prev.experience, blankExperience()],
    }))
  }

  function removeExperience(id: string) {
    setCv((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }))
  }

  function updateExperience(id: string, patch: Partial<CVExperience>) {
    setCv((prev) => ({
      ...prev,
      experience: prev.experience.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      ),
    }))
  }

  function updateBullet(expId: string, idx: number, text: string) {
    setCv((prev) => ({
      ...prev,
      experience: prev.experience.map((e) =>
        e.id === expId
          ? { ...e, bullets: e.bullets.map((b, i) => (i === idx ? text : b)) }
          : e
      ),
    }))
  }

  function addBullet(expId: string) {
    setCv((prev) => ({
      ...prev,
      experience: prev.experience.map((e) =>
        e.id === expId ? { ...e, bullets: [...e.bullets, ''] } : e
      ),
    }))
  }

  function removeBullet(expId: string, idx: number) {
    setCv((prev) => ({
      ...prev,
      experience: prev.experience.map((e) =>
        e.id === expId
          ? { ...e, bullets: e.bullets.filter((_, i) => i !== idx) }
          : e
      ),
    }))
  }

  // ── Education ────────────────────────────────────────
  function addEducation() {
    setCv((prev) => ({
      ...prev,
      education: [...prev.education, blankEducation()],
    }))
  }
  function removeEducation(id: string) {
    setCv((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }))
  }
  function updateEducation(id: string, patch: Partial<CVEducation>) {
    setCv((prev) => ({
      ...prev,
      education: prev.education.map((e) =>
        e.id === id ? { ...e, ...patch } : e
      ),
    }))
  }

  // ── Skills ───────────────────────────────────────────
  function addSkill(raw: string) {
    const s = raw.trim()
    if (!s) return
    if (cv.skills.includes(s)) return
    setCv((prev) => ({ ...prev, skills: [...prev.skills, s] }))
  }
  function removeSkill(s: string) {
    setCv((prev) => ({ ...prev, skills: prev.skills.filter((x) => x !== s) }))
  }

  // ── Projects ─────────────────────────────────────────
  function addProject() {
    setCv((prev) => ({ ...prev, projects: [...prev.projects, blankProject()] }))
  }
  function removeProject(id: string) {
    setCv((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }))
  }
  function updateProject(id: string, patch: Partial<CVProject>) {
    setCv((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  // ── Certifications ───────────────────────────────────
  function addCertification() {
    setCv((prev) => ({
      ...prev,
      certifications: [...prev.certifications, blankCertification()],
    }))
  }
  function removeCertification(id: string) {
    setCv((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((c) => c.id !== id),
    }))
  }
  function updateCertification(id: string, patch: Partial<CVCertification>) {
    setCv((prev) => ({
      ...prev,
      certifications: prev.certifications.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    }))
  }

  // ── AI: rewrite a bullet ─────────────────────────────
  async function handleRewriteBullet(expId: string, idx: number, text: string) {
    if (!text.trim()) {
      setToast({ kind: 'err', text: 'Bullet is empty.' })
      return
    }
    const key = `${expId}-${idx}`
    setRewritingId(key)
    try {
      const res = await rewriteBullet(text, cv.personal.job_title)
      if (res.success && res.data) {
        updateBullet(expId, idx, res.data.rewritten)
        setToast({ kind: 'ok', text: 'Bullet rewritten.' })
      } else {
        setToast({ kind: 'err', text: res.error || 'AI rewrite failed.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'AI rewrite unavailable right now.' })
    } finally {
      setRewritingId(null)
    }
  }

  // ── AI: generate summary ─────────────────────────────
  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    try {
      const background = [
        cv.personal.job_title,
        cv.experience
          .map((e) => `${e.role} at ${e.company}`)
          .filter(Boolean)
          .join('. '),
        cv.skills.slice(0, 12).join(', '),
      ]
        .filter(Boolean)
        .join('. ')

      const res = await generateSummary(
        background || cv.personal.summary || 'Senior engineer',
        cv.personal.job_title || 'Engineer'
      )
      if (res.success && res.data) {
        updatePersonal('summary', res.data.summary)
        setToast({ kind: 'ok', text: 'Summary generated.' })
      } else {
        setToast({ kind: 'err', text: res.error || 'Summary generation failed.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'AI summary unavailable right now.' })
    } finally {
      setGeneratingSummary(false)
    }
  }

  // ── Save CV ──────────────────────────────────────────
  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const name = `${cv.personal.full_name || 'Untitled'} — ${
        new Date().toISOString().slice(0, 10)
      }`
      const res = await saveCV(name, cv)
      if (res.success) {
        setSavedAt(new Date().toISOString())
        setToast({ kind: 'ok', text: 'CV saved.' })
      } else {
        setToast({ kind: 'err', text: res.error || 'Save failed.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'Save failed — network error.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Export helpers ───────────────────────────────────
  function cvToPlainText(): string {
    const { personal, experience, education, skills, projects, certifications } =
      cv
    const line = '─'.repeat(60)
    const parts: string[] = []

    parts.push(personal.full_name.toUpperCase())
    parts.push(
      [
        personal.location,
        personal.email,
        personal.phone,
        personal.linkedin,
        personal.github,
      ]
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

  function handleExportTXT() {
    const text = cvToPlainText()
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${cv.personal.full_name || 'cv'}.txt`)
  }

  async function handleExportDOCX() {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } =
        await import('docx')
      const { saveAs } = await import('file-saver')

      const { personal, experience, education, skills, projects, certifications } =
        cv
      const children: InstanceType<typeof Paragraph>[] = []

      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: personal.full_name, bold: true })],
        })
      )
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: [
                personal.location,
                personal.email,
                personal.phone,
                personal.linkedin,
                personal.github,
              ]
                .filter(Boolean)
                .join(' • '),
              size: 20,
            }),
          ],
        })
      )

      const heading = (text: string) =>
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text, bold: true })],
        })

      if (personal.summary.trim()) {
        children.push(heading('Professional Summary'))
        children.push(
          new Paragraph({
            children: [new TextRun({ text: personal.summary })],
          })
        )
      }

      if (experience.length > 0) {
        children.push(heading('Work Experience'))
        experience.forEach((e) => {
          const end = e.is_current ? 'Present' : e.end_date || ''
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${e.company} — ${e.role}`, bold: true }),
                new TextRun({
                  text: `    ${e.start_date}${end ? ' – ' + end : ''}`,
                  italics: true,
                }),
              ],
            })
          )
          e.bullets
            .filter(Boolean)
            .forEach((b) =>
              children.push(new Paragraph({ text: b, bullet: { level: 0 } }))
            )
        })
      }

      if (education.length > 0) {
        children.push(heading('Education'))
        education.forEach((e) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${e.institution} — ${e.degree} ${e.field}`,
                  bold: true,
                }),
              ],
            })
          )
        })
      }

      if (skills.length > 0) {
        children.push(heading('Technical Skills'))
        children.push(
          new Paragraph({
            children: [new TextRun({ text: skills.join(', ') })],
          })
        )
      }

      if (projects.length > 0) {
        children.push(heading('Projects'))
        projects.forEach((p) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: p.name, bold: true })],
            })
          )
          if (p.description)
            children.push(
              new Paragraph({
                children: [new TextRun({ text: p.description })],
              })
            )
        })
      }

      if (certifications.length > 0) {
        children.push(heading('Certifications'))
        certifications.forEach((c) => {
          children.push(
            new Paragraph({
              text: `${c.name} — ${c.issuer}${c.date ? ' (' + c.date + ')' : ''}`,
              bullet: { level: 0 },
            })
          )
        })
      }

      const doc = new Document({
        sections: [{ properties: {}, children }],
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `${cv.personal.full_name || 'cv'}.docx`)
    } catch {
      setToast({ kind: 'err', text: 'DOCX export failed.' })
    }
  }

  function handleExportPDF() {
    const text = cvToPlainText()
      .split('\n')
      .map(
        (l) =>
          `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;') || '&nbsp;'}</p>`
      )
      .join('')

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${cv.personal.full_name}</title>
      <style>
        @page { margin: 20mm; }
        body { font-family: Inter, system-ui, sans-serif; font-size: 11pt; color: #111; line-height: 1.5; }
        p { margin: 0 0 6px 0; white-space: pre-wrap; }
      </style></head><body>${text}</body></html>`

    const w = window.open('', '_blank')
    if (!w) {
      setToast({ kind: 'err', text: 'Allow pop-ups to export PDF.' })
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
      w.close()
    }, 250)
  }

  return (
    <>
      <SEO
        title="CV Builder | SafeApply.AI"
        description="Build an ATS-optimised CV with AI-assisted bullets, live preview, and PDF/DOCX/TXT export."
        path="/dashboard/cv-builder"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6 pb-16">
        {/* ── Header bar ──────────────────────────────── */}
        <div className="w-full flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 pb-3 border-b border-[#1A1A1A]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[11px] font-semibold whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              LIVE PARSER ACTIVE
            </span>
            <span className="hidden sm:inline text-[#353534]">•</span>
            <span className="text-white text-xs font-medium truncate max-w-[200px] sm:max-w-none">
              {sessionLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#737373]">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                cloud_done
              </span>
              {savedAt
                ? `Saved ${new Date(savedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Auto-synced'}
            </span>
            <span className="text-[#353534]">|</span>
            <Link
              to="/dashboard/cv-builder/saved"
              className="inline-flex items-center gap-1.5 text-[#737373] hover:text-[#22c55e] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                folder_open
              </span>
              Saved CVs
            </Link>
            <span className="text-[#353534]">|</span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[#737373] hover:text-[#22c55e] transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">
                {saving ? 'sync' : 'save'}
              </span>
              {saving ? 'Saving…' : 'Save CV'}
            </button>
          </div>
        </div>

        {/* ── Two-panel layout ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start w-full">
          {/* ════════════ LEFT: Editor ════════════ */}
          <section className="lg:col-span-6 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 min-w-0">
            {/* Tabs */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A] gap-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#737373] truncate">
                  Configuration Module
                </span>
                <span className="font-mono text-[11px] text-[#22c55e] whitespace-nowrap">
                  COMPLETION: {completion}%
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {TABS.map((t) => {
                  const active = tab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#22c55e] text-black'
                          : 'bg-[#141414] text-[#737373] hover:text-white border border-[#1A1A1A]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {t.icon}
                      </span>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Tab content ──────────────────────────── */}

            {/* Personal */}
            {tab === 'personal' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Full Name"
                    value={cv.personal.full_name}
                    onChange={(v) => updatePersonal('full_name', v)}
                  />
                  <Field
                    label="Job Title"
                    value={cv.personal.job_title}
                    onChange={(v) => updatePersonal('job_title', v)}
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={cv.personal.email}
                    onChange={(v) => updatePersonal('email', v)}
                  />
                  <Field
                    label="Phone"
                    value={cv.personal.phone}
                    onChange={(v) => updatePersonal('phone', v)}
                  />
                  <Field
                    label="Location"
                    value={cv.personal.location}
                    onChange={(v) => updatePersonal('location', v)}
                  />
                  <Field
                    label="LinkedIn"
                    value={cv.personal.linkedin}
                    onChange={(v) => updatePersonal('linkedin', v)}
                  />
                  <Field
                    label="GitHub"
                    value={cv.personal.github}
                    onChange={(v) => updatePersonal('github', v)}
                  />
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                      Professional Summary
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                      className="text-[#22c55e] text-[11px] font-semibold hover:underline flex items-center gap-1 disabled:opacity-60"
                    >
                      <span
                        className={`material-symbols-outlined text-[13px] ${
                          generatingSummary ? 'animate-spin' : ''
                        }`}
                      >
                        {generatingSummary ? 'sync' : 'auto_awesome'}
                      </span>
                      {generatingSummary ? 'Generating…' : 'Generate with AI'}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={cv.personal.summary}
                    onChange={(e) => updatePersonal('summary', e.target.value)}
                    placeholder="Write a professional summary or generate one with AI…"
                    className="w-full p-3 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none resize-y leading-relaxed placeholder-[#737373]"
                  />
                  <span className="text-[11px] text-[#737373] font-mono">
                    {cv.personal.summary.length} characters
                  </span>
                </div>
              </div>
            )}

            {/* Experience */}
            {tab === 'experience' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[20px] text-[#22c55e] shrink-0">
                      layers
                    </span>
                    <h3 className="text-base font-semibold text-white">
                      Work Experience
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#141414] border border-[#1A1A1A] text-[#737373] whitespace-nowrap">
                      {cv.experience.length} entries
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-black transition-colors self-start sm:self-auto shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    Add Experience
                  </button>
                </div>

                {cv.experience.map((exp, i) => (
                  <div
                    key={exp.id}
                    className="bg-black border border-[#1A1A1A] hover:border-[#262626] rounded-lg p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 transition-colors min-w-0"
                  >
                    <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3 gap-3">
                      <div className="flex items-center gap-2 text-[#737373] min-w-0">
                        <span className="material-symbols-outlined text-[18px] shrink-0">
                          drag_indicator
                        </span>
                        <span className="font-mono text-[11px] uppercase tracking-wider truncate">
                          Position {String(i + 1).padStart(2, '0')}
                          {i === 0 ? ' / Primary' : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExperience(exp.id)}
                        aria-label="Delete experience"
                        className="text-[#737373] hover:text-[#EF4444] transition-colors p-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Company"
                        value={exp.company}
                        onChange={(v) => updateExperience(exp.id, { company: v })}
                      />
                      <Field
                        label="Job Title"
                        value={exp.role}
                        onChange={(v) => updateExperience(exp.id, { role: v })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                      <Field
                        label="Start Date"
                        value={exp.start_date}
                        onChange={(v) =>
                          updateExperience(exp.id, { start_date: v })
                        }
                      />
                      <Field
                        label="End Date"
                        value={exp.is_current ? 'Present' : exp.end_date || ''}
                        onChange={(v) =>
                          updateExperience(exp.id, { end_date: v })
                        }
                        disabled={exp.is_current}
                      />
                      <label className="flex items-center gap-2 cursor-pointer select-none h-10 px-2">
                        <input
                          type="checkbox"
                          checked={exp.is_current}
                          onChange={(e) =>
                            updateExperience(exp.id, {
                              is_current: e.target.checked,
                              end_date: e.target.checked ? null : exp.end_date,
                            })
                          }
                          className="w-4 h-4 accent-[#22c55e] rounded shrink-0"
                        />
                        <span className="text-sm text-white font-medium whitespace-nowrap">
                          Present Role
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                        <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                          Accomplishments
                        </label>
                        <span className="text-[11px] text-[#737373] hidden sm:block">
                          Action Verb + Metric + Scope
                        </span>
                      </div>

                      {exp.bullets.map((b, idx) => {
                        const key = `${exp.id}-${idx}`
                        const rewriting = rewritingId === key
                        return (
                          <div
                            key={idx}
                            className="flex flex-col gap-1.5 p-2.5 rounded bg-[#0D0D0D] border border-[#1A1A1A] min-w-0"
                          >
                            <div className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-[18px] text-[#22c55e] mt-1 select-none shrink-0">
                                check_circle
                              </span>
                              <textarea
                                rows={2}
                                value={b}
                                onChange={(e) =>
                                  updateBullet(exp.id, idx, e.target.value)
                                }
                                placeholder="Describe an accomplishment…"
                                className="w-full min-w-0 bg-transparent border-0 text-white text-sm focus:outline-none resize-none leading-relaxed placeholder-[#737373]"
                              />
                              {exp.bullets.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeBullet(exp.id, idx)}
                                  aria-label="Remove bullet"
                                  className="text-[#737373] hover:text-[#EF4444] transition-colors p-0.5 shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    close
                                  </span>
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1A1A1A]/80">
                              <span className="text-[10px] font-mono text-[#737373] truncate">
                                {b.length} chars
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRewriteBullet(exp.id, idx, b)
                                }
                                disabled={rewriting}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors disabled:opacity-60 whitespace-nowrap"
                              >
                                <span
                                  className={`material-symbols-outlined text-[13px] ${
                                    rewriting ? 'animate-spin' : ''
                                  }`}
                                >
                                  {rewriting ? 'sync' : 'auto_awesome'}
                                </span>
                                {rewriting ? 'Rewriting…' : 'AI Rewrite'}
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      <button
                        type="button"
                        onClick={() => addBullet(exp.id)}
                        className="self-start text-[#22c55e] text-xs font-semibold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          add_circle
                        </span>
                        + Add Bullet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Education */}
            {tab === 'education' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">
                    Education
                  </h3>
                  <button
                    type="button"
                    onClick={addEducation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-black transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    Add
                  </button>
                </div>

                {cv.education.length === 0 && (
                  <p className="text-sm text-[#737373] py-4">
                    No education added yet. Click Add to start.
                  </p>
                )}

                {cv.education.map((e) => (
                  <div
                    key={e.id}
                    className="bg-black border border-[#1A1A1A] rounded-lg p-3 sm:p-4 flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeEducation(e.id)}
                        aria-label="Remove education"
                        className="text-[#737373] hover:text-[#EF4444] transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>
                    <Field
                      label="Institution"
                      value={e.institution}
                      onChange={(v) =>
                        updateEducation(e.id, { institution: v })
                      }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Degree"
                        value={e.degree}
                        onChange={(v) => updateEducation(e.id, { degree: v })}
                      />
                      <Field
                        label="Field"
                        value={e.field}
                        onChange={(v) => updateEducation(e.id, { field: v })}
                      />
                      <Field
                        label="Start"
                        value={e.start_date}
                        onChange={(v) =>
                          updateEducation(e.id, { start_date: v })
                        }
                      />
                      <Field
                        label="End"
                        value={e.end_date}
                        onChange={(v) => updateEducation(e.id, { end_date: v })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {tab === 'skills' && (
              <SkillsTab
                skills={cv.skills}
                onAdd={addSkill}
                onRemove={removeSkill}
              />
            )}

            {/* Projects */}
            {tab === 'projects' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">Projects</h3>
                  <button
                    type="button"
                    onClick={addProject}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-black transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    Add
                  </button>
                </div>

                {cv.projects.length === 0 && (
                  <p className="text-sm text-[#737373] py-4">
                    No projects yet. Add one to showcase your side work.
                  </p>
                )}

                {cv.projects.map((p) => (
                  <div
                    key={p.id}
                    className="bg-black border border-[#1A1A1A] rounded-lg p-3 sm:p-4 flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeProject(p.id)}
                        aria-label="Remove project"
                        className="text-[#737373] hover:text-[#EF4444] transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>
                    <Field
                      label="Name"
                      value={p.name}
                      onChange={(v) => updateProject(p.id, { name: v })}
                    />
                    <Field
                      label="URL"
                      value={p.url}
                      onChange={(v) => updateProject(p.id, { url: v })}
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={p.description}
                        onChange={(e) =>
                          updateProject(p.id, { description: e.target.value })
                        }
                        className="w-full p-3 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none resize-y"
                      />
                    </div>
                    <Field
                      label="Tech Stack (comma separated)"
                      value={p.tech_stack.join(', ')}
                      onChange={(v) =>
                        updateProject(p.id, {
                          tech_stack: v
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Certifications */}
            {tab === 'certifications' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">
                    Certifications
                  </h3>
                  <button
                    type="button"
                    onClick={addCertification}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-black transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    Add
                  </button>
                </div>

                {cv.certifications.length === 0 && (
                  <p className="text-sm text-[#737373] py-4">
                    No certifications added yet.
                  </p>
                )}

                {cv.certifications.map((c) => (
                  <div
                    key={c.id}
                    className="bg-black border border-[#1A1A1A] rounded-lg p-3 sm:p-4 flex flex-col gap-3 min-w-0"
                  >
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeCertification(c.id)}
                        aria-label="Remove certification"
                        className="text-[#737373] hover:text-[#EF4444] transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Name"
                        value={c.name}
                        onChange={(v) => updateCertification(c.id, { name: v })}
                      />
                      <Field
                        label="Issuer"
                        value={c.issuer}
                        onChange={(v) =>
                          updateCertification(c.id, { issuer: v })
                        }
                      />
                      <Field
                        label="Date"
                        value={c.date}
                        onChange={(v) => updateCertification(c.id, { date: v })}
                      />
                      <Field
                        label="URL"
                        value={c.url}
                        onChange={(v) => updateCertification(c.id, { url: v })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ════════════ RIGHT: Preview + ATS + Export ════════════ */}
          <section className="lg:col-span-6 bg-black border border-[#1A1A1A] rounded-xl p-4 sm:p-5 md:p-6 flex flex-col gap-4 sm:gap-5 lg:sticky lg:top-20 min-w-0">
            {/* Template + zoom header */}
            <div className="flex flex-col gap-3 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1">
                {TEMPLATE_OPTIONS.map((t) => {
                  const active = template === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTemplate(t.key)}
                      className={`shrink-0 px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#0D0D0D] border border-[#22c55e] text-[#22c55e]'
                          : 'bg-[#0D0D0D] border border-[#1A1A1A] text-[#737373] hover:text-white hover:border-[#262626]'
                      }`}
                    >
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                      )}
                      {t.label}
                      {t.badge && (
                        <span className="text-[9px] px-1 rounded bg-[#22c55e]/20 text-[#22c55e] uppercase">
                          {t.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#737373]">
                  Preview Zoom
                </span>
                <div className="flex items-center gap-1.5 text-[#737373]">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(50, z - 10))}
                    aria-label="Zoom out"
                    className="p-1 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      zoom_out
                    </span>
                  </button>
                  <span className="font-mono text-xs text-white px-1 min-w-[40px] text-center">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(150, z + 10))}
                    aria-label="Zoom in"
                    className="p-1 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      zoom_in
                    </span>
                  </button>
                  <span className="text-[#353534]">|</span>
                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    aria-label="Reset zoom"
                    className="p-1 hover:text-[#22c55e] transition-colors flex items-center gap-1 text-[11px] font-mono whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      fit_screen
                    </span>
                    FIT
                  </button>
                </div>
              </div>
            </div>

            {/* Preview paper — zoom via CSS `zoom` property, inverse-width wrapper */}
            <div className="w-full overflow-hidden">
              <div
                className="bg-white text-slate-900 rounded-lg shadow-2xl border border-slate-200 overflow-y-auto"
                style={{
                  width: `${100 / scale}%`,
                  zoom: scale,
                  maxHeight: `${640 / scale}px`,
                } as React.CSSProperties}
              >
                <div className="p-4 sm:p-6 md:p-7 flex flex-col gap-3 sm:gap-4 font-sans text-left">
                  {/* Header */}
                  <div className="text-center pb-2 border-b border-slate-200">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase leading-none break-words">
                      {cv.personal.full_name || 'Your Name'}
                    </h1>
                    <p className="text-[10px] sm:text-[11px] text-slate-600 mt-2 font-medium break-words">
                      {[
                        cv.personal.location,
                        cv.personal.email,
                        cv.personal.phone,
                        cv.personal.github,
                        cv.personal.linkedin,
                      ]
                        .filter(Boolean)
                        .join('  •  ')}
                    </p>
                  </div>

                  {/* Summary */}
                  {cv.personal.summary.trim() && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-300 pb-0.5">
                        Professional Summary
                      </h3>
                      <p className="text-[11px] leading-relaxed text-slate-800">
                        {cv.personal.summary}
                      </p>
                    </div>
                  )}

                  {/* Experience */}
                  {cv.experience.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-300 pb-0.5">
                        Work Experience
                      </h3>
                      {cv.experience.map((e) => {
                        const end = e.is_current ? 'Present' : e.end_date || ''
                        return (
                          <div key={e.id} className="flex flex-col gap-1">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between text-[11px] sm:text-[12px] gap-0.5 sm:gap-3">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900">
                                  {e.company || 'Company'}
                                </span>
                                {e.role && (
                                  <span className="text-slate-600 font-normal">
                                    {' '}
                                    — {e.role}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                                {e.start_date}
                                {end ? ` – ${end}` : ''}
                              </span>
                            </div>
                            <ul className="list-disc pl-4 text-[10.5px] sm:text-[11px] leading-relaxed text-slate-800 space-y-1">
                              {e.bullets
                                .filter(Boolean)
                                .map((b, i) => (
                                  <li key={i}>{b}</li>
                                ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Education */}
                  {cv.education.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-300 pb-0.5">
                        Education
                      </h3>
                      {cv.education.map((e) => (
                        <div
                          key={e.id}
                          className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between text-[10.5px] sm:text-[11px] gap-0.5 sm:gap-3"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900">
                              {e.institution || 'Institution'}
                            </span>
                            {(e.degree || e.field) && (
                              <span className="text-slate-600">
                                {' '}
                                — {[e.degree, e.field].filter(Boolean).join(' ')}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-600 whitespace-nowrap">
                            {[e.start_date, e.end_date]
                              .filter(Boolean)
                              .join(' – ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skills */}
                  {cv.skills.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-300 pb-0.5">
                        Technical Skills
                      </h3>
                      <p className="text-[10.5px] sm:text-[11px] leading-relaxed text-slate-800">
                        {cv.skills.join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Projects */}
                  {cv.projects.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-300 pb-0.5">
                        Projects
                      </h3>
                      {cv.projects.map((p) => (
                        <div
                          key={p.id}
                          className="text-[10.5px] sm:text-[11px] leading-relaxed text-slate-800"
                        >
                          {p.name && (
                            <span className="font-semibold text-slate-900">
                              {p.name}
                            </span>
                          )}
                          {p.description && <span> — {p.description}</span>}
                          {p.tech_stack.length > 0 && (
                            <span className="text-slate-600">
                              {' '}
                              ({p.tech_stack.join(', ')})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Certifications */}
                  {cv.certifications.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-300 pb-0.5">
                        Certifications
                      </h3>
                      <ul className="list-disc pl-4 text-[10.5px] sm:text-[11px] leading-relaxed text-slate-800 space-y-0.5">
                        {cv.certifications.map((c) => (
                          <li key={c.id}>
                            <strong className="font-semibold">{c.name}</strong>
                            {c.issuer && <span> — {c.issuer}</span>}
                            {c.date && (
                              <span className="text-slate-600"> ({c.date})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ATS score card */}
            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-3 sm:p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[20px] text-[#22c55e] shrink-0">
                    verified
                  </span>
                  <span className="font-mono text-xs uppercase tracking-wider text-[#737373] truncate">
                    ATS Readiness Score
                  </span>
                </div>
                <span
                  className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                    ats.score >= 80
                      ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                      : ats.score >= 60
                      ? 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30'
                      : 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                  }`}
                >
                  {ats.score}/100{' '}
                  {ats.score >= 80
                    ? 'EXCELLENT'
                    : ats.score >= 60
                    ? 'GOOD'
                    : 'NEEDS WORK'}
                </span>
              </div>

              <div className="w-full h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22c55e] rounded-full transition-all duration-500"
                  style={{ width: `${ats.score}%` }}
                />
              </div>

              <div className="flex flex-col gap-1.5 pt-1 text-xs">
                {ats.tips.slice(0, 4).map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={`font-bold shrink-0 ${
                        ats.score >= 80 ? 'text-[#22c55e]' : 'text-[#EAB308]'
                      }`}
                    >
                      {ats.score >= 80 ? '✓' : '→'}
                    </span>
                    <span className="text-[#bccbb9] leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportPDF}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded text-xs font-bold bg-[#22c55e] hover:bg-[#16A34A] text-black transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  download
                </span>
                Download PDF
              </button>
              <button
                type="button"
                onClick={handleExportDOCX}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded text-xs font-semibold bg-transparent border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  description
                </span>
                Export DOCX
              </button>
              <button
                type="button"
                onClick={handleExportTXT}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded text-xs font-medium bg-[#0D0D0D] border border-[#1A1A1A] text-[#737373] hover:text-white hover:border-[#262626] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  terminal
                </span>
                Plain TXT
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ── Toast ───────────────────────────────────────── */}
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

// ─── Skills tab sub-component ────────────────────────────
function SkillsTab({
  skills,
  onAdd,
  onRemove,
}: {
  skills: string[]
  onAdd: (s: string) => void
  onRemove: (s: string) => void
}) {
  const [draft, setDraft] = useState('')

  function handleAdd() {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">Technical Skills</h3>
        <span className="text-xs text-[#737373] font-mono whitespace-nowrap">
          {skills.length} skills
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Type a skill and press Enter"
          className="flex-1 min-w-0 h-10 px-3 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 h-10 rounded text-xs font-semibold bg-[#22c55e] hover:bg-[#16A34A] text-black transition-colors whitespace-nowrap shrink-0"
        >
          Add
        </button>
      </div>

      {skills.length === 0 ? (
        <p className="text-sm text-[#737373] py-4">
          No skills yet. Add at least 5 for a strong ATS profile.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-xs font-semibold"
            >
              {s}
              <button
                type="button"
                onClick={() => onRemove(s)}
                aria-label={`Remove ${s}`}
                className="hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">
                  close
                </span>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}