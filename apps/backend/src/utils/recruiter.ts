// ============================================================
// FILE: apps/backend/src/utils/recruiter.ts
// PURPOSE: Shared recruiter-portal helpers. Every company-scoped query takes
//          the company id from the caller's membership row, never from the
//          request, so one company can never reach another's data.
// ============================================================

import { supabaseAdmin } from '../config/supabase'

export const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] as const
export type Stage = (typeof STAGES)[number]

/** Recruiter pipeline stage → the seeker's own tracker status. */
export const STAGE_TO_TRACKER: Record<Stage, string> = {
  applied: 'applied',
  screening: 'screening',
  interview: 'interviewing',
  offer: 'offered',
  hired: 'offered',
  rejected: 'rejected',
}

export const STAGE_LABEL: Record<Stage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Not selected',
}

export interface Membership {
  company_id: string
  member_role: 'owner' | 'recruiter'
  company: {
    id: string
    name: string
    slug: string
    verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
    pro_until: string | null
    suspended: boolean
    penalty_level: number
  }
}

export async function getMembership(userId: string): Promise<Membership | null> {
  const { data } = await supabaseAdmin
    .from('company_members')
    .select('company_id, member_role, company:companies(id, name, slug, verification_status, pro_until, suspended, penalty_level)')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data || !data.company) return null
  const company = Array.isArray(data.company) ? data.company[0] : data.company
  return company ? ({ ...data, company } as Membership) : null
}

export async function companyMemberIds(companyId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from('company_members').select('user_id').eq('company_id', companyId).limit(50)
  return (data || []).map((r) => r.user_id as string)
}

/**
 * Reads every row of a query, page by page. PostgREST caps each response
 * (Supabase default 1000 rows), so a single .limit() silently truncates.
 * The builder must apply a stable .order() and the given .range().
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>, max = 50_000): Promise<T[]> {
  const SIZE = 1000
  const out: T[] = []
  for (let from = 0; from < max; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    out.push(...rows)
    if (rows.length < SIZE) break
  }
  return out
}

export interface NotificationInput {
  user_id: string
  type: string
  title: string
  body?: string
  link?: string
}

/** Best effort: a failed notification must never fail the action itself. */
export async function notify(rows: NotificationInput[]): Promise<void> {
  if (rows.length === 0) return
  try {
    await supabaseAdmin.from('notifications').insert(
      rows.map((r) => ({
        user_id: r.user_id,
        type: r.type.slice(0, 40),
        title: r.title.slice(0, 200),
        body: (r.body || '').slice(0, 500),
        link: r.link && r.link.startsWith('/') ? r.link.slice(0, 300) : '',
      })),
    )
  } catch (e) {
    console.warn('notify failed', e instanceof Error ? e.message : e)
  }
}

// ── Company domain checks ────────────────────────────────────
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net',
  'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru', 'tutanota.com', 'tuta.io', 'hey.com', 'fastmail.com',
  'qq.com', '163.com', 'rediffmail.com',
])

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] || ''
}

export function hostOf(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** jobs@acme.com matches acme.com and careers.acme.com; never "notacme.com". */
export function domainMatches(emailDom: string, host: string): boolean {
  if (!emailDom || !host) return false
  return host === emailDom || host.endsWith(`.${emailDom}`) || emailDom.endsWith(`.${host}`)
}

export function companySlug(name: string, hash: (s: string) => string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
  return slug || `company-${hash(name.trim().toLowerCase()).slice(0, 12)}`
}

// ── Response rate (public trust signal) ─────────────────────
// Of applications older than 14 days, the share that got any response
// (stage change or message from the company) within 14 days.
export async function companyResponseRate(companyId: string): Promise<{ rate: number | null; sample: number }> {
  const { data: jobs } = await supabaseAdmin.from('jobs').select('id').eq('company_id', companyId).limit(500)
  const ids = (jobs || []).map((j) => j.id as string)
  if (ids.length === 0) return { rate: null, sample: 0 }
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const rows = await fetchAll<{ created_at: string; first_response_at: string | null }>((from, to) =>
    supabaseAdmin.from('job_applications').select('created_at, first_response_at').in('job_id', ids).lt('created_at', cutoff).order('created_at').order('id').range(from, to),
  )
  if (rows.length < 3) return { rate: null, sample: rows.length }
  const ok = rows.filter(
    (a) => a.first_response_at && new Date(a.first_response_at).getTime() - new Date(a.created_at).getTime() <= 14 * 86_400_000,
  ).length
  return { rate: Math.round((ok / rows.length) * 100), sample: rows.length }
}

/** Cheap, explainable keyword overlap between a CV and a job post (no AI cost). */
const STOP = new Set(
  'the and for with you our are will your from this that have has can all any who what about into more than their they them work team role able also must should years year experience skills including within across using use etc'.split(
    ' ',
  ),
)
function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && w.length < 30 && !STOP.has(w)),
  )
}
export function keywordMatch(cv: string, jd: string): number {
  const j = keywords(jd)
  if (j.size === 0) return 0
  const c = keywords(cv)
  let hit = 0
  j.forEach((w) => {
    if (c.has(w)) hit += 1
  })
  return Math.min(100, Math.round((hit / Math.min(j.size, 60)) * 100))
}
