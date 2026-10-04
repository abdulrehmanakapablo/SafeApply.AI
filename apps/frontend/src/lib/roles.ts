// FILE: src/lib/roles.ts
// PURPOSE: Which portal each role lives in.
//   Every non-admin role has exactly one portal and can never render another.
//   Admins are locked to ONE active portal at a time (chosen at login or
//   switched explicitly from the admin panel). The URL never switches it.

export type Role = 'user' | 'recruiter' | 'freelancer' | 'client' | 'admin'
export type Portal = 'seeker' | 'recruiter' | 'freelancer' | 'client'

export const PORTALS: Portal[] = ['seeker', 'recruiter', 'freelancer', 'client']
export const PORTAL_LABEL: Record<Portal, string> = { seeker: 'Job seeker', recruiter: 'Recruiter', freelancer: 'Freelancer', client: 'Client' }
const BASE: Record<Portal, string> = { seeker: '/dashboard', recruiter: '/recruiter', freelancer: '/freelancer', client: '/client' }
const ROLE_PORTAL: Partial<Record<string, Portal>> = { user: 'seeker', recruiter: 'recruiter', freelancer: 'freelancer', client: 'client' }

export const portalBase = (p: Portal) => BASE[p]

/** Portal from the role alone (null for admin and unknown roles). */
export const portalOfRole = (role: string | undefined | null): Portal | null => ROLE_PORTAL[role || ''] ?? null

/** The portal this account is in right now. Admins: their locked portal. */
export function activePortal(role: string | undefined | null, adminPortal: Portal | null | undefined): Portal {
  if (role === 'admin') return adminPortal ?? 'seeker'
  return portalOfRole(role) ?? 'seeker'
}

export function homeFor(role: string | undefined | null, adminPortal?: Portal | null): string {
  return BASE[activePortal(role, adminPortal)]
}

/** Login ?role= value → portal. */
export const portalForAccount = (acct: string | null | undefined): Portal => (acct && acct !== 'user' && acct in BASE ? (acct as Portal) : 'seeker')

export function isRecruiter(role: string | undefined | null): boolean {
  return role === 'recruiter'
}
