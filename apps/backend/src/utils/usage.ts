// ============================================================
// FILE: apps/backend/src/utils/usage.ts
// PURPOSE: Free-tier caps for job-seeker tools (3 each, lifetime) and the
//          AI budget guard. Pro (active) and admins are unlimited and never
//          paused by the free budget.
// ============================================================

import type { Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError } from './response'
import { budgetState } from './budget'
import { userIsPro } from './plans'

export const FREE_LIMIT = 3
export const FREE_LIMIT_CODE = 'FREE_LIMIT_REACHED'
export const BUDGET_CODE = 'BUDGET_PAUSED'

export type UsageFeature = 'reports' | 'cv_matches' | 'applications' | 'reviews'

const SOURCE: Record<UsageFeature, { table: string; col: string; ai: boolean }> = {
  reports: { table: 'reports', col: 'user_id', ai: true },
  cv_matches: { table: 'cv_matches', col: 'user_id', ai: true },
  applications: { table: 'applications', col: 'user_id', ai: false },
  reviews: { table: 'reviews', col: 'reviewer_id', ai: false },
}

export interface LimitCheckResult {
  allowed: boolean
  used: number
  limit: number | null
  plan: string
  isAdmin: boolean
  pro: boolean
  /** Free AI is paused for the month (budget reached). */
  budgetPaused: boolean
}

export async function countUsage(userId: string, feature: UsageFeature): Promise<number> {
  const { table, col } = SOURCE[feature]
  let q = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq(col, userId)
  // Applications sent through the SafeApply job board don't use the manual tracker allowance.
  if (feature === 'applications') q = q.is('job_application_id', null)
  const { count } = await q
  return count || 0
}

export async function checkFreeLimit(userId: string, feature: UsageFeature): Promise<LimitCheckResult> {
  const { data: u } = await supabaseAdmin.from('users').select('plan, plan_expires_at, role').eq('id', userId).single()
  const plan = u?.plan || 'free'
  const isAdmin = u?.role === 'admin'
  const pro = u ? userIsPro(u) : false
  const budget = SOURCE[feature].ai ? await budgetState() : null

  // Pocket protection applies to everyone.
  if (budget?.hardStopped) return { allowed: false, used: 0, limit: null, plan, isAdmin, pro, budgetPaused: true }
  if (pro) return { allowed: true, used: 0, limit: null, plan, isAdmin, pro, budgetPaused: false }
  if (budget?.freePaused) return { allowed: false, used: 0, limit: FREE_LIMIT, plan, isAdmin, pro, budgetPaused: true }

  const used = await countUsage(userId, feature)
  return { allowed: used < FREE_LIMIT, used, limit: FREE_LIMIT, plan, isAdmin, pro, budgetPaused: false }
}

const LABEL: Record<UsageFeature, string> = { reports: 'company reports', cv_matches: 'CV matches', applications: 'tracked applications', reviews: 'reviews' }

/** One consistent response for "blocked by plan or budget". */
export function sendLimitError(res: Response, r: LimitCheckResult, feature: UsageFeature): void {
  if (r.budgetPaused) {
    return sendError(
      res,
      r.pro ? 'AI checks are busy right now. Try again later.' : 'Free AI checks are paused until next month. Pro keeps working.',
      503,
      BUDGET_CODE,
    )
  }
  sendError(res, `You’ve used all ${r.limit} free ${LABEL[feature]}. Upgrade to Pro for unlimited.`, 403, FREE_LIMIT_CODE)
}
