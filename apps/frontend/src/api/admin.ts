// FILE: src/api/admin.ts
// PURPOSE: Frontend API client for /api/admin/*

import api from '../lib/axios'

export interface AdminStats {
  total_users: number
  pro_users: number
  reports_today: number
  total_reviews: number
  pending_reviews?: number
  signups_7d?: number
}

export interface AdminUser {
  id: string
  email: string
  full_name: string
  plan: 'free' | 'pro' | 'lifetime'
  role: 'user' | 'admin'
  created_at: string
}

export interface AdminReview {
  id: string
  company_name: string
  role_type: string
  overall_rating: number
  review_text: string
  moderation_status: 'pending' | 'approved' | 'flagged' | 'deleted'
  created_at: string
  reviewer_id: string | null
  users?: { email: string; full_name: string } | null
}

export interface Paginated<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export async function getAdminStats() {
  const res = await api.get<{ success: boolean; data: AdminStats }>('/admin/stats')
  return res.data
}

export async function getAdminReviews(params?: { status?: string; page?: number }) {
  const res = await api.get<Paginated<AdminReview>>('/admin/reviews', { params })
  return res.data
}

export async function updateReviewStatus(id: string, status: 'approved' | 'flagged' | 'deleted') {
  const res = await api.patch(`/admin/reviews/${id}`, { status })
  return res.data as { success: boolean; error?: string }
}

export async function getAdminUsers(params?: { search?: string; plan?: string; page?: number }) {
  const res = await api.get<Paginated<AdminUser>>('/admin/users', { params })
  return res.data
}

export async function updateAdminUser(
  id: string,
  payload: { plan?: 'free' | 'pro' | 'lifetime'; role?: 'user' | 'admin' },
) {
  const res = await api.patch(`/admin/users/${id}`, payload)
  return res.data as { success: boolean; error?: string }
}

export interface AdminCompany {
  id: string
  name: string
  slug: string
  website: string | null
  domain: string | null
  domain_match: boolean
  industry: string | null
  size: string | null
  locations: string | null
  about: string | null
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
  verification_note: string | null
  verified_at: string | null
  updated_at: string
  members: { email: string; full_name: string }[]
  penalty_level: number
  penalty_source: 'auto' | 'admin' | null
  penalty_reason: string | null
  suspended: boolean
  company_scores: { applications: number; opened_pct: number | null; replied_7d_pct: number | null; ghost_jobs_90d: number } | { applications: number; opened_pct: number | null; replied_7d_pct: number | null; ghost_jobs_90d: number }[] | null
}

/** level null hands the company back to the automatic ghosting rules. */
export async function setCompanyPenalty(id: string, level: number | null, reason: string) {
  const res = await api.patch(`/admin/companies/${id}/penalty`, { level, reason })
  return res.data as { success: boolean; error?: string }
}

export async function getAdminCompanies(params?: { status?: string; page?: number }) {
  const res = await api.get<Paginated<AdminCompany>>('/admin/companies', { params })
  return res.data
}

export async function setCompanyVerification(id: string, status: 'verified' | 'rejected', note?: string) {
  const res = await api.patch(`/admin/companies/${id}`, { status, note: note || '' })
  return res.data as { success: boolean; error?: string }
}
