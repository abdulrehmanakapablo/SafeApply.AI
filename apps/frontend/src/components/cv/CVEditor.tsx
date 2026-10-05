// FILE: src/components/cv/CVEditor.tsx
// PURPOSE: CV editor + live preview + export, shared by CV Builder and the
//          Build tab of CV Match. Reads/writes cvStore so edits survive
//          navigation.
//
// • Profession-neutral labels. `personal.github` is shown as
//   "Portfolio or website" (data shape unchanged).
// • Required vs optional fields. Save and export are blocked until the
//   required set is complete; errors highlight and jump to the first tab.
// • "Saved CVs" opens an in-place picker. Never navigates away.
// • Builder variant honours ?load=<savedCvId> (from the Saved CVs page).

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCVStore, DEFAULT_CV, isDefaultCV } from '../../store/cvStore'
import {
  uploadCV,
  saveCV,
  getSavedCVs,
  rewriteBullet,
  generateSummary,
  structureCVStream,
  clearCV,
  getCurrentCV,
  payloadToCVData,
  type CVData,
  type CVExperience,
  type CVEducation,
  type CVProject,
  type CVCertification,
  type SavedCV,
  type StructureEvent,
} from '../../api/cv'
import AIProgressPopup, { EMPTY_PROGRESS, type AIProgressState } from './AIProgressPopup'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, Icon, TextArea, cn, formatDate } from '../ui'
import { apiError } from '../../lib/axios'

// ─── File validation ─────────────────────────────────────
const MAX_FILE_SIZE = 4 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const ALLOWED_EXT = new Set(['.pdf', '.docx'])

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return 'That file is over 4 MB.'
  const name = file.name.toLowerCase()
  if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.has(name.slice(name.lastIndexOf('.')))) return 'Upload a PDF or Word (.docx) file.'
  return null
}

// ─── Tabs ────────────────────────────────────────────────
type TabKey = 'personal' | 'experience' | 'education' | 'skills' | 'projects' | 'certifications'

const TABS: { key: TabKey; label: string; icon: string; optional?: boolean }[] = [
  { key: 'personal', label: 'Personal', icon: 'person' },
  { key: 'experience', label: 'Experience', icon: 'work' },
  { key: 'education', label: 'Education', icon: 'school' },
  { key: 'skills', label: 'Skills', icon: 'bolt' },
  { key: 'projects', label: 'Projects', icon: 'folder', optional: true },
  { key: 'certifications', label: 'Certifications', icon: 'verified', optional: true },
]

// ─── Templates ───────────────────────────────────────────
type TemplateKey = 'modern' | 'classic' | 'executive'

const TEMPLATES: { key: TemplateKey; label: string; description: string }[] = [
  { key: 'modern', label: 'Modern', description: 'Sans-serif, bold section heads' },
  { key: 'classic', label: 'Classic', description: 'Serif, quiet and traditional' },
  { key: 'executive', label: 'Executive', description: 'Serif, spacious, formal' },
]

const PREVIEW: Record<TemplateKey, { wrap: string; font: string; name: string; title: string; contact: string; heading: string; rule: string; body: string }> = {
  modern: {
    wrap: 'p-10',
    font: 'font-sans',
    name: 'text-[28px] font-bold tracking-tight',
    title: 'text-[13px] text-slate-600 mt-1',
    contact: 'text-[11.5px] text-slate-600 mt-2',
    heading: 'text-[11.5px] font-bold tracking-[0.08em] uppercase text-slate-900',
    rule: 'border-b border-slate-300',
    body: 'text-[12px] leading-relaxed',
  },
  classic: {
    wrap: 'p-12',
    font: 'font-serif',
    name: 'text-[28px] tracking-wide',
    title: 'text-[13px] text-slate-600 mt-1 italic',
    contact: 'text-[11.5px] text-slate-600 mt-2',
    heading: 'text-[13px] italic text-slate-800',
    rule: 'border-b border-slate-200',
    body: 'text-[12.5px] leading-relaxed',
  },
  executive: {
    wrap: 'p-14',
    font: 'font-serif',
    name: 'text-[34px] tracking-tight uppercase',
    title: 'text-[12px] text-slate-600 mt-2 uppercase tracking-[0.2em]',
    contact: 'text-[11.5px] text-slate-600 mt-3',
    heading: 'text-[11px] font-sans font-bold tracking-[0.15em] uppercase text-slate-900',
    rule: 'border-b-2 border-slate-800',
    body: 'text-[12.5px] leading-loose',
  },
}

// ─── Helpers ─────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_SKILLS = 3

function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length
}
const asString = (v: unknown) => (typeof v === 'string' ? v : '')
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

// Saved rows may be partial or from older versions. Never trust the shape.
export function normalizeCVData(raw: unknown): CVData {
  const d = asRecord(raw)
  const p = asRecord(d.personal)
  return {
    personal: {
      full_name: asString(p.full_name),
      job_title: asString(p.job_title),
      email: asString(p.email),
      phone: asString(p.phone),
      location: asString(p.location),
      linkedin: asString(p.linkedin),
      github: asString(p.github),
      summary: asString(p.summary),
    },
    experience: asArray(d.experience).map((x) => {
      const e = asRecord(x)
      const bullets = asArray(e.bullets).filter((b): b is string => typeof b === 'string')
      return {
        id: asString(e.id) || uid('exp'),
        company: asString(e.company),
        role: asString(e.role),
        start_date: asString(e.start_date),
        end_date: typeof e.end_date === 'string' ? e.end_date : null,
        is_current: Boolean(e.is_current),
        bullets: bullets.length > 0 ? bullets : [''],
      }
    }),
    education: asArray(d.education).map((x) => {
      const e = asRecord(x)
      return {
        id: asString(e.id) || uid('edu'),
        institution: asString(e.institution),
        degree: asString(e.degree),
        field: asString(e.field),
        start_date: asString(e.start_date),
        end_date: asString(e.end_date),
      }
    }),
    skills: asArray(d.skills).filter((s): s is string => typeof s === 'string' && s.trim().length > 0),
    projects: asArray(d.projects).map((x) => {
      const e = asRecord(x)
      return {
        id: asString(e.id) || uid('prj'),
        name: asString(e.name),
        description: asString(e.description),
        url: asString(e.url),
        tech_stack: asArray(e.tech_stack).filter((s): s is string => typeof s === 'string'),
      }
    }),
    certifications: asArray(d.certifications).map((x) => {
      const e = asRecord(x)
      return {
        id: asString(e.id) || uid('cert'),
        name: asString(e.name),
        issuer: asString(e.issuer),
        date: asString(e.date),
        url: asString(e.url),
      }
    }),
  }
}

// ─── Validation ──────────────────────────────────────────
interface Validation {
  errors: Record<string, string>
  byTab: Record<TabKey, number>
  messages: string[]
  count: number
}

function validateCV(cv: CVData): Validation {
  const errors: Record<string, string> = {}
  const byTab: Record<TabKey, number> = { personal: 0, experience: 0, education: 0, skills: 0, projects: 0, certifications: 0 }
  const messages: string[] = []
  const add = (tab: TabKey, key: string, msg: string) => {
    errors[key] = msg
    byTab[tab] += 1
    messages.push(msg)
  }

  const p = cv.personal
  if (!p.full_name.trim()) add('personal', 'personal.full_name', 'Full name is required')
  if (!p.job_title.trim()) add('personal', 'personal.job_title', 'Professional title is required')
  if (!p.email.trim()) add('personal', 'personal.email', 'Email is required')
  else if (!EMAIL_RE.test(p.email.trim())) add('personal', 'personal.email', 'Enter a valid email')
  if (digitCount(p.phone) < 7) add('personal', 'personal.phone', p.phone.trim() ? 'Enter a valid phone number' : 'Phone is required')
  if (!p.location.trim()) add('personal', 'personal.location', 'Location is required')

  if (cv.experience.length === 0 && cv.education.length === 0) add('experience', 'section.experience', 'Add at least one job or education entry')

  cv.experience.forEach((e, i) => {
    const n = `Position ${i + 1}`
    if (!e.role.trim()) add('experience', `exp.${e.id}.role`, `${n}: job title is required`)
    if (!e.company.trim()) add('experience', `exp.${e.id}.company`, `${n}: organisation is required`)
    if (!e.start_date.trim()) add('experience', `exp.${e.id}.start_date`, `${n}: start date is required`)
    if (!e.is_current && !(e.end_date ?? '').trim()) add('experience', `exp.${e.id}.end_date`, `${n}: end date is required, or tick “I work here now”`)
  })
  cv.education.forEach((e, i) => {
    const n = `Education ${i + 1}`
    if (!e.institution.trim()) add('education', `edu.${e.id}.institution`, `${n}: institution is required`)
    if (!e.degree.trim()) add('education', `edu.${e.id}.degree`, `${n}: qualification is required`)
  })
  if (cv.skills.length < MIN_SKILLS) add('skills', 'section.skills', `Add at least ${MIN_SKILLS} skills`)
  cv.projects.forEach((e, i) => {
    if (!e.name.trim()) add('projects', `prj.${e.id}.name`, `Project ${i + 1}: title is required`)
  })
  cv.certifications.forEach((e, i) => {
    if (!e.name.trim()) add('certifications', `cert.${e.id}.name`, `Certification ${i + 1}: name is required`)
  })

  return { errors, byTab, messages, count: messages.length }
}

// ─── Readability score (profession-neutral) ──────────────
function computeATS(cv: CVData): { score: number; tips: string[] } {
  let score = 0
  const tips: string[] = []
  const { personal, experience, education, skills } = cv
  if (personal.full_name.trim() && personal.email.trim()) score += 15
  else tips.push('Add your full name and email.')
  if (digitCount(personal.phone) >= 7) score += 5
  else tips.push('Add a phone number.')
  if (personal.location.trim()) score += 5
  else tips.push('Add your city and country.')
  if (personal.job_title.trim()) score += 5
  else tips.push('Add a title that matches the jobs you want.')
  if (personal.summary.trim().length >= 100) score += 15
  else tips.push('Write a 2 to 4 sentence summary.')
  if (experience.length >= 1) score += 15
  else if (education.length >= 1) score += 8
  if (experience.length === 0) tips.push('Add work, internship, volunteer or freelance experience.')
  const strong = experience.length > 0 && experience.every((e) => e.bullets.filter((b) => b.trim()).length >= 2)
  if (strong) score += 10
  else if (experience.length > 0) tips.push('Give each position at least 2 achievements.')
  if (education.length >= 1) score += 10
  else tips.push('Add your education or training.')
  if (skills.length >= 5) score += 15
  else tips.push('List at least 5 skills from the jobs you’re targeting.')
  if (personal.linkedin.trim() || personal.github.trim()) score += 5
  else tips.push('Add LinkedIn or a portfolio link.')
  return { score: Math.min(100, score), tips }
}

const blankExperience = (): CVExperience => ({ id: uid('exp'), company: '', role: '', start_date: '', end_date: null, is_current: false, bullets: [''] })
const blankEducation = (): CVEducation => ({ id: uid('edu'), institution: '', degree: '', field: '', start_date: '', end_date: '' })
const blankProject = (): CVProject => ({ id: uid('prj'), name: '', description: '', url: '', tech_stack: [] })
const blankCertification = (): CVCertification => ({ id: uid('cert'), name: '', issuer: '', date: '', url: '' })

// ─── Small building blocks ───────────────────────────────
function SectionIntro({ title, body, required, onAdd, addLabel, count }: { title: string; body: string; required?: boolean; onAdd?: () => void; addLabel?: string; count?: number }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{title}</h3>
          <Badge tone={required ? 'accent' : 'neutral'}>{required ? 'Required' : 'Optional'}</Badge>
          {typeof count === 'number' && count > 0 && <span className="text-xs text-muted tabular">{count}</span>}
        </div>
        <p className="text-sm text-muted mt-1 leading-relaxed max-w-[60ch]">{body}</p>
      </div>
      {onAdd && (
        <Button variant="secondary" size="sm" icon="add" onClick={onAdd} className="self-start">
          {addLabel}
        </Button>
      )}
    </div>
  )
}

function EntryShell({ label, onRemove, children }: { label: string; onRemove: () => void; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[12px] border border-line bg-ink p-4 sm:p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3 -mt-1">
        <span className="text-xs text-muted">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="w-8 h-8 -mr-2 rounded-[8px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <Icon name="delete" className="text-[18px]" />
        </button>
      </div>
      {children}
    </motion.div>
  )
}

function EmptyBox({ icon, title, body, action, onAction, error }: { icon: string; title: string; body: string; action: string; onAction: () => void; error?: string }) {
  return (
    <div className={cn('rounded-[12px] border border-dashed', error ? 'border-danger/50 bg-danger/5' : 'border-line')}>
      <EmptyState
        icon={icon}
        title={title}
        body={
          <>
            {body}
            {error && <span className="block text-danger mt-2">{error}</span>}
          </>
        }
        action={
          <Button size="sm" icon="add" onClick={onAction}>
            {action}
          </Button>
        }
        className="py-10"
      />
    </div>
  )
}

// ═════════════════════════════════════════════════════════
export interface CVEditorProps {
  showImport?: boolean
  autoLoadFromBackend?: boolean
  contextLabel?: string
  /** Which store slot to use. 'builder' for CV Builder, 'match' for CV Match build tab. */
  variant?: 'builder' | 'match'
}

export default function CVEditor({ showImport = false, autoLoadFromBackend = false, contextLabel, variant = 'builder' }: CVEditorProps) {
  const builderCV = useCVStore((s) => s.builderCV)
  const matchCV = useCVStore((s) => s.matchCV)
  const setBuilderCV = useCVStore((s) => s.setBuilderCV)
  const setMatchCV = useCVStore((s) => s.setMatchCV)
  const cv = variant === 'match' ? matchCV : builderCV
  const setCv = variant === 'match' ? setMatchCV : setBuilderCV

  const [searchParams, setSearchParams] = useSearchParams()
  const loadId = variant === 'builder' ? searchParams.get('load') : null

  const [tab, setTab] = useState<TabKey>('personal')
  const [zoom, setZoom] = useState(100)
  const [template, setTemplate] = useState<TemplateKey>('modern')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loadedName, setLoadedName] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [rewritingId, setRewritingId] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  const [structuring, setStructuring] = useState(false)
  const [progress, setProgress] = useState<AIProgressState>(EMPTY_PROGRESS)
  const [pendingRawText, setPendingRawText] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const hydratedRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const ats = useMemo(() => computeATS(cv), [cv])
  const validation = useMemo(() => validateCV(cv), [cv])
  const scale = Math.max(50, Math.min(150, zoom)) / 100
  const s = PREVIEW[template]
  const err = (key: string): string | undefined => (showErrors ? validation.errors[key] : undefined)

  const checklist: { label: string; ok: boolean; tab: TabKey }[] = [
    { label: 'Personal details', ok: validation.byTab.personal === 0, tab: 'personal' },
    {
      label: 'Experience or education',
      ok: cv.experience.length + cv.education.length > 0 && validation.byTab.experience === 0 && validation.byTab.education === 0,
      tab: validation.byTab.experience > 0 || cv.experience.length > 0 ? 'experience' : 'education',
    },
    { label: `${MIN_SKILLS}+ skills`, ok: validation.byTab.skills === 0, tab: 'skills' },
  ]
  const requiredDone = checklist.filter((c) => c.ok).length

  function ensureValid(action: string): boolean {
    if (validation.count === 0) return true
    setShowErrors(true)
    const first = TABS.find((t) => validation.byTab[t.key] > 0)?.key
    if (first) setTab(first)
    toast.error(`Finish the required fields before ${action}. ${validation.messages[0]}${validation.count > 1 ? ` (+${validation.count - 1} more)` : ''}`)
    return false
  }

  const loadSaved = useCallback(
    (item: SavedCV) => {
      setCv(normalizeCVData(item.cv_data))
      setLoadedName(item.name)
      setSavedAt(null)
      setShowErrors(false)
      setTab('personal')
      toast.success(`Loaded “${item.name}”`)
    },
    [setCv],
  )

  // ?load=<id> from the Saved CVs page
  useEffect(() => {
    if (!loadId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await getSavedCVs()
        if (cancelled) return
        const found = Array.isArray(res.data) ? res.data.find((c) => c.id === loadId) : undefined
        if (found) loadSaved(found)
        else toast.error('That saved CV no longer exists.')
      } catch (e) {
        if (!cancelled) toast.error(apiError(e, 'Couldn’t load the saved CV.'))
      } finally {
        if (!cancelled)
          setSearchParams(
            (prev: URLSearchParams) => {
              const next = new URLSearchParams(prev)
              next.delete('load')
              return next
            },
            { replace: true },
          )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadId, loadSaved, setSearchParams])

  const runStructure = useCallback(
    async (rawText: string, force: boolean) => {
      setProgress({ ...EMPTY_PROGRESS })
      setPendingRawText(null)
      const res = await structureCVStream(rawText, force, (event: StructureEvent) => {
        if (!mountedRef.current) return
        if (event.type === 'start') {
          setStructuring(true)
          setProgress({ started: true, totalChunks: event.total_chunks, completedChunks: 0, merging: false, cached: false, error: null })
        } else if (event.type === 'progress') setProgress((p) => ({ ...p, completedChunks: event.chunk }))
        else if (event.type === 'merging') setProgress((p) => ({ ...p, merging: true }))
        else if (event.type === 'cached') setFromCache(true)
        else if (event.type === 'error') setProgress((p) => ({ ...p, error: event.message }))
      })
      if (!mountedRef.current) return
      if (res.success && res.data) {
        setCv(payloadToCVData(res.data))
        setLoadedName(null)
        setShowErrors(false)
        setTab('personal')
        toast.success('CV imported. Check each section.')
      } else toast.error(res.error || 'Import failed. Try again.')
      await new Promise((r) => setTimeout(r, 450))
      if (!mountedRef.current) return
      setStructuring(false)
      setProgress(EMPTY_PROGRESS)
    },
    [setCv],
  )

  // Builder: hydrate from the cached structure on the server once
  useEffect(() => {
    if (variant !== 'builder' || !autoLoadFromBackend || loadId || hydratedRef.current) return
    hydratedRef.current = true
    if (!isDefaultCV(useCVStore.getState().builderCV)) return
    void (async () => {
      try {
        const res = await getCurrentCV()
        if (!mountedRef.current) return
        const cached = res.data?.cv_structured
        const raw = res.data?.cv_text
        if (cached) {
          setBuilderCV(payloadToCVData(cached))
          setFromCache(true)
          return
        }
        if (raw && raw.trim().length >= 100) setPendingRawText(raw)
      } catch {
        /* silent */
      }
    })()
  }, [variant, autoLoadFromBackend, loadId, setBuilderCV])

  async function processFile(file: File) {
    const problem = validateFile(file)
    if (problem) return toast.error(problem)
    setUploading(true)
    try {
      const res = await uploadCV(file, true)
      if (res.success && res.data?.text) {
        setUploadedFileName(file.name)
        setFromCache(false)
        await runStructure(res.data.text, true)
      } else toast.error(res.error || 'We couldn’t read that file.')
    } catch (e) {
      toast.error(apiError(e, 'Upload failed. Try again.'))
    } finally {
      if (mountedRef.current) setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function onFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) void processFile(f)
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void processFile(f)
  }

  function onPasteImport() {
    const t = pastedText.trim()
    if (t.length < 100) return toast.error('Paste at least 100 characters.')
    setPastedText('')
    setUploadedFileName('')
    setFromCache(false)
    void runStructure(t, true)
  }

  async function onClearAll() {
    if (clearing) return
    setClearing(true)
    try {
      if (variant === 'builder') await clearCV()
      setCv(DEFAULT_CV)
      setFromCache(false)
      setPendingRawText(null)
      setUploadedFileName('')
      setPastedText('')
      setClearOpen(false)
      setSavedAt(null)
      setLoadedName(null)
      setShowErrors(false)
      setTab('personal')
      toast.success('Form cleared')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t clear. Try again.'))
    } finally {
      if (mountedRef.current) setClearing(false)
    }
  }

  // ── Mutators ──────────────────────────────────────────
  const updatePersonal = <K extends keyof CVData['personal']>(key: K, value: CVData['personal'][K]) =>
    setCv((prev) => ({ ...prev, personal: { ...prev.personal, [key]: value } }))
  const addExperience = () => setCv((p) => ({ ...p, experience: [...p.experience, blankExperience()] }))
  const removeExperience = (id: string) => setCv((p) => ({ ...p, experience: p.experience.filter((e) => e.id !== id) }))
  const updateExperience = (id: string, patch: Partial<CVExperience>) =>
    setCv((p) => ({ ...p, experience: p.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const updateBullet = (expId: string, idx: number, text: string) =>
    setCv((p) => ({ ...p, experience: p.experience.map((e) => (e.id === expId ? { ...e, bullets: e.bullets.map((b, i) => (i === idx ? text : b)) } : e)) }))
  const addBullet = (expId: string) => setCv((p) => ({ ...p, experience: p.experience.map((e) => (e.id === expId ? { ...e, bullets: [...e.bullets, ''] } : e)) }))
  const removeBullet = (expId: string, idx: number) =>
    setCv((p) => ({ ...p, experience: p.experience.map((e) => (e.id === expId ? { ...e, bullets: e.bullets.filter((_, i) => i !== idx) } : e)) }))
  const addEducation = () => setCv((p) => ({ ...p, education: [...p.education, blankEducation()] }))
  const removeEducation = (id: string) => setCv((p) => ({ ...p, education: p.education.filter((e) => e.id !== id) }))
  const updateEducation = (id: string, patch: Partial<CVEducation>) =>
    setCv((p) => ({ ...p, education: p.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const addSkills = (raw: string) => {
    const incoming = raw
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
    if (!incoming.length) return
    setCv((p) => {
      const seen = new Set(p.skills.map((x) => x.toLowerCase()))
      const next = [...p.skills]
      for (const x of incoming)
        if (!seen.has(x.toLowerCase())) {
          seen.add(x.toLowerCase())
          next.push(x.slice(0, 60))
        }
      return { ...p, skills: next }
    })
  }
  const removeSkill = (x: string) => setCv((p) => ({ ...p, skills: p.skills.filter((y) => y !== x) }))
  const addProject = () => setCv((p) => ({ ...p, projects: [...p.projects, blankProject()] }))
  const removeProject = (id: string) => setCv((p) => ({ ...p, projects: p.projects.filter((x) => x.id !== id) }))
  const updateProject = (id: string, patch: Partial<CVProject>) => setCv((p) => ({ ...p, projects: p.projects.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const addCertification = () => setCv((p) => ({ ...p, certifications: [...p.certifications, blankCertification()] }))
  const removeCertification = (id: string) => setCv((p) => ({ ...p, certifications: p.certifications.filter((x) => x.id !== id) }))
  const updateCertification = (id: string, patch: Partial<CVCertification>) =>
    setCv((p) => ({ ...p, certifications: p.certifications.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

  async function onRewrite(expId: string, idx: number, text: string) {
    if (!text.trim()) return toast.error('Write the point first, then improve it.')
    const key = `${expId}-${idx}`
    setRewritingId(key)
    try {
      const res = await rewriteBullet(text, cv.personal.job_title)
      if (res.success && res.data) {
        updateBullet(expId, idx, res.data.rewritten)
        toast.success('Rewritten. Edit it if anything’s off.')
      } else toast.error(res.error || 'Rewrite unavailable right now.')
    } catch (e) {
      toast.error(apiError(e, 'Rewrite unavailable right now.'))
    } finally {
      if (mountedRef.current) setRewritingId(null)
    }
  }

  async function onSummary() {
    const background = [
      cv.personal.job_title,
      cv.experience
        .map((e) => [e.role, e.company].filter(Boolean).join(' at '))
        .filter(Boolean)
        .join('. '),
      cv.education
        .map((e) => [e.degree, e.field, e.institution].filter(Boolean).join(', '))
        .filter(Boolean)
        .join('. '),
      cv.skills.slice(0, 12).join(', '),
    ]
      .filter(Boolean)
      .join('. ')
    if (background.trim().length < 10) return toast.error('Add your title, a job or your education first.')
    setGeneratingSummary(true)
    try {
      const res = await generateSummary(background, cv.personal.job_title || 'Professional')
      if (res.success && res.data) {
        updatePersonal('summary', res.data.summary)
        toast.success('Summary drafted. Make it sound like you.')
      } else toast.error(res.error || 'Summary unavailable right now.')
    } catch (e) {
      toast.error(apiError(e, 'Summary unavailable right now.'))
    } finally {
      if (mountedRef.current) setGeneratingSummary(false)
    }
  }

  async function onSave() {
    if (saving || !ensureValid('saving')) return
    setSaving(true)
    try {
      const name = [cv.personal.full_name.trim(), cv.personal.job_title.trim(), new Date().toISOString().slice(0, 10)].filter(Boolean).join(' · ')
      const res = await saveCV(name, cv)
      if (res.success) {
        setSavedAt(new Date().toISOString())
        setLoadedName(name)
        toast.success('CV saved')
      } else toast.error(res.error || 'Save failed.')
    } catch (e) {
      toast.error(apiError(e, 'Save failed.'))
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  // ── Export ────────────────────────────────────────────
  function plainText(): string {
    const { personal: p, experience, education, skills, projects, certifications } = cv
    const out: string[] = [p.full_name.toUpperCase()]
    if (p.job_title) out.push(p.job_title)
    out.push([p.location, p.email, p.phone, p.linkedin, p.github].filter(Boolean).join(' | '))
    out.push('')
    if (p.summary.trim()) out.push('SUMMARY', p.summary, '')
    if (experience.length) {
      out.push('EXPERIENCE')
      experience.forEach((e) => {
        const end = e.is_current ? 'Present' : e.end_date || ''
        out.push([e.role, e.company].filter(Boolean).join(', '), `${e.start_date}${end ? ' - ' + end : ''}`)
        e.bullets.filter(Boolean).forEach((b) => out.push(`- ${b}`))
        out.push('')
      })
    }
    if (education.length) {
      out.push('EDUCATION')
      education.forEach((e) => {
        out.push([e.institution, [e.degree, e.field].filter(Boolean).join(' in ')].filter(Boolean).join(', '))
        if (e.start_date || e.end_date) out.push([e.start_date, e.end_date].filter(Boolean).join(' - '))
        out.push('')
      })
    }
    if (skills.length) out.push('SKILLS', skills.join(', '), '')
    if (projects.length) {
      out.push('PROJECTS')
      projects.forEach((x) => {
        out.push(x.name)
        if (x.description) out.push(x.description)
        if (x.tech_stack.length) out.push(x.tech_stack.join(', '))
        if (x.url) out.push(x.url)
        out.push('')
      })
    }
    if (certifications.length) {
      out.push('CERTIFICATIONS & LICENSES')
      certifications.forEach((c) => out.push(`${c.name}${c.issuer ? ', ' + c.issuer : ''}${c.date ? ' (' + c.date + ')' : ''}`))
    }
    return out.join('\n')
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const fileBase = () => (cv.personal.full_name || 'cv').trim().replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60) || 'cv'

  function exportTXT() {
    if (!ensureValid('exporting')) return
    download(new Blob([plainText()], { type: 'text/plain;charset=utf-8' }), `${fileBase()}.txt`)
  }

  async function exportDOCX() {
    if (!ensureValid('exporting')) return
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
      const { saveAs } = await import('file-saver')
      const { personal: p, experience, education, skills, projects, certifications } = cv
      const kids: InstanceType<typeof Paragraph>[] = []
      const H = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, bold: true })] })
      kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: p.full_name, bold: true })] }))
      if (p.job_title) kids.push(new Paragraph({ children: [new TextRun({ text: p.job_title, italics: true })] }))
      kids.push(new Paragraph({ children: [new TextRun({ text: [p.location, p.email, p.phone, p.linkedin, p.github].filter(Boolean).join(' | '), size: 20 })] }))
      if (p.summary.trim()) kids.push(H('Summary'), new Paragraph({ children: [new TextRun({ text: p.summary })] }))
      if (experience.length) {
        kids.push(H('Experience'))
        experience.forEach((e) => {
          const end = e.is_current ? 'Present' : e.end_date || ''
          kids.push(
            new Paragraph({
              children: [
                new TextRun({ text: [e.role, e.company].filter(Boolean).join(', '), bold: true }),
                new TextRun({ text: `    ${e.start_date}${end ? ' - ' + end : ''}`, italics: true }),
              ],
            }),
          )
          e.bullets.filter(Boolean).forEach((b) => kids.push(new Paragraph({ text: b, bullet: { level: 0 } })))
        })
      }
      if (education.length) {
        kids.push(H('Education'))
        education.forEach((e) =>
          kids.push(
            new Paragraph({
              children: [
                new TextRun({ text: [e.institution, [e.degree, e.field].filter(Boolean).join(' in ')].filter(Boolean).join(', '), bold: true }),
                new TextRun({ text: e.start_date || e.end_date ? `    ${[e.start_date, e.end_date].filter(Boolean).join(' - ')}` : '', italics: true }),
              ],
            }),
          ),
        )
      }
      if (skills.length) kids.push(H('Skills'), new Paragraph({ children: [new TextRun({ text: skills.join(', ') })] }))
      if (projects.length) {
        kids.push(H('Projects'))
        projects.forEach((x) => {
          kids.push(new Paragraph({ children: [new TextRun({ text: x.name, bold: true })] }))
          x.description
            .split('\n')
            .filter(Boolean)
            .forEach((l) => kids.push(new Paragraph({ text: l, bullet: { level: 0 } })))
        })
      }
      if (certifications.length) {
        kids.push(H('Certifications & licenses'))
        certifications.forEach((c) =>
          kids.push(new Paragraph({ text: `${c.name}${c.issuer ? ', ' + c.issuer : ''}${c.date ? ' (' + c.date + ')' : ''}`, bullet: { level: 0 } })),
        )
      }
      const doc = new Document({ sections: [{ properties: {}, children: kids }] })
      saveAs(await Packer.toBlob(doc), `${fileBase()}.docx`)
    } catch {
      toast.error('Word export failed. Try plain text.')
    }
  }

  function exportPDF() {
    if (!ensureValid('exporting')) return
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cv.personal.full_name)}</title>
      <style>@page{margin:18mm}body{font-family:${template === 'modern' ? 'Inter,system-ui,sans-serif' : 'Georgia,serif'};font-size:11pt;color:#111;line-height:1.5}p{margin:0 0 5px;white-space:pre-wrap}</style></head>
      <body>${plainText()
        .split('\n')
        .map((l) => `<p>${esc(l) || '&nbsp;'}</p>`)
        .join('')}</body></html>`
    const w = window.open('', '_blank')
    if (!w) return toast.error('Allow pop-ups for this site to save as PDF.')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
      w.close()
    }, 250)
  }

  const displayName = cv.personal.full_name.trim() || 'Untitled CV'
  const atsTone = ats.score >= 80 ? 'accent' : ats.score >= 60 ? 'warn' : 'danger'

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {contextLabel && <Badge tone="accent">{contextLabel}</Badge>}
          <span className="text-sm font-medium truncate">{loadedName || displayName}</span>
          <span className="text-xs text-muted whitespace-nowrap">{savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon="folder_open" onClick={() => setSavedOpen(true)}>
            Saved CVs
          </Button>
          <Button size="sm" icon="save" loading={saving} onClick={onSave}>
            Save CV
          </Button>
        </div>
      </div>

      {/* Import */}
      {showImport && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-[15px] font-semibold">Start from your current CV</h2>
              <p className="text-sm text-muted mt-1">Optional. We’ll fill the form for you to check, or skip this and type it in.</p>
            </div>
            {uploadedFileName && <Badge tone="accent">{uploadedFileName}</Badge>}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a CV. PDF or Word, up to 4 MB."
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'rounded-[12px] border-2 border-dashed p-6 min-h-[168px] flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
                dragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-muted/60',
              )}
            >
              <Icon name={uploading ? 'progress_activity' : 'upload_file'} className={cn('text-[28px] text-muted', uploading && 'animate-spin text-accent')} />
              <p className="mt-3 text-sm font-medium">{uploading ? 'Reading your file…' : 'Drop a PDF or Word file, or click to choose'}</p>
              <p className="mt-1 text-xs text-muted">Up to 4 MB</p>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={onFileSelect} disabled={uploading || structuring} />
            </div>
            <div className="flex flex-col gap-2">
              <TextArea
                aria-label="Paste CV text"
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Or paste the text of your CV here."
                className="min-h-[120px]"
              />
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-xs tabular', pastedText.length >= 100 ? 'text-accent' : 'text-muted')}>
                  {pastedText.length.toLocaleString()} characters{pastedText.length < 100 ? ', 100 minimum' : ''}
                </span>
                <Button size="sm" variant="secondary" icon="auto_awesome" onClick={onPasteImport} disabled={pastedText.trim().length < 100 || uploading || structuring}>
                  Fill the form
                </Button>
              </div>
            </div>
          </div>
          {fromCache && !structuring && <p className="mt-4 text-xs text-muted">Loaded from your last import. No AI credits used.</p>}
          {pendingRawText && !structuring && !fromCache && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-[10px] border border-accent/30 bg-accent/5 p-3">
              <Icon name="history" className="text-[20px] text-accent shrink-0" />
              <p className="flex-1 text-sm">We have the CV you uploaded earlier. Fill the form from it?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPendingRawText(null)}>
                  Not now
                </Button>
                <Button size="sm" onClick={() => runStructure(pendingRawText, false)}>
                  Fill the form
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Form */}
      <Card className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Your CV</h2>
            <p className="text-sm text-muted mt-1">
              Fields marked <span className="text-accent">*</span> are needed to save or export.
            </p>
          </div>
          <Button variant="ghost" size="sm" icon="delete_sweep" onClick={() => setClearOpen(true)} className="self-start hover:text-danger">
            Clear all
          </Button>
        </div>

        {/* Required checklist */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted tabular mr-1">
            {requiredDone} of {checklist.length} required
          </span>
          {checklist.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setTab(c.tab)}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors',
                c.ok ? 'border-accent/30 text-accent bg-accent/5' : 'border-line text-muted hover:text-fg hover:border-muted/60',
              )}
            >
              <Icon name={c.ok ? 'check_circle' : 'radio_button_unchecked'} fill={c.ok} className="text-[14px]" />
              {c.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="CV sections" className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 border-b border-line">
          {TABS.map((t) => {
            const active = tab === t.key
            const n = showErrors ? validation.byTab[t.key] : 0
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  'relative shrink-0 h-10 px-3 text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors',
                  active ? 'text-fg' : 'text-muted hover:text-fg',
                )}
              >
                <Icon name={t.icon} className="text-[17px]" />
                {t.label}
                {t.optional && !active && <span className="text-[11px] text-muted/70 font-normal">optional</span>}
                {n > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-fg text-[10px] leading-[18px] text-center tabular">{n}</span>}
                {active && <motion.span layoutId={`cv-tab-${variant}`} className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-accent" />}
              </button>
            )
          })}
        </div>

        {tab === 'personal' && (
          <div className="flex flex-col gap-5">
            <SectionIntro title="Personal details" body="How recruiters identify and reach you." required />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Full name" required value={cv.personal.full_name} onChange={(e) => updatePersonal('full_name', e.target.value)} autoComplete="name" error={err('personal.full_name')} />
              <Field
                label="Professional title"
                required
                value={cv.personal.job_title}
                onChange={(e) => updatePersonal('job_title', e.target.value)}
                placeholder="e.g. Registered Nurse, Accountant"
                error={err('personal.job_title')}
              />
              <Field label="Email" required type="email" value={cv.personal.email} onChange={(e) => updatePersonal('email', e.target.value)} autoComplete="email" spellCheck={false} error={err('personal.email')} />
              <Field label="Phone" required type="tel" value={cv.personal.phone} onChange={(e) => updatePersonal('phone', e.target.value)} autoComplete="tel" error={err('personal.phone')} />
              <Field label="Location" required value={cv.personal.location} onChange={(e) => updatePersonal('location', e.target.value)} placeholder="City, Country" error={err('personal.location')} />
              <Field label="LinkedIn" optional value={cv.personal.linkedin} onChange={(e) => updatePersonal('linkedin', e.target.value)} placeholder="linkedin.com/in/…" />
              <Field
                label="Portfolio or website"
                optional
                value={cv.personal.github}
                onChange={(e) => updatePersonal('github', e.target.value)}
                placeholder="Personal site, Behance, GitHub…"
                wrapClassName="sm:col-span-2 lg:col-span-1"
              />
            </div>
            <TextArea
              label="Summary"
              rows={5}
              value={cv.personal.summary}
              onChange={(e) => updatePersonal('summary', e.target.value)}
              placeholder="2 to 4 sentences: who you are, your experience, your strongest skills, and the role you want."
              hint={`${cv.personal.summary.length} characters${cv.personal.summary.length < 100 ? '. Aim for 100 or more.' : ''}`}
              labelAction={
                <Button variant="ghost" size="sm" icon="auto_awesome" loading={generatingSummary} onClick={onSummary} className="h-7 -mr-2 text-accent hover:text-accent">
                  Draft with AI
                </Button>
              }
            />
          </div>
        )}

        {tab === 'experience' && (
          <div className="flex flex-col gap-4">
            <SectionIntro
              title="Experience"
              body="Jobs, internships, volunteering, freelance. No work history yet? Fill in Education instead."
              required
              count={cv.experience.length}
              onAdd={cv.experience.length ? addExperience : undefined}
              addLabel="Add position"
            />
            {cv.experience.length === 0 && (
              <EmptyBox
                icon="work_history"
                title="No positions yet"
                body="Start with the most recent. Title, organisation, dates, and 2 to 5 things you achieved."
                action="Add position"
                onAction={addExperience}
                error={err('section.experience')}
              />
            )}
            <AnimatePresence initial={false}>
              {cv.experience.map((x, i) => (
                <EntryShell key={x.id} label={`Position ${i + 1}${i === 0 ? ', most recent' : ''}`} onRemove={() => removeExperience(x.id)}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Job title" required value={x.role} onChange={(e) => updateExperience(x.id, { role: e.target.value })} error={err(`exp.${x.id}.role`)} />
                    <Field
                      label="Organisation"
                      required
                      value={x.company}
                      onChange={(e) => updateExperience(x.id, { company: e.target.value })}
                      placeholder="Company, hospital, school, client"
                      error={err(`exp.${x.id}.company`)}
                    />
                    <Field label="Start" required value={x.start_date} onChange={(e) => updateExperience(x.id, { start_date: e.target.value })} placeholder="e.g. Jan 2022" error={err(`exp.${x.id}.start_date`)} />
                    <div className="flex flex-col gap-2">
                      <Field
                        label="End"
                        required={!x.is_current}
                        value={x.is_current ? 'Present' : x.end_date || ''}
                        onChange={(e) => updateExperience(x.id, { end_date: e.target.value })}
                        placeholder="e.g. Mar 2024"
                        disabled={x.is_current}
                        error={err(`exp.${x.id}.end_date`)}
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none w-fit">
                        <input
                          type="checkbox"
                          checked={x.is_current}
                          onChange={(e) => updateExperience(x.id, { is_current: e.target.checked, end_date: e.target.checked ? null : x.end_date })}
                          className="w-4 h-4 accent-accent"
                        />
                        I work here now
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] font-medium">
                      Achievements <span className="text-muted font-normal ml-1">2 to 5 recommended</span>
                    </p>
                    {x.bullets.map((b, idx) => {
                      const busy = rewritingId === `${x.id}-${idx}`
                      return (
                        <div key={idx} className="group flex items-start gap-2">
                          <TextArea
                            aria-label={`Achievement ${idx + 1}`}
                            rows={2}
                            value={b}
                            onChange={(e) => updateBullet(x.id, idx, e.target.value)}
                            placeholder="Start with a verb, end with a result. “Cut patient wait times 20% by redesigning the triage rota.”"
                            wrapClassName="flex-1"
                            className="min-h-[64px]"
                          />
                          <div className="flex flex-col gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() => onRewrite(x.id, idx, b)}
                              disabled={busy}
                              aria-label="Improve with AI"
                              title="Improve with AI"
                              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-60"
                            >
                              <Icon name={busy ? 'progress_activity' : 'auto_awesome'} className={cn('text-[18px]', busy && 'animate-spin text-accent')} />
                            </button>
                            {x.bullets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBullet(x.id, idx)}
                                aria-label="Remove achievement"
                                title="Remove"
                                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              >
                                <Icon name="close" className="text-[18px]" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <Button variant="ghost" size="sm" icon="add" onClick={() => addBullet(x.id)} className="self-start -ml-2">
                      Add achievement
                    </Button>
                  </div>
                </EntryShell>
              ))}
            </AnimatePresence>
          </div>
        )}

        {tab === 'education' && (
          <div className="flex flex-col gap-4">
            <SectionIntro
              title="Education"
              body="Degrees, diplomas, vocational training, school qualifications."
              required
              count={cv.education.length}
              onAdd={cv.education.length ? addEducation : undefined}
              addLabel="Add education"
            />
            {cv.education.length === 0 && (
              <EmptyBox icon="school" title="No education yet" body="Start with your highest qualification. Required if you have no work history." action="Add education" onAction={addEducation} />
            )}
            <AnimatePresence initial={false}>
              {cv.education.map((x, i) => (
                <EntryShell key={x.id} label={`Education ${i + 1}`} onRemove={() => removeEducation(x.id)}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field
                      label="Institution"
                      required
                      value={x.institution}
                      onChange={(e) => updateEducation(x.id, { institution: e.target.value })}
                      error={err(`edu.${x.id}.institution`)}
                      wrapClassName="sm:col-span-2"
                    />
                    <Field
                      label="Qualification"
                      required
                      value={x.degree}
                      onChange={(e) => updateEducation(x.id, { degree: e.target.value })}
                      placeholder="e.g. BA, Diploma, A-Levels"
                      error={err(`edu.${x.id}.degree`)}
                    />
                    <Field label="Field of study" optional value={x.field} onChange={(e) => updateEducation(x.id, { field: e.target.value })} placeholder="e.g. Nursing, Finance" />
                    <Field label="Start" optional value={x.start_date} onChange={(e) => updateEducation(x.id, { start_date: e.target.value })} placeholder="e.g. 2018" />
                    <Field label="End or expected" optional value={x.end_date} onChange={(e) => updateEducation(x.id, { end_date: e.target.value })} placeholder="e.g. 2022" />
                  </div>
                </EntryShell>
              ))}
            </AnimatePresence>
          </div>
        )}

        {tab === 'skills' && <SkillsTab skills={cv.skills} onAdd={addSkills} onRemove={removeSkill} error={err('section.skills')} />}

        {tab === 'projects' && (
          <div className="flex flex-col gap-4">
            <SectionIntro
              title="Projects"
              body="Campaigns, research, events, case studies, side projects. Skip this if it doesn’t fit your field."
              count={cv.projects.length}
              onAdd={cv.projects.length ? addProject : undefined}
              addLabel="Add project"
            />
            {cv.projects.length === 0 && (
              <EmptyBox icon="folder_open" title="No projects" body="Useful for showing results that don’t fit under a job title." action="Add project" onAction={addProject} />
            )}
            <AnimatePresence initial={false}>
              {cv.projects.map((x, i) => (
                <EntryShell key={x.id} label={`Project ${i + 1}`} onRemove={() => removeProject(x.id)}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Title" required value={x.name} onChange={(e) => updateProject(x.id, { name: e.target.value })} error={err(`prj.${x.id}.name`)} />
                    <Field label="Link" optional value={x.url} onChange={(e) => updateProject(x.id, { url: e.target.value })} placeholder="https://" />
                  </div>
                  <TextArea label="Description" optional rows={3} value={x.description} onChange={(e) => updateProject(x.id, { description: e.target.value })} placeholder="What you did and what came of it. One point per line." />
                  <Field
                    label="Tools or skills used"
                    optional
                    value={x.tech_stack.join(', ')}
                    onChange={(e) =>
                      updateProject(x.id, {
                        tech_stack: e.target.value
                          .split(',')
                          .map((y) => y.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Comma separated"
                  />
                </EntryShell>
              ))}
            </AnimatePresence>
          </div>
        )}

        {tab === 'certifications' && (
          <div className="flex flex-col gap-4">
            <SectionIntro
              title="Certifications and licenses"
              body="Professional licenses, certificates, courses, awards."
              count={cv.certifications.length}
              onAdd={cv.certifications.length ? addCertification : undefined}
              addLabel="Add certification"
            />
            {cv.certifications.length === 0 && (
              <EmptyBox icon="workspace_premium" title="None added" body="For example CPA, RN license, PMP, First Aid, IELTS." action="Add certification" onAction={addCertification} />
            )}
            <AnimatePresence initial={false}>
              {cv.certifications.map((x, i) => (
                <EntryShell key={x.id} label={`Certification ${i + 1}`} onRemove={() => removeCertification(x.id)}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Name" required value={x.name} onChange={(e) => updateCertification(x.id, { name: e.target.value })} error={err(`cert.${x.id}.name`)} />
                    <Field label="Issued by" optional value={x.issuer} onChange={(e) => updateCertification(x.id, { issuer: e.target.value })} />
                    <Field label="Date" optional value={x.date} onChange={(e) => updateCertification(x.id, { date: e.target.value })} placeholder="e.g. 2023" />
                    <Field label="Credential link" optional value={x.url} onChange={(e) => updateCertification(x.id, { url: e.target.value })} placeholder="https://" />
                  </div>
                </EntryShell>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Preview + export */}
      <Card className="flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Preview</h2>
            <p className="text-sm text-muted mt-1">Updates as you type.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Template" className="inline-flex p-1 gap-1 bg-ink border border-line rounded-[10px]">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={template === t.key}
                  title={t.description}
                  onClick={() => setTemplate(t.key)}
                  className={cn('h-8 px-3 rounded-[7px] text-[13px] font-medium transition-colors', template === t.key ? 'bg-line text-fg' : 'text-muted hover:text-fg')}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 text-muted">
              <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out" className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:text-fg hover:bg-line transition-colors">
                <Icon name="remove" className="text-[18px]" />
              </button>
              <button type="button" onClick={() => setZoom(100)} className="text-xs tabular w-12 text-center hover:text-fg" aria-label="Reset zoom">
                {zoom}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} aria-label="Zoom in" className="w-8 h-8 rounded-[8px] flex items-center justify-center hover:text-fg hover:bg-line transition-colors">
                <Icon name="add" className="text-[18px]" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-[12px] bg-ink border border-line p-4 sm:p-8">
          <div className="bg-white text-slate-900 rounded-[4px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] mx-auto" style={{ width: 794, minWidth: 794, zoom: scale } as CSSProperties}>
            <div className={cn(s.wrap, s.font, 'flex flex-col gap-5 text-left')}>
              <div className="text-center pb-4 border-b-2 border-slate-900">
                <h1 className={cn(s.name, 'text-slate-900 leading-tight break-words')}>{cv.personal.full_name || 'Your Name'}</h1>
                <p className={cn(s.title, 'break-words')}>{cv.personal.job_title || 'Professional Title'}</p>
                <p className={cn(s.contact, 'break-words')}>
                  {[cv.personal.location, cv.personal.email, cv.personal.phone, cv.personal.linkedin, cv.personal.github].filter(Boolean).join('  |  ') || 'City, Country  |  you@example.com'}
                </p>
              </div>
              {cv.personal.summary.trim() && (
                <PreviewSection s={s} title="Summary">
                  <p className={cn(s.body, 'text-slate-800 whitespace-pre-line break-words')}>{cv.personal.summary}</p>
                </PreviewSection>
              )}
              {cv.experience.length > 0 && (
                <PreviewSection s={s} title="Experience">
                  {cv.experience.map((e) => {
                    const end = e.is_current ? 'Present' : e.end_date || ''
                    return (
                      <div key={e.id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 break-words">
                            <span className="font-bold text-[13px]">{e.role || 'Job title'}</span>
                            {e.company && <span className="text-slate-600 text-[12.5px]">, {e.company}</span>}
                          </p>
                          <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                            {e.start_date}
                            {end ? ` - ${end}` : ''}
                          </span>
                        </div>
                        <ul className={cn('list-disc pl-5 space-y-1 text-slate-800', s.body)}>
                          {e.bullets.filter(Boolean).map((b, i) => (
                            <li key={i} className="break-words">
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </PreviewSection>
              )}
              {cv.education.length > 0 && (
                <PreviewSection s={s} title="Education">
                  {cv.education.map((e) => (
                    <div key={e.id} className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 break-words text-[12.5px]">
                        <span className="font-semibold">{e.institution || 'Institution'}</span>
                        {(e.degree || e.field) && <span className="text-slate-600">, {[e.degree, e.field].filter(Boolean).join(' in ')}</span>}
                      </p>
                      <span className="text-[11px] text-slate-600 whitespace-nowrap">{[e.start_date, e.end_date].filter(Boolean).join(' - ')}</span>
                    </div>
                  ))}
                </PreviewSection>
              )}
              {cv.skills.length > 0 && (
                <PreviewSection s={s} title="Skills">
                  <p className={cn(s.body, 'text-slate-800 break-words')}>{cv.skills.join(', ')}</p>
                </PreviewSection>
              )}
              {cv.projects.length > 0 && (
                <PreviewSection s={s} title="Projects">
                  {cv.projects.map((x) => (
                    <div key={x.id} className={cn(s.body, 'text-slate-800 break-words')}>
                      <span className="font-semibold">{x.name}</span>
                      {x.tech_stack.length > 0 && <span className="text-slate-600"> ({x.tech_stack.join(', ')})</span>}
                      {x.description && (
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                          {x.description
                            .split('\n')
                            .filter(Boolean)
                            .map((l, i) => (
                              <li key={i}>{l}</li>
                            ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </PreviewSection>
              )}
              {cv.certifications.length > 0 && (
                <PreviewSection s={s} title="Certifications & licenses">
                  <ul className={cn('list-disc pl-5 space-y-0.5 text-slate-800', s.body)}>
                    {cv.certifications.map((c) => (
                      <li key={c.id} className="break-words">
                        <strong className="font-semibold">{c.name}</strong>
                        {c.issuer && <span>, {c.issuer}</span>}
                        {c.date && <span className="text-slate-600"> ({c.date})</span>}
                      </li>
                    ))}
                  </ul>
                </PreviewSection>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Readability check</span>
              <Badge tone={atsTone}>{ats.score} / 100</Badge>
            </div>
            <ul className="flex flex-col gap-1.5">
              {(ats.tips.length ? ats.tips : ['Every core check passes.']).slice(0, 4).map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-muted">
                  <Icon name={ats.tips.length ? 'arrow_right_alt' : 'check'} className={cn('text-[18px] shrink-0', ats.tips.length ? 'text-muted' : 'text-accent')} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="picture_as_pdf" onClick={exportPDF}>
              Save as PDF
            </Button>
            <Button variant="secondary" icon="description" onClick={exportDOCX}>
              Word
            </Button>
            <Button variant="secondary" icon="article" onClick={exportTXT}>
              Text
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => !clearing && setClearOpen(false)}
        onConfirm={onClearAll}
        loading={clearing}
        title="Clear the whole form?"
        body={`Every field is emptied${variant === 'builder' ? ' and your imported CV is removed from the server' : ''}. Saved CVs aren’t touched.`}
        confirmLabel="Clear everything"
      />

      <SavedCVsDialog
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onLoad={(item) => {
          loadSaved(item)
          setSavedOpen(false)
        }}
        hasContent={!isDefaultCV(cv)}
        showManageLink={variant === 'builder'}
      />

      <AIProgressPopup open={structuring} state={progress} />
    </div>
  )
}

function PreviewSection({ s, title, children }: { s: (typeof PREVIEW)[TemplateKey]; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className={cn(s.heading, s.rule, 'pb-1.5')}>{title}</h2>
      {children}
    </section>
  )
}

// ─── Skills tab ──────────────────────────────────────────
function SkillsTab({ skills, onAdd, onRemove, error }: { skills: string[]; onAdd: (raw: string) => void; onRemove: (s: string) => void; error?: string }) {
  const [draft, setDraft] = useState('')
  const reduce = useReducedMotion()
  const add = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }
  return (
    <div className="flex flex-col gap-4">
      <SectionIntro title="Skills" body={`At least ${MIN_SKILLS}, ideally 5 to 15. Use the same words the job ads use.`} required />
      <div className="flex gap-2">
        <Field
          aria-label="Add skills"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="e.g. Budgeting, Patient care, Excel. Commas add several."
          error={error}
          wrapClassName="flex-1"
        />
        <Button variant="secondary" onClick={add} className="h-11">
          Add
        </Button>
      </div>
      <p className={cn('text-xs tabular', skills.length >= MIN_SKILLS ? 'text-accent' : 'text-muted')}>
        {skills.length} skill{skills.length === 1 ? '' : 's'}
        {skills.length < MIN_SKILLS && `, ${MIN_SKILLS - skills.length} more needed`}
      </p>
      {skills.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {skills.map((x) => (
              <motion.li
                key={x}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-line text-sm max-w-full"
              >
                <span className="truncate">{x}</span>
                <button type="button" onClick={() => onRemove(x)} aria-label={`Remove ${x}`} className="w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-ink/60 transition-colors">
                  <Icon name="close" className="text-[14px]" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <p className="text-sm text-muted">Mix hard skills (tools, methods, licenses) with soft ones (leadership, negotiation).</p>
      )}
    </div>
  )
}

// ─── Saved CVs picker (in place) ─────────────────────────
function SavedCVsDialog({
  open,
  onClose,
  onLoad,
  hasContent,
  showManageLink,
}: {
  open: boolean
  onClose: () => void
  onLoad: (item: SavedCV) => void
  hasContent: boolean
  showManageLink: boolean
}) {
  const [items, setItems] = useState<SavedCV[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    setConfirmId(null)
    getSavedCVs()
      .then((res) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data)) setItems(res.data)
        else setError(res.error || 'Couldn’t load saved CVs.')
      })
      .catch((e) => !cancelled && setError(apiError(e, 'Couldn’t load saved CVs.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Saved CVs"
      description="Pick one to fill this form. You’ll stay on this page."
      footer={
        showManageLink ? (
          <Link to="/dashboard/cv-builder/saved" className="text-sm text-muted hover:text-fg transition-colors inline-flex items-center gap-1 mr-auto">
            Manage saved CVs
            <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14 rounded-[10px]" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : items.length === 0 ? (
        <EmptyState icon="folder_open" title="Nothing saved yet" body="Fill in the required fields and press Save CV." className="py-8" />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const d = normalizeCVData(item.cv_data)
            const confirming = confirmId === item.id
            return (
              <li key={item.id} className={cn('rounded-[10px] border p-3 transition-colors', confirming ? 'border-warn/40 bg-warn/5' : 'border-line hover:border-muted/50')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.personal.full_name || item.name}</p>
                    <p className="text-xs text-muted truncate">
                      {d.personal.job_title || 'No title'} · {d.experience.length} job{d.experience.length === 1 ? '' : 's'} · {formatDate(item.updated_at)}
                    </p>
                  </div>
                  {!confirming && (
                    <Button size="sm" onClick={() => (hasContent ? setConfirmId(item.id) : onLoad(item))}>
                      Load
                    </Button>
                  )}
                </div>
                {confirming && (
                  <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-warn">Replace what’s in the form now?</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => onLoad(item)}>
                        Replace
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
