// ============================================================
// FILE: packages/shared/src/index.ts
// PURPOSE: All shared TypeScript types used across frontend and backend
// ============================================================

export type UserRole = 'user' | 'admin'

export type PlanType = 'free' | 'pro' | 'lifetime'

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'ghosted'

export type ReviewRelationship =
  | 'current_employee'
  | 'former_employee'
  | 'applicant'
  | 'knows_someone'

export type SentimentLabel = 'mostly_positive' | 'mixed' | 'mostly_negative'

export type CommunicationType = 'email' | 'call' | 'interview' | 'follow_up' | 'rejection'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  plan: PlanType
  avatar_url?: string
  job_title?: string
  location?: string
  email_verified: boolean
  created_at: string
}

export interface Application {
  id: string
  user_id: string
  company_name: string
  job_title: string
  date_applied: string
  job_link?: string
  salary_min?: number
  salary_max?: number
  location?: string
  status: ApplicationStatus
  notes?: string
  jd_text?: string
  match_score?: number
  created_at: string
  updated_at: string
}

export interface ApplicationTimeline {
  id: string
  application_id: string
  status: ApplicationStatus
  changed_at: string
}

export interface CommunicationLog {
  id: string
  application_id: string
  type: CommunicationType
  notes: string
  date: string
  created_at: string
}

export interface CompanyReport {
  id: string
  user_id: string
  company_name: string
  job_title?: string
  jd_text?: string
  report_data: ReportData
  created_at: string
}

export interface ReportData {
  extracted_jd?: ExtractedJD
  crunchbase?: CrunchbaseData
  github?: GitHubData
  ghost_posting?: GhostPostingData
  news?: NewsData
  reddit?: RedditData
  glassdoor?: GlassdoorData
}

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

export interface CrunchbaseData {
  founded_on: string | null
  num_employees: string | null
  funding_stage: string | null
  total_funding_usd: number | null
  last_funding_at: string | null
  investors: string[]
  source_url: string
}

export interface GitHubData {
  org_found: boolean
  public_repos: number
  last_commit: string | null
  languages: string[]
  source_url: string
}

export interface GhostPostingData {
  postings: GhostPosting[]
  source_url: string
}

export interface GhostPosting {
  date: string
  platform: string
  url: string
}

export interface NewsData {
  articles: NewsArticle[]
  source_url: string
}

export interface NewsArticle {
  title: string
  source: string
  published_at: string
  url: string
}

export interface RedditData {
  sentiment: SentimentLabel
  total_mentions: number
  subreddits: RedditSubreddit[]
  source_url: string
}

export interface RedditSubreddit {
  name: string
  mention_count: number
  url: string
}

export interface GlassdoorData {
  overall_rating: number | null
  interview_difficulty: string | null
  offer_rate: number | null
  recommend_percent: number | null
  source_url: string
}

export interface CompanyReview {
  id: string
  company_name: string
  company_id: string
  relationship: ReviewRelationship
  role_type: string
  overall_rating: number
  culture_rating: number
  interview_rating: number
  would_recommend: 'yes' | 'no' | 'maybe'
  review_text: string
  interview_process?: string
  salary_min?: number
  salary_max?: number
  helpful_count: number
  created_at: string
}

export interface Company {
  id: string
  slug: string
  name: string
  industry?: string
  avg_overall_rating: number
  avg_culture_rating: number
  avg_interview_rating: number
  total_reviews: number
  created_at: string
}

export interface CVProfile {
  id: string
  user_id: string
  cv_text: string
  updated_at: string
}

export interface SavedCV {
  id: string
  user_id: string
  name: string
  cv_data: CVData
  created_at: string
  updated_at: string
}

export interface CVData {
  personal: CVPersonal
  experience: CVExperience[]
  education: CVEducation[]
  skills: string[]
  projects: CVProject[]
  certifications: CVCertification[]
}

export interface CVPersonal {
  full_name: string
  job_title: string
  email: string
  phone: string
  location: string
  linkedin?: string
  github?: string
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
  url?: string
  tech_stack: string[]
}

export interface CVCertification {
  id: string
  name: string
  issuer: string
  date: string
  url?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}
