// FILE: src/api/growth.ts
// PURPOSE: Public company insight pages, share cards, live figures, report
//          sharing and disputes.

import api from '../lib/axios'
import type { CompanyReport } from './reports'
import type { SalaryPeriod } from './recruiter'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }

export interface PublicCompany {
  name: string
  slug: string
  industry: string | null
  verified: boolean
  suspended: boolean
  trust_level: number
}

export interface GhostingData {
  company: PublicCompany
  tracked: boolean
  warning?: string | null
  score?: {
    applications: number
    matured: number
    opened_pct: number | null
    replied_7d_pct: number | null
    no_response_pct: number | null
    ghost_jobs_90d: number
    closed_jobs: number
    updated_at: string
  } | null
  ghost_jobs?: { id: string; title: string; status: string; created_at: string; closed_at: string | null; apps_count: number; opened_count: number; replied_count: number }[]
  cleared_on_review?: number
  jobs_tracked?: number
}

export interface InterviewsData {
  company: PublicCompany
  interviews: {
    total: number
    modes: Record<'video' | 'phone' | 'onsite', number>
    median_duration_min: number | null
    median_days_to_interview: number | null
    held_confirmed: number
    past: number
    cancelled_by_company: number
  }
  reviews: {
    count: number
    avg_rating: number | null
    experiences: { role_type: string; text: string; rating: number; created_at: string }[]
  }
}

export interface SalariesData {
  company: PublicCompany
  posted: { id: string; title: string; salary_min: number; salary_max: number; currency: string; salary_period: SalaryPeriod; status: string; created_at: string }[]
  reported: { role: string; reports: number; median: number }[]
  withheld: number
  min_reports: number
}

export interface EmployerCard {
  company: PublicCompany
  rating: { avg: number; count: number } | null
  score: { opened_pct: number | null; replied_7d_pct: number | null; ghost_jobs_90d: number; hires_verified: number; applications: number } | null
  response_rate: number | null
  warning: string | null
}

export interface PublicStats {
  verified_companies: number
  open_jobs: number
  cvs_opened: number
  hires_confirmed: number
  contracts_completed: number
}

export const getGhosting = (slug: string) => api.get<Ok<GhostingData>>(`/public/companies/${slug}/ghosting`).then((r) => r.data)
export const getInterviewProcess = (slug: string) => api.get<Ok<InterviewsData>>(`/public/companies/${slug}/interviews`).then((r) => r.data)
export const getSalaries = (slug: string) => api.get<Ok<SalariesData>>(`/public/companies/${slug}/salaries`).then((r) => r.data)
export const getEmployerCard = (slug: string) => api.get<Ok<EmployerCard>>(`/public/employers/${slug}`).then((r) => r.data)
export const getPublicStats = () => api.get<Ok<PublicStats>>('/public/stats').then((r) => r.data)
export const getSharedReport = (shareId: string) => api.get<Ok<CompanyReport>>(`/public/reports/${shareId}`).then((r) => r.data)
export const shareReport = (id: string) => api.post<Ok<{ share_id: string }>>(`/share/reports/${id}`).then((r) => r.data)
export const unshareReport = (id: string) => api.delete<Ok<null>>(`/share/reports/${id}`).then((r) => r.data)

// ── Disputes ─────────────────────────────────────────────────
export type DisputeType = 'ghost_flag' | 'penalty' | 'trust_level' | 'other'
export const DISPUTE_LABEL: Record<DisputeType, string> = {
  ghost_flag: 'Ghost flag on a job',
  penalty: 'Company penalty',
  trust_level: 'Trust level',
  other: 'Something else',
}
export interface Dispute {
  id: string
  subject_type: DisputeType
  subject_ref: string | null
  reason: string
  evidence_url: string | null
  status: 'open' | 'accepted' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}
export interface MyDisputes {
  disputes: Dispute[]
  ghost_jobs: { id: string; title: string }[]
  company: { id: string; name: string; penalty_level: number; owner: boolean } | null
}
export interface AdminDispute extends Dispute {
  user: { full_name: string | null; email: string; role: string } | null
  company: { name: string; slug: string } | null
  job: { id: string; title: string; apps_count: number; opened_count: number; replied_count: number; status: string; created_at: string } | null
}
export const getMyDisputes = () => api.get<Ok<MyDisputes>>('/disputes').then((r) => r.data)
export const createDispute = (body: { subject_type: DisputeType; subject_ref: string | null; reason: string; evidence_url: string | null }) =>
  api.post<Ok<{ id: string }>>('/disputes', body).then((r) => r.data)
export const adminListDisputes = (status: Dispute['status'], page: number) =>
  api.get<{ success: boolean; data: AdminDispute[]; total: number; total_pages: number }>('/disputes/admin', { params: { status, page } }).then((r) => r.data)
export const adminResolveDispute = (id: string, accept: boolean, note: string) => api.patch<Ok<{ status: string }>>(`/disputes/admin/${id}`, { accept, note }).then((r) => r.data)
