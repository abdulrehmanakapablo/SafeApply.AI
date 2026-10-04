// FILE: src/api/recruiter.ts
// PURPOSE: Recruiter portal + public jobs + messages + notifications clients.

import api from '../lib/axios'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
export type WorkMode = 'onsite' | 'hybrid' | 'remote'
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship'
export type JobStatus = 'draft' | 'open' | 'paused' | 'closed'
export type Stage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type SalaryPeriod = 'year' | 'month' | 'hour'

export interface Company {
  id: string
  slug: string
  name: string
  industry: string | null
  website: string | null
  domain: string | null
  about: string | null
  size: string | null
  locations: string | null
  verification_status: VerificationStatus
  verification_note: string | null
  domain_match: boolean
  verified_at: string | null
  member_role?: 'owner' | 'recruiter'
}

export interface CompanyInput {
  name: string
  website: string
  industry: string
  size: string
  locations: string
  about: string
}

export interface JobInput {
  title: string
  description: string
  location: string
  work_mode: WorkMode
  employment_type: EmploymentType
  salary_min: number
  salary_max: number
  currency: string
  salary_period: SalaryPeriod
  status: JobStatus
}

export interface Job extends JobInput {
  id: string
  last_activity_at: string
  created_at: string
  updated_at: string
  applicants?: number
  new_applicants?: number
  outcome?: JobOutcome | null
  outcome_note?: string | null
  closed_at?: string | null
  ghost_flag?: boolean
  apps_count?: number
  opened_count?: number
  replied_count?: number
}
export type JobOutcome = 'hired_here' | 'hired_elsewhere' | 'not_hired' | 'cancelled'
export const OUTCOME_LABEL: Record<JobOutcome, string> = { hired_here: 'Hired through SafeApply', hired_elsewhere: 'Hired elsewhere', not_hired: 'Closed without a hire', cancelled: 'Cancelled' }

/** Public Hiring Record numbers (null = too few applications to show). */
export interface HiringScore {
  applications: number
  opened_pct: number | null
  replied_7d_pct: number | null
  no_response_pct: number | null
  ghost_jobs_90d: number
  hires_here: number
  hires_verified: number
  interviews_confirmed: number
}

export interface PipelineApp {
  id: string
  candidate_name: string
  match_score: number | null
  stage: Stage
  stage_changed_at: string
  first_response_at: string | null
  cv_opened_at: string | null
  no_response: boolean
  created_at: string
}

export interface Applicant {
  id: string
  job_id: string
  cv_text: string
  cover_note: string
  match_score: number | null
  stage: Stage
  created_at: string
  first_response_at: string | null
  cv_opened_at: string | null
  no_response: boolean
  job: { id: string; title: string }
  candidate: { full_name: string; email: string; location: string; job_title: string }
  events: { stage: Stage; created_at: string }[]
}

export interface RecruiterStats {
  open_jobs: number
  total_jobs: number
  applicants: number
  new_applicants: number
  overdue: number
  hired: number
  response_rate: number | null
  response_sample: number
  verification_status: VerificationStatus
}

export interface CompanyReviewItem {
  id: string
  relationship: string
  role_type: string
  overall_rating: number
  culture_rating: number
  interview_rating: number
  would_recommend: 'yes' | 'no' | 'maybe'
  review_text: string
  interview_process: string | null
  created_at: string
  reply: { body: string; updated_at: string } | null
}

// ── Recruiter ───────────────────────────────────────────
export const getMyCompany = () => api.get<Ok<Company | null>>('/recruiter/company').then((r) => r.data)
export const saveMyCompany = (body: CompanyInput) => api.put<Ok<Company>>('/recruiter/company', body).then((r) => r.data)
export const getRecruiterStats = () => api.get<Ok<RecruiterStats>>('/recruiter/stats').then((r) => r.data)
export const listMyJobs = () => api.get<Ok<Job[]>>('/recruiter/jobs').then((r) => r.data)
export const createJob = (body: JobInput) => api.post<Ok<Job>>('/recruiter/jobs', body).then((r) => r.data)
export const getMyJob = (id: string) => api.get<Ok<Job & { applications: PipelineApp[] }>>(`/recruiter/jobs/${id}`).then((r) => r.data)
export const updateJob = (id: string, body: Partial<JobInput>) => api.patch<Ok<Job>>(`/recruiter/jobs/${id}`, body).then((r) => r.data)
export const closeJob = (id: string, body: { outcome: JobOutcome; note: string; hired_application_id?: string }) =>
  api.post<Ok<{ closed: boolean; answered: number }>>(`/recruiter/jobs/${id}/close`, body).then((r) => r.data)
export const getApplicant = (id: string) => api.get<Ok<Applicant>>(`/recruiter/applicants/${id}`).then((r) => r.data)
export const setApplicantStage = (id: string, stage: Stage) => api.patch<Ok<{ stage: Stage }>>(`/recruiter/applicants/${id}/stage`, { stage }).then((r) => r.data)
export const listCompanyReviews = () => api.get<Ok<CompanyReviewItem[]>>('/recruiter/reviews').then((r) => r.data)
export const replyToReview = (id: string, body: string) => api.put<Ok<{ body: string }>>(`/recruiter/reviews/${id}/reply`, { body }).then((r) => r.data)

// ── Public jobs ─────────────────────────────────────────
export interface PublicJob {
  id: string
  title: string
  location: string
  work_mode: WorkMode
  employment_type: EmploymentType
  salary_min: number
  salary_max: number
  currency: string
  salary_period: SalaryPeriod
  last_activity_at: string
  created_at: string
  ghost_flag: boolean
  company: { name: string; slug: string }
  record: { opened_pct: number | null; replied_7d_pct: number | null }
}

export interface PublicJobDetail extends Omit<PublicJob, 'company' | 'record'> {
  apps_count: number
  opened_count: number
  outcome: JobOutcome | null
  record: HiringScore | null
  description: string
  status: JobStatus
  live: boolean
  company: {
    name: string
    slug: string
    website: string | null
    about: string | null
    size: string | null
    locations: string | null
    industry: string | null
    avg_overall_rating: number
    total_reviews: number
    penalty_level: number
  }
  response_rate: number | null
  response_sample: number
  applied: { id: string; stage: Stage } | null
}

export interface Paged<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  total_pages: number
}

export const listJobs = (params: { q?: string; location?: string; work_mode?: string; employment_type?: string; page?: number }) =>
  api.get<Paged<PublicJob>>('/jobs', { params }).then((r) => r.data)
export const getJob = (id: string) => api.get<Ok<PublicJobDetail>>(`/jobs/${id}`).then((r) => r.data)

export interface MyJobApplication {
  id: string
  stage: Stage
  created_at: string
  cv_opened_at: string | null
  first_response_at: string | null
  no_response: boolean
  cover_note: string
  hire_confirmed: boolean | null
  job: { id: string; title: string; status: JobStatus; outcome: JobOutcome | null; closed_at: string | null; company: { name: string; slug: string } }
  events: { stage: Stage; created_at: string }[]
}
export const getMyJobApplication = (id: string) => api.get<Ok<MyJobApplication>>(`/jobs/applications/${id}`).then((r) => r.data)

export interface CompanyRecord {
  company: { name: string; slug: string; verified_at: string | null; suspended: boolean }
  warning: string | null
  score: (HiringScore & { matured: number; closed_jobs: number; updated_at: string }) | null
  jobs: { id: string; title: string; status: JobStatus; created_at: string; closed_at: string | null; outcome: JobOutcome | null; apps_count: number; opened_count: number; replied_count: number; ghost_flag: boolean }[]
}
export const getCompanyRecord = (slug: string) => api.get<Ok<CompanyRecord>>(`/records/companies/${slug}`).then((r) => r.data)
export const applyToJob = (id: string, body: { cv_text: string; cover_note: string }) =>
  api.post<Ok<{ id: string; stage: Stage; tracker_id: string | null }>>(`/jobs/${id}/apply`, body).then((r) => r.data)

// ── Messages ────────────────────────────────────────────
export interface ThreadSummary {
  application_id: string
  stage: Stage
  job_title: string
  counterpart: string
  last_message: { body: string; sender_side: 'candidate' | 'company'; created_at: string } | null
}
export interface Message {
  id: string
  sender_side: 'candidate' | 'company'
  body: string
  created_at: string
}
export interface Thread {
  application_id: string
  side: 'candidate' | 'company'
  stage: Stage
  job_title: string
  job_id: string
  counterpart: string
  messages: Message[]
}
export const listThreads = () => api.get<Ok<ThreadSummary[]>>('/messages').then((r) => r.data)
export const getThread = (applicationId: string) => api.get<Ok<Thread>>(`/messages/${applicationId}`).then((r) => r.data)
export const sendMessage = (applicationId: string, body: string) => api.post<Ok<Message>>(`/messages/${applicationId}`, { body }).then((r) => r.data)

// ── Notifications ───────────────────────────────────────
export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  link: string
  read_at: string | null
  created_at: string
}
export const listNotifications = () => api.get<Ok<{ items: AppNotification[]; unread: number }>>('/notifications').then((r) => r.data)
export const markNotificationsRead = (body: { ids?: string[]; all?: boolean }) => api.post<Ok<null>>('/notifications/read', body).then((r) => r.data)

// ── Labels ──────────────────────────────────────────────
export const STAGE_ORDER: Stage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']
export const STAGE_LABEL: Record<Stage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Not selected',
}
export const WORK_MODE_LABEL: Record<WorkMode, string> = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' }
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
}

export function formatSalary(min: number, max: number, currency: string, period: SalaryPeriod): string {
  const f = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0, notation: n >= 100000 ? 'compact' : 'standard' }).format(n)
    } catch {
      return `${currency} ${n.toLocaleString()}`
    }
  }
  const per = period === 'year' ? '/yr' : period === 'month' ? '/mo' : '/hr'
  return min === max ? `${f(min)}${per}` : `${f(min)} to ${f(max)}${per}`
}
