// FILE: src/api/billing.ts
// PURPOSE: Plans, plan status + usage, manual local payments, admin review
//          and the spending budget.

import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { onUserCleared } from '../lib/session'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }

export type PlanKey = 'seeker' | 'freelancer' | 'client' | 'recruiter'
export type Method = 'jazzcash' | 'easypaisa' | 'bank'
export interface PlanInfo {
  name: string
  usd: number
  founding_usd: number
  pkr: number
}
export interface BillingConfig {
  plans: Record<PlanKey, PlanInfo>
  period_days: number
  free_limit: number
  free_caps: { open_jobs: number; open_projects: number; invoices: number; client_invites: number }
  founding_left: number
  card_enabled: boolean
  methods: {
    jazzcash: { number: string; name: string } | null
    easypaisa: { number: string; name: string } | null
    bank: { bank: string; title: string; iban: string } | null
  }
}
export interface UsageRow {
  key: string
  label: string
  used: number
  limit: number | null
}
export interface BillingStatus {
  role: string
  plan_key: PlanKey | null
  pro: boolean
  until: string | null
  usage: UsageRow[]
  pending: { id: string; method: Method; amount_pkr: number; created_at: string }[]
  free_ai_paused: boolean
  trust_level: number
}
export interface Payment {
  id: string
  plan_key: PlanKey
  method: Method
  transaction_id: string
  amount_pkr: number
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  period_end: string | null
  created_at: string
  reviewed_at: string | null
}
export interface AdminPayment extends Payment {
  sender_name: string
  user: { name: string; email: string } | null
}
export interface BudgetInfo {
  month: string
  spent: number
  ai_usd: number
  search_usd: number
  ai_calls: number
  searches: number
  free_usd: number
  hard_usd: number
  freePaused: boolean
  hardStopped: boolean
  history: { month: string; ai_usd: number; search_usd: number; ai_calls: number; searches: number }[]
}

export const METHOD_LABEL: Record<Method, string> = { jazzcash: 'JazzCash', easypaisa: 'Easypaisa', bank: 'Bank transfer' }
export const PLAN_ROLE: Record<PlanKey, string> = { seeker: 'user', freelancer: 'freelancer', client: 'client', recruiter: 'recruiter' }

let configCache: Promise<BillingConfig> | null = null
export function getBillingConfig(): Promise<BillingConfig> {
  configCache ??= api
    .get<Ok<BillingConfig>>('/billing/config')
    .then((r) => r.data.data)
    .catch((e) => {
      configCache = null
      throw e
    })
  return configCache
}
export const getBillingStatus = async () => (await api.get<Ok<BillingStatus>>('/billing/status')).data
export const getPayments = async () => (await api.get<Ok<Payment[]>>('/billing/history')).data
export const submitManualPayment = async (p: { method: Method; transaction_id: string; sender_name: string; amount_pkr: number }) => (await api.post<Ok<Payment>>('/billing/manual', p)).data

export const adminListPayments = async (params: { status?: string; page?: number }) =>
  (await api.get<{ success: boolean; data: AdminPayment[]; total: number; total_pages: number }>('/billing/admin/payments', { params })).data
export const adminReviewPayment = async (id: string, action: 'approve' | 'reject', note: string) =>
  (await api.patch<Ok<{ id: string; status: string; until?: string }>>(`/billing/admin/payments/${id}`, { action, note })).data
export const adminGetBudget = async () => (await api.get<Ok<BudgetInfo>>('/billing/admin/budget')).data
export const adminSetBudget = async (free_usd: number, hard_usd: number) => (await api.put<Ok<BudgetInfo>>('/billing/admin/budget', { free_usd, hard_usd })).data

/** Shared plan status with a short cache, so the sidebar and pages don't refetch. */
let statusCache: { at: number; p: Promise<BillingStatus> } | null = null
export function invalidateBillingStatus() {
  statusCache = null
}
// Plan and usage belong to one account: drop them on logout or account switch.
onUserCleared(invalidateBillingStatus)
export function useBillingStatus(enabled = true): BillingStatus | null {
  const [s, setS] = useState<BillingStatus | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    if (!statusCache || Date.now() - statusCache.at > 60_000) {
      statusCache = { at: Date.now(), p: getBillingStatus().then((r) => r.data) }
      statusCache.p.catch(() => (statusCache = null))
    }
    statusCache.p.then((d) => !cancelled && setS(d)).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled])
  return s
}

export const pkr = (n: number) => `PKR ${n.toLocaleString('en-PK')}`
export const usd = (n: number) => `$${n}`
