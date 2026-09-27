// FILE: src/api/reports.ts
// PURPOSE: Frontend API client for /api/reports/*
// BACKEND: apps/backend/src/routes/reports.ts

import api from '../lib/axios'

// ─── Extracted JD ─────────────────────────────────────────
export interface ExtractedJD {
  role: string | null
  seniority: string | null
  experience_years: number | null
  required_skills: string[]
  nice_to_have_skills: string[]
  salary_mentioned: boolean
  salary_text: string | null
  location: string | null
  remote: boolean | null
  employment_type: string | null
  company_name: string | null
}

// ─── News ────────────────────────────────────────────────
export interface NewsArticle {
  title: string
  source: string
  published_at: string
  url: string
}

export interface NewsData {
  articles: NewsArticle[]
  source_url: string
}

// ─── GitHub ──────────────────────────────────────────────
export interface GitHubData {
  org_found: boolean
  public_repos: number
  last_commit: string | null
  languages: string[]
  source_url: string
}

// ─── Ghost posting ───────────────────────────────────────
export interface GhostPosting {
  date: string
  platform: string
  url: string
}

export interface GhostPostingData {
  postings: GhostPosting[]
  source_url: string
}

// ─── Glassdoor ───────────────────────────────────────────
export interface GlassdoorData {
  overall_rating: number | null
  interview_difficulty: string | null
  offer_rate: number | null
  recommend_percent: number | null
  source_url: string
}

// ─── Full report ─────────────────────────────────────────
export interface ReportData {
  extracted_jd?: ExtractedJD | null
  news?: NewsData
  github?: GitHubData
  ghost_posting?: GhostPostingData
  glassdoor?: GlassdoorData | null
}

export interface CompanyReport {
  id: string
  company_name: string
  job_title: string | null
  report_data: ReportData
  created_at: string
}

export interface ReportResponse {
  success: boolean
  data?: CompanyReport
  error?: string
}

export interface ReportListResponse {
  success: boolean
  data: CompanyReport[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface RunReportPayload {
  jd_text?: string
  company_name?: string
  job_title?: string
}

// POST /api/reports — run a new report
export async function runReport(
  payload: RunReportPayload
): Promise<ReportResponse> {
  const res = await api.post<ReportResponse>('/reports', payload)
  return res.data
}

// GET /api/reports/history
export async function getReportHistory(params?: {
  page?: number
}): Promise<ReportListResponse> {
  const res = await api.get<ReportListResponse>('/reports/history', { params })
  return res.data
}

// GET /api/reports/:id
export async function getReport(id: string): Promise<ReportResponse> {
  const res = await api.get<ReportResponse>(`/reports/${id}`)
  return res.data
}

// DELETE /api/reports/:id
export async function deleteReport(id: string) {
  const res = await api.delete(`/reports/${id}`)
  return res.data
}