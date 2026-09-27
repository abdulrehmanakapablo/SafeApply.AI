// FILE: src/api/reviews.ts
// PURPOSE: Frontend API client for /api/reviews/* routes
// BACKEND: apps/backend/src/routes/reviews.ts

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
}

export interface CompanyReview {
  id: string
  company_name: string
  relationship: string
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

export interface CompaniesResponse {
  success: boolean
  data: CompanyListItem[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface CompanyDetailResponse {
  success: boolean
  data: CompanyListItem
}

export interface CompanyReviewsResponse {
  success: boolean
  data: CompanyReview[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// GET /api/reviews/companies — public, paginated list of companies
export async function getCompanies(params?: {
  search?: string
  industry?: string
  min_rating?: number
  page?: number
}): Promise<CompaniesResponse> {
  const res = await api.get<CompaniesResponse>('/reviews/companies', { params })
  return res.data
}

// GET /api/reviews/companies/:slug — public, single company detail
export async function getCompany(slug: string): Promise<CompanyDetailResponse> {
  const res = await api.get<CompanyDetailResponse>(`/reviews/companies/${slug}`)
  return res.data
}

// GET /api/reviews/companies/:slug/reviews — public, paginated reviews for a company
export async function getCompanyReviews(
  slug: string,
  params?: { tab?: 'all' | 'interview' | 'salary'; page?: number }
): Promise<CompanyReviewsResponse> {
  const res = await api.get<CompanyReviewsResponse>(
    `/reviews/companies/${slug}/reviews`,
    { params }
  )
  return res.data
}

// POST /api/reviews — auth required, submit a review
export async function submitReview(payload: {
  company_name: string
  relationship: 'current_employee' | 'former_employee' | 'applicant' | 'knows_someone'
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
  return res.data
}

// POST /api/reviews/:id/helpful — public
export async function markReviewHelpful(reviewId: string) {
  const res = await api.post(`/reviews/${reviewId}/helpful`)
  return res.data
}