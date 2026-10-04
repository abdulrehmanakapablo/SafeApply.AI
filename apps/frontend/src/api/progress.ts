// FILE: src/api/progress.ts
import api from '../lib/axios'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }
export interface Progress {
  role: string
  trust_level: number
  stats: { label: string; value: number }[]
  activity: string
  weeks: number[]
  streak: number
}
export interface EarnedBadge {
  badge_key: string
  earned_at: string
}
export interface BoardRow {
  board: string
  rank: number
  value: number
  sample: number
  company: { name: string; slug: string; trust_level: number }
}
export interface Leaderboards {
  month: string
  live: boolean
  months: string[]
  responsive: BoardRow[]
  verified_hires: BoardRow[]
}
export interface TrustRow {
  id: string
  name?: string
  full_name?: string
  email?: string
  role?: string
  slug?: string
  trust_level: number
  trust_override: number | null
  penalty_level?: number
}

export const getProgress = async () => (await api.get<Ok<Progress>>('/progress/me')).data
export const getMyBadges = async () => (await api.get<Ok<{ user: EarnedBadge[]; company: EarnedBadge[]; company_name: string | null }>>('/progress/badges')).data
export const getLeaderboards = async (month?: string) => (await api.get<Ok<Leaderboards>>('/progress/leaderboards', { params: month ? { month } : {} })).data
export const adminTrustList = async (params: { type: 'user' | 'company'; q?: string; page?: number }) =>
  (await api.get<{ success: boolean; data: TrustRow[]; total_pages: number }>('/progress/admin/trust', { params })).data
export const adminTrustAudit = async () =>
  (await api.get<Ok<{ id: string; subject_type: string; subject_id: string; old_override: number | null; new_override: number | null; reason: string; created_at: string }[]>>('/progress/admin/trust/audit')).data
export const adminSetTrust = async (type: 'user' | 'company', id: string, override: number | null, reason: string) => (await api.patch<Ok<unknown>>(`/progress/admin/trust/${type}/${id}`, { override, reason })).data
