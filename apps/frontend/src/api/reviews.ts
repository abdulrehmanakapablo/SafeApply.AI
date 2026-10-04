// FILE: src/api/reviews.ts
// PURPOSE: Frontend API client for /api/reviews/*

import api from '../lib/axios'

export interface CompanyListItem {
  id: string
  slug: string
  name: string
  industry: string | null
  avg_overall_rating: number
  avg_culture_rating: number
  avg_interview_rating: number
  total_reviews: number
  /** Present on the detail endpoint only. */
  verified?: boolean
  website?: string | null
  about?: string | null
  open_jobs?: { id: string; title: string; location: string | null; work_mode: string; employment_type: string }[]
  response_rate?: number | null
  response_sample?: number
  record?: import('./recruiter').HiringScore | null
  ghost_warning?: boolean
  badges?: import('./progress').EarnedBadge[]
  trust_level?: number
}

export type Relationship = 'current_employee' | 'former_employee' | 'applicant' | 'knows_someone'

export interface CompanyReview {
  id: string
  company_name: string
  relationship: Relationship
  role_type: string
  overall_rating: number
  culture_rating: number
  interview_rating: number
  would_recommend: 'yes' | 'no' | 'maybe'
  review_text: string
  interview_process?: string | null
  salary_min?: number | null
  salary_max?: number | null
  helpful_count: number
  created_at: string
  reply?: { body: string; updated_at: string } | null
}

export interface Paginated<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export async function getCompanies(params?: {
  search?: string
  min_rating?: number
  page?: number
}): Promise<Paginated<CompanyListItem>> {
  const res = await api.get<Paginated<CompanyListItem>>('/reviews/companies', { params })
  return res.data
}

export async function getCompany(slug: string): Promise<{ success: boolean; data?: CompanyListItem; error?: string }> {
  const res = await api.get(`/reviews/companies/${slug}`)
  return res.data
}

export async function getCompanyReviews(slug: string, params?: { page?: number }): Promise<Paginated<CompanyReview>> {
  const res = await api.get<Paginated<CompanyReview>>(`/reviews/companies/${slug}/reviews`, { params })
  return res.data
}

export async function submitReview(payload: {
  company_name: string
  relationship: Relationship
  role_type: string
  overall_rating: number
  culture_rating: number
  interview_rating: number
  would_recommend: 'yes' | 'no' | 'maybe'
  review_text: string
  interview_process?: string
  salary_min?: number
  salary_max?: number
}) {
  const res = await api.post('/reviews', payload)
  return res.data as { success: boolean; message?: string; error?: string }
}

export async function markReviewHelpful(reviewId: string) {
  const res = await api.post(`/reviews/${reviewId}/helpful`)
  return res.data as { success: boolean }
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  current_employee: 'Current employee',
  former_employee: 'Former employee',
  applicant: 'Interviewed here',
  knows_someone: 'Knows someone there',
}
