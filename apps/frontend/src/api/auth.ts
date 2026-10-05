// FILE: src/api/auth.ts
// PURPOSE: All auth-related API calls.

import api from '../lib/axios'
import type { User } from '../store/authStore'

export interface SignupPayload {
  full_name: string
  email: string
  phone?: string
  password: string
  confirm_password: string
  role?: 'user' | 'recruiter' | 'freelancer' | 'client'
}

export async function signup(payload: SignupPayload) {
  const res = await api.post('/auth/signup', payload)
  return res.data as { success: boolean; message?: string; error?: string }
}

export interface LoginPayload {
  email: string
  password: string
}

export async function login(payload: LoginPayload) {
  const res = await api.post('/auth/login', payload)
  return res.data as { success: boolean; data?: { user: User; accessToken: string }; error?: string }
}

export async function logout() {
  const res = await api.post('/auth/logout')
  return res.data
}

export async function getMe() {
  const res = await api.get('/auth/me')
  return res.data as { success: boolean; data?: User; error?: string }
}

export async function refreshToken() {
  const res = await api.post('/auth/refresh')
  return res.data
}

export async function forgotPassword(email: string) {
  const res = await api.post('/auth/forgot-password', { email })
  return res.data as { success: boolean; error?: string }
}

export async function resetPassword(token: string, new_password: string, confirm_password: string) {
  const res = await api.post('/auth/reset-password', { token, new_password, confirm_password })
  return res.data as { success: boolean; error?: string }
}

export async function updateMe(payload: {
  full_name: string
  job_title?: string
  location?: string
  bio?: string
  avatar_url?: string
}) {
  const res = await api.patch('/auth/me', payload)
  return res.data as { success: boolean; data?: User; error?: string }
}

export async function changePassword(payload: {
  current_password: string
  new_password: string
  confirm_new_password: string
}) {
  const res = await api.post('/auth/change-password', payload)
  return res.data as { success: boolean; error?: string }
}

export async function updateNotifications(payload: {
  weekly_summary: boolean
  product_updates: boolean
  saved_company_reviews: boolean
}) {
  const res = await api.patch('/auth/notifications', payload)
  return res.data as { success: boolean; data?: User['notification_prefs']; error?: string }
}

export async function deleteAccount(confirm: 'DELETE', password: string) {
  const res = await api.delete('/auth/me', { data: { confirm, password } })
  return res.data as { success: boolean; error?: string }
}
