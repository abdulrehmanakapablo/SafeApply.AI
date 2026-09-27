// FILE: src/api/cv.ts
// PURPOSE: Frontend API client for /api/cv/*
// BACKEND: apps/backend/src/routes/cv.ts

import api from '../lib/axios'

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
  data?: { text: string; word_count: number; file_name: string }
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

// ─── CV upload (PDF/DOCX parse) ──────────────────────────
export async function uploadCV(
  file: File,
  saveToProfile = false
): Promise<UploadResponse> {
  const form = new FormData()
  form.append('cv', file)
  form.append('save_cv', String(saveToProfile))

  const res = await api.post<UploadResponse>('/cv/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ─── AI bullet rewrite ───────────────────────────────────
export async function rewriteBullet(
  original_bullet: string,
  jd_context = ''
): Promise<RewriteBulletResponse> {
  const res = await api.post<RewriteBulletResponse>('/cv/rewrite-bullet', {
    original_bullet,
    jd_context,
  })
  return res.data
}

// ─── AI summary generation ───────────────────────────────
export async function generateSummary(
  background_text: string,
  target_role: string
): Promise<GenerateSummaryResponse> {
  const res = await api.post<GenerateSummaryResponse>('/cv/generate-summary', {
    background_text,
    target_role,
  })
  return res.data
}

// ─── Saved CVs ───────────────────────────────────────────
export async function getSavedCVs(): Promise<SavedCVListResponse> {
  const res = await api.get<SavedCVListResponse>('/cv/saved')
  return res.data
}

export async function saveCV(
  name: string,
  cv_data: CVData
): Promise<SavedCVResponse> {
  const res = await api.post<SavedCVResponse>('/cv/saved', { name, cv_data })
  return res.data
}

export async function deleteSavedCV(id: string) {
  const res = await api.delete(`/cv/saved/${id}`)
  return res.data
}

// ─── CV ↔ JD match result (from Groq via backend) ────────
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

// POST /api/cv/match — compare CV vs JD, return AI analysis
export async function matchCV(
  cv_text: string,
  jd_text: string,
  save_cv = false
): Promise<MatchCVResponse> {
  const res = await api.post<MatchCVResponse>('/cv/match', {
    cv_text,
    jd_text,
    save_cv,
  })
  return res.data
}