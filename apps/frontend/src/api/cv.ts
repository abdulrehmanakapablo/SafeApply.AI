// FILE: src/api/cv.ts
// PURPOSE: Frontend API client for /api/cv/*
// BACKEND: apps/backend/src/routes/cv.ts
// NOTE: structureCV streams NDJSON progress events via raw fetch.

import api from '../lib/axios'
import { clearUserData } from '../lib/session'

// ─── Types ────────────────────────────────────────────────
export interface CVPersonal {
  full_name: string
  job_title: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
  summary: string
}

export interface CVExperience {
  id: string
  company: string
  role: string
  start_date: string
  end_date: string | null
  is_current: boolean
  bullets: string[]
}

export interface CVEducation {
  id: string
  institution: string
  degree: string
  field: string
  start_date: string
  end_date: string
}

export interface CVProject {
  id: string
  name: string
  description: string
  url: string
  tech_stack: string[]
}

export interface CVCertification {
  id: string
  name: string
  issuer: string
  date: string
  url: string
}

export interface CVData {
  personal: CVPersonal
  experience: CVExperience[]
  education: CVEducation[]
  skills: string[]
  projects: CVProject[]
  certifications: CVCertification[]
}

export interface SavedCV {
  id: string
  user_id: string
  name: string
  cv_data: CVData
  created_at: string
  updated_at: string
}

export interface UploadResponse {
  success: boolean
  data?: {
    text: string
    word_count: number
    char_count: number
    file_name: string
  }
  error?: string
}

export interface StructuredCVPayload {
  personal: CVPersonal
  experience: Array<Omit<CVExperience, 'id'>>
  education: Array<Omit<CVEducation, 'id'>>
  skills: string[]
  projects: Array<Omit<CVProject, 'id'>>
  certifications: Array<Omit<CVCertification, 'id'>>
  /** Parser version stamped by the backend cache */
  _v?: number
}

export interface CurrentCVResponse {
  success: boolean
  data?: {
    cv_text: string | null
    cv_structured: StructuredCVPayload | null
  }
  error?: string
}

export interface StructureResponse {
  success: boolean
  data?: StructuredCVPayload
  error?: string
}

export interface SavedCVListResponse {
  success: boolean
  data: SavedCV[]
  error?: string
}

export interface SavedCVResponse {
  success: boolean
  data?: SavedCV
  error?: string
}

export interface RewriteBulletResponse {
  success: boolean
  data?: { original: string; rewritten: string }
  error?: string
}

export interface GenerateSummaryResponse {
  success: boolean
  data?: { summary: string }
  error?: string
}

// ─── NDJSON progress event shapes (from /cv/structure) ────
export type StructureEvent =
  | { type: 'start'; total_chunks: number }
  | {
      type: 'progress'
      chunk: number
      total: number
      stats: { exp: number; edu: number; skills: number }
    }
  | { type: 'merging'; chunks_done: number; chunks_total: number }
  | { type: 'done'; data: StructuredCVPayload }
  | { type: 'cached'; data: StructuredCVPayload }
  | { type: 'error'; message: string }

// ─── Timeouts ─────────────────────────────────────────────
const DEFAULT_TIMEOUT = 30_000

// ─── CV upload (PDF/DOCX parse) ──────────────────────────
export async function uploadCV(
  file: File,
  saveToProfile = false,
): Promise<UploadResponse> {
  const form = new FormData()
  form.append('cv', file)
  form.append('save_cv', String(saveToProfile))

  const res = await api.post<UploadResponse>('/cv/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: DEFAULT_TIMEOUT,
  })
  return res.data
}

// ─── Get current saved CV + cached structure ─────────────
export async function getCurrentCV(): Promise<CurrentCVResponse> {
  const res = await api.get<CurrentCVResponse>('/cv/current', {
    timeout: DEFAULT_TIMEOUT,
  })
  return res.data
}

// ─── Wipe CV data on the server ──────────────────────────
export async function clearCV() {
  const res = await api.post('/cv/clear', {}, { timeout: DEFAULT_TIMEOUT })
  return res.data
}

// ─── Stream NDJSON from /cv/structure ─────────────────────
// IMPORTANT: this uses raw fetch (not axios) because we need the raw
// response body stream. That means we don't get axios's auto-refresh
// on 401 — so we first make a lightweight axios request to warm the
// token (axios interceptor will refresh it if expired), then stream.
async function fetchStructureStream(
  rawText: string,
  force: boolean,
): Promise<Response> {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

  // ── Warm-up: force axios interceptor to refresh if token is stale ──
  // A cheap authenticated call. If the token is valid, this returns fast.
  // If expired, axios auto-refreshes and updates localStorage before we
  // proceed. If refresh fails, axios redirects to /login.
  try {
    await api.get('/cv/current', { timeout: 8000 })
  } catch {
    // Even if this call fails, we still try the streaming fetch below
    // — the token in localStorage may still be valid.
  }

  // ── Now stream with the (possibly refreshed) token ──
  const buildRequest = (token: string | null) =>
    fetch(`${baseURL}/cv/structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ cv_text: rawText, force }),
      credentials: 'include',
    })

  let token = localStorage.getItem('access_token')
  let res = await buildRequest(token)

  // ── If still 401, do a manual refresh and retry once ──
  if (res.status === 401) {
    try {
      const refreshRes = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        const newToken = refreshData?.data?.accessToken as string | undefined

        if (newToken) {
          localStorage.setItem('access_token', newToken)
          res = await buildRequest(newToken)
        }
      }
    } catch {
      /* fall through to the 401 handler */
    }

    if (res.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('safeapply-auth')
      clearUserData()
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login')
      ) {
        window.location.href = '/login'
      }
      throw new Error('Your session expired. Log in again.')
    }
  }

  return res
}

// ─── Structure raw CV text (streamed) ────────────────────
export async function structureCVStream(
  rawText: string,
  force = false,
  onProgress?: (event: StructureEvent) => void,
): Promise<StructureResponse> {
  try {
    const res = await fetchStructureStream(rawText, force)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      let errMsg = `HTTP ${res.status}`
      try {
        const parsed = JSON.parse(errText)
        if (parsed?.error) errMsg = parsed.error
      } catch {
        /* keep HTTP status */
      }
      return { success: false, error: errMsg }
    }

    if (!res.body) {
      return { success: false, error: 'Streaming not supported by browser' }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalData: StructuredCVPayload | null = null
    let errorMsg: string | null = null

    const handleLine = (line: string) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) return
      try {
        const event = JSON.parse(trimmedLine) as StructureEvent
        onProgress?.(event)

        if (event.type === 'done' || event.type === 'cached') {
          finalData = event.data
        } else if (event.type === 'error') {
          errorMsg = event.message
        }
      } catch {
        /* skip malformed line */
      }
    }

    // Read the stream line by line (NDJSON)
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let nlIndex: number
      while ((nlIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nlIndex)
        buffer = buffer.slice(nlIndex + 1)
        handleLine(line)
      }
    }

    // Flush any trailing buffered content
    if (buffer.trim()) handleLine(buffer)

    if (errorMsg) return { success: false, error: errorMsg }
    if (!finalData) return { success: false, error: 'No data returned' }

    return { success: true, data: finalData }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stream failed'
    return { success: false, error: message }
  }
}

// ─── Legacy wrapper (non-stream) — kept for compatibility ─
export async function structureCV(
  rawText: string,
  force = false,
): Promise<StructureResponse> {
  return structureCVStream(rawText, force)
}

// ─── AI bullet rewrite ───────────────────────────────────
export async function rewriteBullet(
  original_bullet: string,
  jd_context = '',
): Promise<RewriteBulletResponse> {
  const res = await api.post<RewriteBulletResponse>(
    '/cv/rewrite-bullet',
    { original_bullet, jd_context },
    { timeout: DEFAULT_TIMEOUT },
  )
  return res.data
}

// ─── AI summary generation ───────────────────────────────
export async function generateSummary(
  background_text: string,
  target_role: string,
): Promise<GenerateSummaryResponse> {
  const res = await api.post<GenerateSummaryResponse>(
    '/cv/generate-summary',
    { background_text, target_role },
    { timeout: DEFAULT_TIMEOUT },
  )
  return res.data
}

// ─── Saved CVs ───────────────────────────────────────────
export async function getSavedCVs(): Promise<SavedCVListResponse> {
  const res = await api.get<SavedCVListResponse>('/cv/saved', {
    timeout: DEFAULT_TIMEOUT,
  })
  return res.data
}

export async function saveCV(
  name: string,
  cv_data: CVData,
): Promise<SavedCVResponse> {
  const res = await api.post<SavedCVResponse>(
    '/cv/saved',
    { name, cv_data },
    { timeout: DEFAULT_TIMEOUT },
  )
  return res.data
}

export async function deleteSavedCV(id: string) {
  const res = await api.delete(`/cv/saved/${id}`, {
    timeout: DEFAULT_TIMEOUT,
  })
  return res.data
}

// ─── CV ↔ JD match result ────────────────────────────────
export interface CVMatchResult {
  match_percentage: number
  matched_skills: string[]
  missing_skills: string[]
  probably_have: string[]
  keyword_mismatches: { jd_term: string; cv_term: string }[]
  seniority_gaps: string[]
  ats_warnings: string[]
  bullet_rewrites: { original: string; suggested: string }[]
}

export interface MatchCVResponse {
  success: boolean
  data?: CVMatchResult
  error?: string
}

export async function matchCV(
  cv_text: string,
  jd_text: string,
  save_cv = false,
): Promise<MatchCVResponse> {
  const res = await api.post<MatchCVResponse>(
    '/cv/match',
    { cv_text, jd_text, save_cv },
    { timeout: 70_000 },
  )
  return res.data
}

// ─── Apply accepted rewrites locally (NO AI) ─────────────
// Fuzzy token matching: the model's "original" rarely matches the parsed
// bullet byte-for-byte (bullet symbols, wrapped lines, labels). Each
// rewrite lands on its single best-matching bullet. Labels like
// "Generative 3D Pipelines:" are kept if the rewrite dropped them.
const BULLET_PREFIX_RE = /^[\s●•▪◦‣∙·○■□➢►▸*\-–]+/
const LABEL_RE = /^([A-Z][^:]{2,48}):\s+/
const MATCH_THRESHOLD = 0.55

function normalizeBullet(text: string): string {
  return text
    .replace(BULLET_PREFIX_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(text: string): Set<string> {
  return new Set(
    normalizeBullet(text)
      .split(' ')
      .filter((w) => w.length > 2),
  )
}

function similarity(a: string, b: string): number {
  const na = normalizeBullet(a)
  const nb = normalizeBullet(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.length >= 25 && nb.length >= 25 && (na.includes(nb) || nb.includes(na))) return 0.95
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  ta.forEach((t) => {
    if (tb.has(t)) inter += 1
  })
  return inter / (ta.size + tb.size - inter)
}

function keepLabel(original: string, suggested: string): string {
  const clean = suggested.replace(BULLET_PREFIX_RE, '').trim()
  const label = original.replace(BULLET_PREFIX_RE, '').match(LABEL_RE)
  if (!label || LABEL_RE.test(clean)) return clean
  return `${label[1]}: ${clean}`
}

type RewriteSlot =
  | { kind: 'exp'; ei: number; bi: number; text: string }
  | { kind: 'proj'; pi: number; li: number; text: string }

export function applyRewritesLocally(
  cv: CVData,
  rewrites: { original: string; suggested: string }[],
): { cv: CVData; appliedCount: number } {
  const usable = rewrites.filter((r) => r.original?.trim() && r.suggested?.trim())
  if (usable.length === 0) return { cv, appliedCount: 0 }

  const slots: RewriteSlot[] = []
  cv.experience.forEach((e, ei) => e.bullets.forEach((b, bi) => slots.push({ kind: 'exp', ei, bi, text: b })))
  cv.projects.forEach((p, pi) => p.description.split('\n').forEach((l, li) => slots.push({ kind: 'proj', pi, li, text: l })))

  const taken = new Set<number>()
  const assignments = new Map<number, string>()

  for (const r of usable) {
    let best = -1
    let bestScore = MATCH_THRESHOLD
    slots.forEach((s, i) => {
      if (taken.has(i)) return
      const score = similarity(r.original, s.text)
      if (score >= bestScore) {
        best = i
        bestScore = score
      }
    })
    if (best >= 0) {
      taken.add(best)
      assignments.set(best, keepLabel(slots[best].text, r.suggested))
    }
  }

  if (assignments.size === 0) return { cv, appliedCount: 0 }

  const experience = cv.experience.map((e) => ({ ...e, bullets: [...e.bullets] }))
  const projectLines = cv.projects.map((p) => p.description.split('\n'))

  assignments.forEach((text, i) => {
    const s = slots[i]
    if (s.kind === 'exp') experience[s.ei].bullets[s.bi] = text
    else projectLines[s.pi][s.li] = text
  })

  const projects = cv.projects.map((p, pi) => ({ ...p, description: projectLines[pi].join('\n') }))

  return { cv: { ...cv, experience, projects }, appliedCount: assignments.size }
}

// ─── Payload → CVData (adds client-side IDs) ─────────────
export function payloadToCVData(payload: StructuredCVPayload): CVData {
  const mkId = (p: string) =>
    `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    personal: payload.personal,
    experience: (payload.experience || []).map((e) => ({
      ...e,
      id: mkId('exp'),
      bullets:
        Array.isArray(e.bullets) && e.bullets.length > 0 ? e.bullets : [''],
    })),
    education: (payload.education || []).map((e) => ({
      ...e,
      id: mkId('edu'),
    })),
    skills: payload.skills || [],
    projects: (payload.projects || []).map((p) => ({
      ...p,
      id: mkId('prj'),
    })),
    certifications: (payload.certifications || []).map((c) => ({
      ...c,
      id: mkId('cert'),
    })),
  }
}