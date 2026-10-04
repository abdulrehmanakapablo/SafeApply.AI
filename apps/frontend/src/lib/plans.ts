// FILE: src/lib/plans.ts
// PURPOSE: Plan copy shown in the UI. Prices and limits come from the
//          backend (GET /api/billing/config); these are the feature lists.

import type { PlanKey } from '../api/billing'

/** Without an account: one free job-post check per device/IP. */
export const GUEST_LIMIT = 1
/** Free account: this many of each limited tool, for the life of the account. */
export const FREE_LIMIT = 3

export const AUDIENCES: { key: PlanKey; label: string; signup: string }[] = [
  { key: 'seeker', label: 'Job seekers', signup: '/signup' },
  { key: 'recruiter', label: 'Recruiters', signup: '/signup?role=recruiter' },
  { key: 'freelancer', label: 'Freelancers', signup: '/signup?role=freelancer' },
  { key: 'client', label: 'Clients', signup: '/signup?role=client' },
]

export const PLAN_FEATURES: Record<PlanKey, { free: string[]; pro: string[] }> = {
  seeker: {
    free: ['Unlimited applying on the jobs board', `${FREE_LIMIT} company reports`, `${FREE_LIMIT} CV matches`, `${FREE_LIMIT} tracked outside applications`, 'Read receipts on every application', 'Unlimited reviews'],
    pro: ['Unlimited company reports', 'Unlimited CV matches', 'Unlimited tracker', 'Private search stats', 'Never paused by the free AI budget'],
  },
  recruiter: {
    free: [`${FREE_LIMIT} open jobs`, '2 team seats', `Talent search with ${FREE_LIMIT} invites a month`, 'Pipeline, notes, analytics', 'Hiring record and website badge'],
    pro: ['Up to 100 open jobs', 'Up to 15 team seats', '200 talent invites a month', 'Everything in free'],
  },
  freelancer: {
    free: ['Unlimited proposals (25 a day)', 'Profile, contracts and messages', `${FREE_LIMIT} invoices`, `${FREE_LIMIT} client invites`],
    pro: ['Unlimited invoices', 'Unlimited client invites', 'Verified work exports', 'Analytics'],
  },
  client: {
    free: [`${FREE_LIMIT} open projects`, 'Unlimited proposals to review', 'Contracts, milestones and messages'],
    pro: ['Up to 100 open projects', 'Invoices from your freelancers in one place', 'Priority support'],
  },
}

/** Billing page path for the current portal. */
export const billingPathFor = (role?: string | null) =>
  role === 'recruiter' ? '/recruiter/billing' : role === 'freelancer' ? '/freelancer/billing' : role === 'client' ? '/client/billing' : '/dashboard/billing'
