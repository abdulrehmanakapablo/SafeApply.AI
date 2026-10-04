// ============================================================
// FILE: apps/backend/src/utils/plans.ts
// PURPOSE: Plan catalogue + "is this account on Pro right now".
//          Prices here are the source of truth; the frontend reads them
//          from GET /api/billing/config.
// ============================================================

import { supabaseAdmin } from '../config/supabase'

export type PlanKey = 'seeker' | 'freelancer' | 'client' | 'recruiter'

export const PLANS: Record<PlanKey, { name: string; usd: number; founding_usd: number; pkr: number }> = {
  seeker: { name: 'Job seeker Pro', usd: 15, founding_usd: 10, pkr: 499 },
  freelancer: { name: 'Freelancer Pro', usd: 15, founding_usd: 10, pkr: 499 },
  client: { name: 'Client Pro', usd: 15, founding_usd: 10, pkr: 799 },
  recruiter: { name: 'Recruiter', usd: 30, founding_usd: 20, pkr: 1499 },
}
export const FOUNDING_SEATS = 500
export const PERIOD_DAYS = 30

const ROLE_PLAN: Record<string, PlanKey> = { user: 'seeker', freelancer: 'freelancer', client: 'client', recruiter: 'recruiter' }
export const planKeyForRole = (role: string | null | undefined): PlanKey | null => ROLE_PLAN[role || ''] ?? null

/** Free-tier caps per plan side. Admins and Pro accounts are unlimited. */
export const FREE_CAPS = {
  open_jobs: 3,
  open_projects: 3,
  invoices: 3,
  client_invites: 3,
  team_seats: 2,
  talent_invites: 3,
} as const
/** Sanity ceilings even on Pro (abuse protection, not a paywall). */
export const PRO_CEILING = { open_jobs: 100, open_projects: 100, team_seats: 15, talent_invites: 200 } as const

export function isActive(until: string | null | undefined): boolean {
  return Boolean(until && new Date(until).getTime() > Date.now())
}

/** Pro for seekers / freelancers / clients lives on the user row. */
export function userIsPro(u: { plan?: string | null; plan_expires_at?: string | null; role?: string | null }): boolean {
  if (u.role === 'admin' || u.plan === 'lifetime') return true
  return u.plan === 'pro' && isActive(u.plan_expires_at)
}

export async function loadUserPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('users').select('plan, plan_expires_at, role').eq('id', userId).maybeSingle()
  return data ? userIsPro(data) : false
}
