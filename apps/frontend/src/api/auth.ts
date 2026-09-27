// FILE: src/api/auth.ts
// PURPOSE: All auth-related API calls.

import api from '../lib/axios'

// ─── Signup ──────────────────────────────────────────────
export interface SignupPayload {
  full_name: string
  email: string
  phone?: string
  password: string
  confirm_password: string
}

export async function signup(payload: SignupPayload) {
  const res = await api.post('/auth/signup', payload)
  return res.data
}

// ─── Login ───────────────────────────────────────────────
export interface LoginPayload {
  email: string
  password: string
}

export async function login(payload: LoginPayload) {
  const res = await api.post('/auth/login', payload)
  return res.data
}

// ─── Logout ──────────────────────────────────────────────
export async function logout() {
  const res = await api.post('/auth/logout')
  return res.data
}

// ─── Get current user ────────────────────────────────────
export async function getMe() {
  const res = await api.get('/auth/me')
  return res.data
}

// ─── Refresh access token ────────────────────────────────
export async function refreshToken() {
  const res = await api.post('/auth/refresh')
  return res.data
}

// ─── Forgot password ─────────────────────────────────────
export async function forgotPassword(email: string) {
  const res = await api.post('/auth/forgot-password', { email })
  return res.data
}

// ─── Reset password ──────────────────────────────────────
export async function resetPassword(
  token: string,
  new_password: string,
  confirm_password: string
) {
  const res = await api.post('/auth/reset-password', {
    token,
    new_password,
    confirm_password,
  })
  return res.data
}

// ─── Update profile (name, title, location, bio, avatar) ─
export async function updateMe(payload: {
  full_name: string
  job_title?: string
  location?: string
  bio?: string
  avatar_url?: string
}) {
  const res = await api.patch('/auth/me', payload)
  return res.data
}

// ─── Change password ─────────────────────────────────────
export async function changePassword(payload: {
  current_password: string
  new_password: string
  confirm_new_password: string
}) {
  const res = await api.post('/auth/change-password', payload)
  return res.data
}

// ─── Update notification preferences ─────────────────────
export async function updateNotifications(payload: {
  weekly_summary: boolean
  product_updates: boolean
  saved_company_reviews: boolean
}) {
  const res = await api.patch('/auth/notifications', payload)
  return res.data
}

// ─── Delete account ──────────────────────────────────────
export async function deleteAccount(confirm: 'DELETE') {
  const res = await api.delete('/auth/me', { data: { confirm } })
  return res.data
}