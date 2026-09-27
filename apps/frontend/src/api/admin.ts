// FILE: src/api/admin.ts
// PURPOSE: Frontend API client for /api/admin/*
// BACKEND: apps/backend/src/routes/admin.ts

import api from '../lib/axios'

// ─── Types ──────────────────────────────────────────────
export interface AdminStats {
  total_users: number
  pro_users: number
  reports_today: number
  total_reviews: number
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
  users?: {
    email: string
    full_name: string
  } | null
}

export interface PaginatedUsers {
  success: boolean
  data: AdminUser[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface PaginatedReviews {
  success: boolean
  data: AdminReview[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// ─── Stats ──────────────────────────────────────────────
export async function getAdminStats() {
  const res = await api.get<{ success: boolean; data: AdminStats }>('/admin/stats')
  return res.data
}

// ─── Reviews ────────────────────────────────────────────
export async function getAdminReviews(params?: {
  status?: string
  page?: number
}) {
  const res = await api.get<PaginatedReviews>('/admin/reviews', { params })
  return res.data
}

export async function updateReviewStatus(
  id: string,
  status: 'approved' | 'flagged' | 'deleted'
) {
  const res = await api.patch(`/admin/reviews/${id}`, { status })
  return res.data
}

// ─── Users ──────────────────────────────────────────────
export async function getAdminUsers(params?: {
  search?: string
  plan?: string
  page?: number
}) {
  const res = await api.get<PaginatedUsers>('/admin/users', { params })
  return res.data
}

export async function updateAdminUser(
  id: string,
  payload: { plan?: 'free' | 'pro' | 'lifetime'; role?: 'user' | 'admin' }
) {
  const res = await api.patch(`/admin/users/${id}`, payload)
  return res.data
}