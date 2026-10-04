// FILE: src/api/reports.ts
// PURPOSE: Frontend API client for /api/reports/*

import api from '../lib/axios'

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

export interface GitHubData {
  org_found: boolean
  public_repos: number
  last_commit: string | null
  languages: string[]
  source_url: string
}

export interface GhostPosting {
  date: string
  platform: string
  url: string
}

export interface GhostPostingData {
  postings: GhostPosting[]
  source_url: string
}

export interface ReportData {
  extracted_jd?: ExtractedJD | null
  news?: NewsData
  github?: GitHubData
  ghost_posting?: GhostPostingData
}

export interface CompanyReport {
  id: string | null
  company_name: string
  job_title: string | null
  report_data: ReportData
  created_at: string
}

export interface ReportListItem {
  id: string
  company_name: string
  job_title: string | null
  created_at: string
}

export interface ReportResponse {
  success: boolean
  data?: CompanyReport
  error?: string
}

export interface ReportListResponse {
  success: boolean
  data: ReportListItem[]
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

export async function runReport(payload: RunReportPayload): Promise<ReportResponse> {
  const res = await api.post<ReportResponse>('/reports', payload, { timeout: 60_000 })
  return res.data
}

export async function getReportHistory(params?: { page?: number }): Promise<ReportListResponse> {
  const res = await api.get<ReportListResponse>('/reports/history', { params })
  return res.data
}

export async function getReport(id: string): Promise<ReportResponse> {
  const res = await api.get<ReportResponse>(`/reports/${id}`)
  return res.data
}

export async function deleteReport(id: string) {
  const res = await api.delete(`/reports/${id}`)
  return res.data as { success: boolean; error?: string }
}

/** Anonymous landing-page demo. One per IP per day in production. */
export async function demoExtract(jd_text: string) {
  const res = await api.post<{ success: boolean; data?: { extracted_jd: ExtractedJD }; error?: string; code?: string }>(
    '/reports/demo-extract',
    { jd_text },
    { timeout: 45_000 },
  )
  return res.data
}
