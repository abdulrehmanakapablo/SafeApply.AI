// ============================================================
// FILE: apps/backend/src/controllers/progress.controller.ts
// PURPOSE: Private progress (your numbers + weekly streak), badges, the
//          public monthly leaderboards, and admin trust overrides.
// PRIVACY: /progress/me is only ever about the caller. Leaderboards list
//          companies only, never people.
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendPaginated, sendSuccess } from '../utils/response'
import { pageParam, safeSearchTerm, stripHtml, uuidParam } from '../utils/sanitize'
import { getMembership } from '../utils/recruiter'
import { h } from './freelance.controller'

const WEEKS = 12
const WEEK_MS = 7 * 86_400_000
const MONTH_RE = /^\d{4}-\d{2}$/
const currentMonth = () => new Date().toISOString().slice(0, 7)

/** Activity per week (oldest → newest) and the current run of active weeks. */
function weekly(dates: string[]) {
  const now = Date.now()
  const buckets = Array(WEEKS).fill(0) as number[]
  for (const d of dates) {
    const age = Math.floor((now - new Date(d).getTime()) / WEEK_MS)
    if (age >= 0 && age < WEEKS) buckets[WEEKS - 1 - age]++
  }
  let streak = 0
  // This week may still be empty without breaking the streak.
  for (let i = WEEKS - 1; i >= 0; i--) {
    if (buckets[i] > 0) streak++
    else if (i !== WEEKS - 1) break
  }
  return { weeks: buckets, streak }
}

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count || 0

export const myProgress = h('progress.me', async (req, res) => {
  const uid = req.user!.userId
  const { data: u } = await supabaseAdmin.from('users').select('role, trust_level').eq('id', uid).single()
  const role = u?.role || 'user'
  const head = { count: 'exact' as const, head: true }
  let stats: { label: string; value: number }[] = []
  let dates: string[] = []
  let activity = ''

  if (role === 'user' || role === 'admin') {
    const [{ data: board }, { data: manual }, interviews] = await Promise.all([
      supabaseAdmin.from('job_applications').select('created_at, cv_opened_at, first_response_at, stage').eq('user_id', uid).limit(2000),
      supabaseAdmin.from('applications').select('created_at').eq('user_id', uid).is('job_application_id', null).limit(2000),
      supabaseAdmin.from('interviews').select('id, application:job_applications!inner(user_id)').eq('application.user_id', uid).eq('candidate_confirmed', true),
    ])
    const b = board || []
    stats = [
      { label: 'Applied', value: b.length + (manual || []).length },
      { label: 'CVs opened', value: b.filter((a) => a.cv_opened_at).length },
      { label: 'Replies', value: b.filter((a) => a.first_response_at).length },
      { label: 'Interviews', value: (interviews.data || []).length },
      { label: 'Offers and hires', value: b.filter((a) => a.stage === 'offer' || a.stage === 'hired').length },
      { label: 'Not selected', value: b.filter((a) => a.stage === 'rejected').length },
    ]
    dates = [...b.map((a) => a.created_at), ...(manual || []).map((a) => a.created_at)]
    activity = 'applications'
  } else if (role === 'freelancer') {
    const { data: props } = await supabaseAdmin.from('proposals').select('created_at, status').eq('freelancer_id', uid).limit(2000)
    const p = props || []
    const [done, approved] = await Promise.all([
      count(supabaseAdmin.from('contracts').select('id', head).eq('freelancer_id', uid).eq('status', 'completed')),
      count(supabaseAdmin.from('milestones').select('id, contracts!inner(freelancer_id)', head).eq('contracts.freelancer_id', uid).eq('status', 'approved')),
    ])
    stats = [
      { label: 'Proposals', value: p.length },
      { label: 'Shortlisted', value: p.filter((x) => x.status === 'shortlisted' || x.status === 'accepted').length },
      { label: 'Hired', value: p.filter((x) => x.status === 'accepted').length },
      { label: 'Milestones approved', value: approved },
      { label: 'Contracts completed', value: done },
    ]
    dates = p.map((x) => x.created_at)
    activity = 'proposals'
  } else if (role === 'client') {
    const { data: projects } = await supabaseAdmin.from('projects').select('created_at, status').eq('client_id', uid).limit(1000)
    const [hires, approved] = await Promise.all([
      count(supabaseAdmin.from('contracts').select('id', head).eq('client_id', uid)),
      count(supabaseAdmin.from('milestones').select('id, contracts!inner(client_id)', head).eq('contracts.client_id', uid).eq('status', 'approved')),
    ])
    stats = [
      { label: 'Projects posted', value: (projects || []).filter((p) => p.status !== 'draft').length },
      { label: 'Hires', value: hires },
      { label: 'Milestones approved', value: approved },
    ]
    dates = (projects || []).map((p) => p.created_at)
    activity = 'projects'
  } else if (role === 'recruiter') {
    const m = await getMembership(uid)
    if (m) {
      const { data: s } = await supabaseAdmin.from('company_scores').select('applications, opened_pct, replied_7d_pct, hires_verified, interviews_confirmed').eq('company_id', m.company_id).maybeSingle()
      const { data: events } = await supabaseAdmin.from('application_events').select('created_at').eq('changed_by', uid).gte('created_at', new Date(Date.now() - WEEKS * WEEK_MS).toISOString()).limit(5000)
      stats = [
        { label: 'Applications', value: s?.applications || 0 },
        { label: 'CVs opened %', value: s?.opened_pct ?? 0 },
        { label: 'Replied in 7 days %', value: s?.replied_7d_pct ?? 0 },
        { label: 'Confirmed interviews', value: s?.interviews_confirmed || 0 },
        { label: 'Verified hires', value: s?.hires_verified || 0 },
      ]
      dates = (events || []).map((e) => e.created_at)
      activity = 'applicant updates'
    }
  }
  sendSuccess(res, { role, trust_level: u?.trust_level ?? 0, stats, activity, ...weekly(dates) })
})

export const myBadges = h('progress.badges', async (req, res) => {
  const uid = req.user!.userId
  const m = req.user!.role === 'recruiter' ? await getMembership(uid) : null
  const [{ data: mine }, { data: company }] = await Promise.all([
    supabaseAdmin.from('badges_earned').select('badge_key, earned_at').eq('subject_type', 'user').eq('subject_id', uid),
    m ? supabaseAdmin.from('badges_earned').select('badge_key, earned_at').eq('subject_type', 'company').eq('subject_id', m.company_id) : Promise.resolve({ data: [] }),
  ])
  sendSuccess(res, { user: mine || [], company: company || [], company_name: m?.company.name ?? null })
})

export const leaderboards = h('progress.leaderboards', async (req, res) => {
  const month = MONTH_RE.test(String(req.query.month)) ? String(req.query.month) : currentMonth()
  const live = month >= currentMonth()
  let rows: { board: string; rank: number; company_id: string; value: number; sample: number }[] = []
  if (live) {
    const { data, error } = await supabaseAdmin.rpc('leaderboard_rows', { p_month: currentMonth() })
    if (error) throw error
    rows = (data || []).filter((r: { rank: number }) => r.rank <= 25)
  } else {
    const { data } = await supabaseAdmin.from('leaderboard_snapshots').select('board, rank, company_id, value, sample').eq('month', month).order('rank')
    rows = data || []
  }
  const ids = [...new Set(rows.map((r) => r.company_id))]
  const names: Record<string, { name: string; slug: string; trust_level: number }> = {}
  if (ids.length) {
    const { data } = await supabaseAdmin.from('companies').select('id, name, slug, trust_level').in('id', ids)
    for (const c of data || []) names[c.id] = { name: c.name, slug: c.slug, trust_level: c.trust_level }
  }
  const { data: months } = await supabaseAdmin.from('leaderboard_snapshots').select('month').order('month', { ascending: false }).limit(500)
  const pack = (board: string) =>
    rows
      .filter((r) => r.board === board && names[r.company_id])
      .map(({ company_id, ...r }) => ({ ...r, value: Number(r.value), company: names[company_id] }))
  sendSuccess(res, {
    month,
    live,
    months: [...new Set([currentMonth(), ...(months || []).map((m) => m.month as string)])],
    responsive: pack('responsive'),
    verified_hires: pack('verified_hires'),
  })
})

// ─── Admin trust ─────────────────────────────────────────────

export const adminTrustList = h('progress.adminTrust', async (req, res) => {
  const type = req.query.type === 'company' ? 'company' : 'user'
  const page = pageParam(req.query.page)
  const q = safeSearchTerm(req.query.q)
  const PAGE = 25
  if (type === 'company') {
    let query = supabaseAdmin.from('companies').select('id, name, slug, trust_level, trust_override, penalty_level, verification_status', { count: 'exact' }).eq('verification_status', 'verified')
    if (q) query = query.ilike('name', `%${q}%`)
    const { data, count, error } = await query.order('trust_level', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (error) throw error
    return sendPaginated(res, data || [], count || 0, page, PAGE)
  }
  let query = supabaseAdmin.from('users').select('id, full_name, email, role, trust_level, trust_override', { count: 'exact' }).in('role', ['freelancer', 'client'])
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  const { data, count, error } = await query.order('trust_level', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  if (error) throw error
  sendPaginated(res, data || [], count || 0, page, PAGE)
})

export const adminTrustAudit = h('progress.adminAudit', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('trust_audit').select('id, subject_type, subject_id, old_override, new_override, reason, created_at').order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  sendSuccess(res, data || [])
})

export const adminSetTrust = h('progress.adminSetTrust', async (req, res) => {
  const type = req.params.type === 'company' ? 'company' : req.params.type === 'user' ? 'user' : null
  const id = uuidParam(req.params.id)
  if (!type || !id) return sendError(res, 'Not found', 404)
  const table = type === 'company' ? 'companies' : 'users'
  const { data: cur } = await supabaseAdmin.from(table).select('trust_override').eq('id', id).maybeSingle()
  if (!cur) return sendError(res, 'Not found', 404)
  const override = req.body.override as number | null
  const { error } = await supabaseAdmin.from(table).update({ trust_override: override, ...(override !== null ? { trust_level: override } : {}) }).eq('id', id)
  if (error) throw error
  await supabaseAdmin.from('trust_audit').insert({ subject_type: type, subject_id: id, admin_id: req.user!.userId, old_override: cur.trust_override, new_override: override, reason: stripHtml(req.body.reason) })
  if (override === null) await supabaseAdmin.rpc('refresh_trust')
  sendSuccess(res, { id, override }, 200, 'Trust level saved')
})
