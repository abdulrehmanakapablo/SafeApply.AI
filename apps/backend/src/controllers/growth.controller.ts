// ============================================================
// FILE: apps/backend/src/controllers/growth.controller.ts
// PURPOSE: Public, shareable, indexable pages built from recorded data:
//          company ghosting / interview process / salaries, employer share
//          card, shared company reports, live landing figures, sitemap.
//          Plus disputes (contest a flag, penalty or level).
// PRIVACY: never returns reviewer_id or any account id. Reported pay is
//          shown only as a rounded median, and only when 5+ people
//          reported the same role, so one person's pay can't be singled out.
// ============================================================

import { randomUUID } from 'crypto'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { env } from '../config/env'
import { sendError, sendSuccess } from '../utils/response'
import { pageParam, stripHtml, uuidParam } from '../utils/sanitize'
import { companyResponseRate, getMembership, notify } from '../utils/recruiter'
import { h } from './freelance.controller'

const SLUG_RE = /^[a-z0-9-]{1,200}$/
const MIN_SALARY_REPORTS = 5
/** Two significant figures, so the shown number never equals one person's exact entry. */
const roundSig = (n: number) => {
  if (!(n > 0)) return 0
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1))
  return Math.round(n / p) * p
}
const DAY = 86_400_000

type Cached = { at: number; body: unknown }
const cache = new Map<string, Cached>()
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.body as T
  const body = await fn()
  if (cache.size > 2000) cache.clear()
  cache.set(key, { at: Date.now(), body })
  return body
}

async function companyBySlug(slug: string) {
  if (!SLUG_RE.test(slug)) return null
  const { data } = await supabaseAdmin
    .from('companies')
    .select('id, name, slug, industry, verification_status, suspended, trust_level, penalty_level, penalty_reason, total_reviews, avg_overall_rating')
    .eq('slug', slug)
    .maybeSingle()
  return data
}
const pub = (c: NonNullable<Awaited<ReturnType<typeof companyBySlug>>>) => ({
  name: c.name,
  slug: c.slug,
  industry: c.industry,
  verified: c.verification_status === 'verified',
  suspended: c.suspended,
  trust_level: c.trust_level ?? 0,
})
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ═══ COMPANY INSIGHT PAGES ═══════════════════════════════════

export const companyGhosting = h('growth.ghosting', async (req, res) => {
  const c = await companyBySlug(String(req.params.slug))
  if (!c) return sendError(res, 'Company not found', 404)
  if (c.verification_status !== 'verified') return sendSuccess(res, { company: pub(c), tracked: false })
  const body = await cached(`ghost:${c.id}`, 10 * 60_000, async () => {
    const [{ data: score }, { data: jobs }] = await Promise.all([
      supabaseAdmin.from('company_scores').select('applications, matured, opened_pct, replied_7d_pct, no_response_pct, ghost_jobs_90d, closed_jobs, updated_at').eq('company_id', c.id).maybeSingle(),
      supabaseAdmin
        .from('jobs')
        .select('id, title, status, created_at, closed_at, apps_count, opened_count, replied_count, ghost_flag, ghost_cleared')
        .eq('company_id', c.id)
        .neq('status', 'draft')
        .gte('created_at', new Date(Date.now() - 365 * DAY).toISOString())
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    const rows = jobs || []
    return {
      company: pub(c),
      tracked: true,
      warning: c.penalty_level >= 2 ? c.penalty_reason : null,
      score,
      ghost_jobs: rows.filter((j) => j.ghost_flag).map(({ ghost_cleared: _g, ...j }) => j),
      cleared_on_review: rows.filter((j) => j.ghost_cleared).length,
      jobs_tracked: rows.length,
    }
  })
  sendSuccess(res, body)
})

export const companyInterviews = h('growth.interviews', async (req, res) => {
  const c = await companyBySlug(String(req.params.slug))
  if (!c) return sendError(res, 'Company not found', 404)
  const body = await cached(`intv:${c.id}`, 10 * 60_000, async () => {
    const since = new Date(Date.now() - 365 * DAY).toISOString()
    const [{ data: ivs }, { data: reviews }] = await Promise.all([
      supabaseAdmin
        .from('interviews')
        .select('mode, status, duration_min, scheduled_at, cancelled_by, company_confirmed, candidate_confirmed, created_at, app:job_applications(created_at)')
        .eq('company_id', c.id)
        .gte('created_at', since)
        .limit(2000),
      supabaseAdmin
        .from('reviews')
        .select('interview_rating, interview_process, role_type, created_at')
        .eq('company_id', c.id)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(300),
    ])
    const list = ivs || []
    const modes = { video: 0, phone: 0, onsite: 0 } as Record<string, number>
    const daysToInterview: number[] = []
    for (const i of list) {
      modes[i.mode] = (modes[i.mode] || 0) + 1
      const app = Array.isArray(i.app) ? i.app[0] : i.app
      if (i.scheduled_at && app?.created_at) daysToInterview.push((new Date(i.scheduled_at).getTime() - new Date(app.created_at).getTime()) / DAY)
    }
    const past = list.filter((i) => i.status === 'scheduled' && i.scheduled_at && new Date(i.scheduled_at).getTime() < Date.now())
    const rated = (reviews || []).filter((r) => typeof r.interview_rating === 'number' && r.interview_rating > 0)
    const d = median(daysToInterview)
    return {
      company: pub(c),
      interviews: {
        total: list.length,
        modes,
        median_duration_min: median(list.map((i) => i.duration_min as number)),
        median_days_to_interview: d === null ? null : Math.round(d * 10) / 10,
        held_confirmed: past.filter((i) => i.company_confirmed && i.candidate_confirmed).length,
        past: past.length,
        cancelled_by_company: list.filter((i) => i.status === 'cancelled' && i.cancelled_by === 'company').length,
      },
      reviews: {
        count: rated.length,
        avg_rating: rated.length ? Math.round((rated.reduce((a, r) => a + (r.interview_rating as number), 0) / rated.length) * 10) / 10 : null,
        experiences: (reviews || [])
          .filter((r) => r.interview_process && String(r.interview_process).trim().length >= 20)
          .slice(0, 12)
          .map((r) => ({ role_type: r.role_type, text: String(r.interview_process).slice(0, 1200), rating: r.interview_rating, created_at: r.created_at })),
      },
    }
  })
  sendSuccess(res, body)
})

export const companySalaries = h('growth.salaries', async (req, res) => {
  const c = await companyBySlug(String(req.params.slug))
  if (!c) return sendError(res, 'Company not found', 404)
  const body = await cached(`sal:${c.id}`, 10 * 60_000, async () => {
    const [{ data: reviews }, { data: jobs }] = await Promise.all([
      supabaseAdmin.from('reviews').select('role_type, salary_min, salary_max').eq('company_id', c.id).eq('moderation_status', 'approved').not('salary_min', 'is', null).limit(1000),
      supabaseAdmin
        .from('jobs')
        .select('id, title, salary_min, salary_max, currency, salary_period, status, created_at')
        .eq('company_id', c.id)
        .neq('status', 'draft')
        .gt('salary_max', 0)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    const byRole = new Map<string, number[]>()
    for (const r of reviews || []) {
      const lo = Number(r.salary_min)
      const hi = Number(r.salary_max ?? r.salary_min)
      if (!(lo > 0) || hi < lo) continue
      const role = String(r.role_type || 'Other').trim().slice(0, 80) || 'Other'
      const arr = byRole.get(role) || []
      arr.push((lo + hi) / 2)
      byRole.set(role, arr)
    }
    const reported = [...byRole]
      .filter(([, xs]) => xs.length >= MIN_SALARY_REPORTS)
      .map(([role, xs]) => ({ role, reports: xs.length, median: roundSig(median(xs) || 0) }))
      .sort((a, b) => b.reports - a.reports)
    const withheld = [...byRole].filter(([, xs]) => xs.length < MIN_SALARY_REPORTS).reduce((n, [, xs]) => n + xs.length, 0)
    return { company: pub(c), posted: jobs || [], reported, withheld, min_reports: MIN_SALARY_REPORTS }
  })
  sendSuccess(res, body)
})

// ═══ SHARE CARDS ═════════════════════════════════════════════

export const employerCard = h('growth.employer', async (req, res) => {
  const c = await companyBySlug(String(req.params.slug))
  if (!c) return sendError(res, 'Company not found', 404)
  const body = await cached(`card:${c.id}`, 10 * 60_000, async () => {
    const [{ data: score }, rr] = await Promise.all([
      supabaseAdmin.from('company_scores').select('opened_pct, replied_7d_pct, ghost_jobs_90d, hires_verified, applications').eq('company_id', c.id).maybeSingle(),
      c.verification_status === 'verified' ? companyResponseRate(c.id) : Promise.resolve({ rate: null, sample: 0 }),
    ])
    return {
      company: pub(c),
      rating: c.total_reviews ? { avg: Number(c.avg_overall_rating), count: c.total_reviews } : null,
      score: c.verification_status === 'verified' ? score : null,
      response_rate: rr.rate,
      warning: c.penalty_level >= 2 ? c.penalty_reason : null,
    }
  })
  sendSuccess(res, body)
})

export const publicReport = h('growth.report', async (req, res) => {
  const id = uuidParam(req.params.shareId)
  if (!id) return sendError(res, 'Report not found', 404)
  const { data } = await supabaseAdmin.from('reports').select('company_name, job_title, report_data, created_at').eq('share_id', id).maybeSingle()
  if (!data) return sendError(res, 'This report isn’t shared, or the link was turned off.', 404)
  res.set('Cache-Control', 'no-store')
  sendSuccess(res, { id: null, ...data })
})

export const shareReport = h('growth.shareReport', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Report not found', 404)
  const { data: r } = await supabaseAdmin.from('reports').select('id, share_id').eq('id', id).eq('user_id', req.user!.userId).maybeSingle()
  if (!r) return sendError(res, 'Report not found', 404)
  if (r.share_id) return sendSuccess(res, { share_id: r.share_id })
  const share_id = randomUUID()
  const { error } = await supabaseAdmin.from('reports').update({ share_id }).eq('id', id).eq('user_id', req.user!.userId)
  if (error) throw error
  sendSuccess(res, { share_id }, 201, 'Public link created')
})

export const unshareReport = h('growth.unshareReport', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Report not found', 404)
  const { data } = await supabaseAdmin.from('reports').update({ share_id: null }).eq('id', id).eq('user_id', req.user!.userId).select('id').maybeSingle()
  if (!data) return sendError(res, 'Report not found', 404)
  sendSuccess(res, null, 200, 'Public link turned off')
})

// ═══ LIVE LANDING FIGURES ════════════════════════════════════

export const publicStats = h('growth.stats', async (_req, res) => {
  const body = await cached('stats', 10 * 60_000, async () => {
    const head = { count: 'exact' as const, head: true }
    const [companies, jobs, opened, hires, contracts] = await Promise.all([
      supabaseAdmin.from('companies').select('id', head).eq('verification_status', 'verified'),
      supabaseAdmin.from('jobs').select('id', head).eq('status', 'open'),
      supabaseAdmin.from('job_applications').select('id', head).not('cv_opened_at', 'is', null),
      supabaseAdmin.from('job_applications').select('id', head).eq('hire_confirmed', true),
      supabaseAdmin.from('contracts').select('id', head).eq('status', 'completed'),
    ])
    return {
      verified_companies: companies.count || 0,
      open_jobs: jobs.count || 0,
      cvs_opened: opened.count || 0,
      hires_confirmed: hires.count || 0,
      contracts_completed: contracts.count || 0,
    }
  })
  res.set('Cache-Control', 'public, max-age=300')
  sendSuccess(res, body)
})

// ═══ SITEMAP ═════════════════════════════════════════════════

const xmlEsc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!)
const STATIC_PATHS = ['/', '/jobs', '/companies', '/projects', '/freelance', '/recruiters', '/pricing', '/leaderboards', '/levels', '/methodology']

export async function sitemap(_req: Request, res: Response): Promise<void> {
  try {
    const xml = await cached('sitemap', 60 * 60_000, async () => {
      const base = env.frontendUrl
      const [{ data: companies }, { data: jobs }, { data: projects }] = await Promise.all([
        supabaseAdmin.from('companies').select('slug, verification_status, updated_at').or('verification_status.eq.verified,total_reviews.gt.0').eq('suspended', false).limit(10000),
        supabaseAdmin.from('jobs').select('id, updated_at').eq('status', 'open').limit(10000),
        supabaseAdmin.from('projects').select('id, updated_at').eq('status', 'open').limit(10000),
      ])
      const urls: { loc: string; lastmod?: string }[] = STATIC_PATHS.map((p) => ({ loc: p }))
      for (const c of companies || []) {
        const lastmod = c.updated_at ? String(c.updated_at).slice(0, 10) : undefined
        urls.push({ loc: `/companies/${c.slug}`, lastmod }, { loc: `/c/${c.slug}/interview-process`, lastmod }, { loc: `/c/${c.slug}/salaries`, lastmod })
        if (c.verification_status === 'verified') urls.push({ loc: `/companies/${c.slug}/hiring-record`, lastmod }, { loc: `/c/${c.slug}/ghosting`, lastmod })
      }
      for (const j of jobs || []) urls.push({ loc: `/jobs/${j.id}`, lastmod: j.updated_at ? String(j.updated_at).slice(0, 10) : undefined })
      for (const p of projects || []) urls.push({ loc: `/projects/${p.id}`, lastmod: p.updated_at ? String(p.updated_at).slice(0, 10) : undefined })
      const body = urls
        .slice(0, 50000)
        .map((u) => `<url><loc>${xmlEsc(base + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
        .join('')
      return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
    })
    res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }).send(xml)
  } catch (e) {
    console.error('sitemap', e instanceof Error ? e.message : e)
    res.status(503).set('Cache-Control', 'no-store').send('')
  }
}

// ═══ DISPUTES ════════════════════════════════════════════════

const MAX_OPEN = 3

export const myDisputes = h('disputes.mine', async (req, res) => {
  const uid = req.user!.userId
  const [{ data }, m] = await Promise.all([
    supabaseAdmin.from('disputes').select('id, subject_type, subject_ref, reason, evidence_url, status, admin_note, created_at, resolved_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
    getMembership(uid),
  ])
  // Context for the form: the caller's flagged jobs and company penalty.
  let ghost_jobs: { id: string; title: string }[] = []
  let company: { id: string; name: string; penalty_level: number; owner: boolean } | null = null
  if (m) {
    company = { id: m.company_id, name: m.company.name, penalty_level: m.company.penalty_level, owner: m.member_role === 'owner' }
    const { data: jobs } = await supabaseAdmin.from('jobs').select('id, title').eq('company_id', m.company_id).eq('ghost_flag', true).limit(100)
    ghost_jobs = jobs || []
  }
  sendSuccess(res, { disputes: data || [], ghost_jobs, company })
})

export const createDispute = h('disputes.create', async (req, res) => {
  const uid = req.user!.userId
  const { subject_type, reason } = req.body as { subject_type: string; reason: string }
  let ref: string | null = req.body.subject_ref || null
  let companyId: string | null = null

  if (subject_type === 'ghost_flag' || subject_type === 'penalty') {
    const m = await getMembership(uid)
    if (!m) return sendError(res, 'Only company members can dispute this.', 403)
    companyId = m.company_id
    if (subject_type === 'ghost_flag') {
      const { data: job } = await supabaseAdmin.from('jobs').select('id').eq('id', ref || '').eq('company_id', m.company_id).eq('ghost_flag', true).maybeSingle()
      if (!job) return sendError(res, 'Pick one of your flagged jobs.', 400)
    } else {
      if (m.company.penalty_level < 1) return sendError(res, 'Your company has no penalty to dispute.', 400)
      ref = m.company_id
    }
  } else if (subject_type === 'trust_level') {
    const m = await getMembership(uid)
    companyId = m?.company_id || null
    ref = m?.company_id || null
  } else ref = null

  const { count } = await supabaseAdmin.from('disputes').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'open')
  if ((count || 0) >= MAX_OPEN) return sendError(res, `You can have ${MAX_OPEN} open disputes at a time.`, 403)

  const { data, error } = await supabaseAdmin
    .from('disputes')
    .insert({ user_id: uid, company_id: companyId, subject_type, subject_ref: ref, reason: stripHtml(reason), evidence_url: req.body.evidence_url || null })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return sendError(res, 'There’s already an open dispute for this.', 409)
    throw error
  }
  const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin').limit(20)
  void notify((admins || []).map((a) => ({ user_id: a.id, type: 'dispute', title: 'New dispute to review', body: subject_type.replace('_', ' '), link: '/admin/disputes' })))
  sendSuccess(res, { id: data.id }, 201, 'Dispute sent. An admin will review it.')
})

export const adminDisputes = h('disputes.admin', async (req, res) => {
  const status = ['open', 'accepted', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : 'open'
  const page = pageParam(req.query.page, 200)
  const from = (page - 1) * 20
  const { data, count, error } = await supabaseAdmin
    .from('disputes')
    .select('id, subject_type, subject_ref, reason, evidence_url, status, admin_note, created_at, resolved_at, user:users!disputes_user_id_fkey(full_name, email, role), company:companies(name, slug)', { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: status === 'open' })
    .range(from, from + 19)
  if (error) throw error
  const refs = (data || []).filter((d) => d.subject_type === 'ghost_flag' && d.subject_ref).map((d) => d.subject_ref as string)
  const { data: jobs } = refs.length ? await supabaseAdmin.from('jobs').select('id, title, apps_count, opened_count, replied_count, status, created_at').in('id', refs) : { data: [] }
  const jobById = new Map((jobs || []).map((j) => [j.id as string, j]))
  res.status(200).json({
    success: true,
    data: (data || []).map((d) => ({ ...d, job: d.subject_ref ? jobById.get(d.subject_ref) || null : null })),
    total: count || 0,
    page,
    limit: 20,
    total_pages: Math.ceil((count || 0) / 20),
  })
})

export const resolveDispute = h('disputes.resolve', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Dispute not found', 404)
  const { data, error } = await supabaseAdmin.rpc('resolve_dispute', { p_id: id, p_admin: req.user!.userId, p_accept: req.body.accept, p_note: stripHtml(req.body.note || '') })
  if (error) {
    if (error.message.includes('NOT_OPEN')) return sendError(res, 'This dispute is already resolved.', 409)
    throw error
  }
  const d = data as { user_id: string; status: string; subject_type: string }
  void notify([
    {
      user_id: d.user_id,
      type: 'dispute',
      title: d.status === 'accepted' ? 'Your dispute was accepted' : 'Your dispute was reviewed',
      body: d.status === 'accepted' && d.subject_type === 'ghost_flag' ? 'The flag was removed from your hiring record.' : stripHtml(req.body.note || '').slice(0, 200),
      link: '/disputes',
    },
  ])
  sendSuccess(res, { status: d.status }, 200, d.status === 'accepted' ? 'Accepted' : 'Rejected')
})
