// ============================================================
// FILE: apps/backend/src/controllers/admin.controller.ts
// PURPOSE: Admin only operations — moderation and user management
// SECURITY: All routes protected by auth + adminOnly middleware.
// reviewer_id is read here for moderation only; never sent to public routes.
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'
import { updateCompanyAggregates } from './reviews.controller'
import { safeSearchTerm, stripHtml, uuidParam } from '../utils/sanitize'
import { companyMemberIds, notify } from '../utils/recruiter'

const REVIEW_STATUSES = new Set(['pending', 'approved', 'flagged', 'deleted'])
const PLANS = new Set(['free', 'pro', 'lifetime'])
const ROLES = new Set(['user', 'admin'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGE_SIZE = 20

function pageOf(req: Request): number {
  const n = parseInt(String(req.query.page ?? '1'), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1
}

const safeSearch = (raw: unknown) => safeSearchTerm(raw)

// ─── PLATFORM STATS ───────────────────────────────────────
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

    const [users, paid, reportsToday, reviews, pending, signups] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
      supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
      supabaseAdmin.from('reviews').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('reviews').select('id', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ])

    sendSuccess(res, {
      total_users: users.count || 0,
      pro_users: paid.count || 0,
      reports_today: reportsToday.count || 0,
      total_reviews: reviews.count || 0,
      pending_reviews: pending.count || 0,
      signups_7d: signups.count || 0,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET ALL REVIEWS WITH REVIEWER IDENTITY ───────────────
export async function getReviews(req: Request, res: Response): Promise<void> {
  try {
    const page = pageOf(req)
    const offset = (page - 1) * PAGE_SIZE
    const status = String(req.query.status ?? '')

    let query = supabaseAdmin
      .from('reviews')
      .select(
        `id, company_name, role_type, overall_rating, review_text,
        moderation_status, created_at, reviewer_id,
        users!reviewer_id (email, full_name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (status && REVIEW_STATUSES.has(status)) query = query.eq('moderation_status', status)

    const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      sendError(res, 'Failed to fetch reviews', 500)
      return
    }
    sendPaginated(res, data || [], count || 0, page, PAGE_SIZE)
  } catch (error) {
    console.error('Admin get reviews error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE REVIEW STATUS ─────────────────────────────────
export async function updateReviewStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { status } = req.body ?? {}

    if (!UUID_RE.test(String(id))) {
      sendError(res, 'Invalid review id', 400)
      return
    }
    if (!['approved', 'flagged', 'deleted'].includes(status)) {
      sendError(res, 'Invalid status', 400)
      return
    }

    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .update({ moderation_status: status })
      .eq('id', id)
      .select('company_id')
      .single()

    if (error || !review) {
      sendError(res, 'Review not found', 404)
      return
    }

    // Keep public company scores in sync with what's visible.
    if (review.company_id) await updateCompanyAggregates(review.company_id)

    sendSuccess(res, null, 200, `Review ${status}`)
  } catch (error) {
    console.error('Update review status error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET ALL USERS ────────────────────────────────────────
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = pageOf(req)
    const offset = (page - 1) * PAGE_SIZE
    const search = safeSearch(req.query.search)
    const plan = String(req.query.plan ?? '')

    let query = supabaseAdmin
      .from('users')
      .select('id, email, full_name, plan, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    if (plan && PLANS.has(plan)) query = query.eq('plan', plan)

    const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      sendError(res, 'Failed to fetch users', 500)
      return
    }
    sendPaginated(res, data || [], count || 0, page, PAGE_SIZE)
  } catch (error) {
    console.error('Admin get users error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE USER ──────────────────────────────────────────
export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { plan, role } = req.body ?? {}

    if (!UUID_RE.test(String(id))) {
      sendError(res, 'Invalid user id', 400)
      return
    }
    if (plan !== undefined && !PLANS.has(plan)) {
      sendError(res, 'Invalid plan', 400)
      return
    }
    if (role !== undefined && !ROLES.has(role)) {
      sendError(res, 'Invalid role', 400)
      return
    }
    if (plan === undefined && role === undefined) {
      sendError(res, 'Nothing to update', 400)
      return
    }
    // An admin can't remove their own admin role (avoids lock-out).
    if (role === 'user' && id === req.user!.userId) {
      sendError(res, 'You can’t remove your own admin role', 400)
      return
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ ...(plan !== undefined && { plan }), ...(role !== undefined && { role }) })
      .eq('id', id)
      .select('id')
      .single()

    if (error || !data) {
      sendError(res, 'User not found', 404)
      return
    }
    sendSuccess(res, null, 200, 'User updated')
  } catch (error) {
    console.error('Update user error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── COMPANY VERIFICATION ─────────────────────────────────
const COMPANY_STATUSES = new Set(['pending', 'verified', 'rejected', 'unverified'])

export async function listCompanies(req: Request, res: Response): Promise<void> {
  try {
    const page = pageOf(req)
    const status = String(req.query.status ?? 'pending')
    let query = supabaseAdmin
      .from('companies')
      .select('id, name, slug, website, domain, domain_match, industry, size, locations, about, verification_status, verification_note, verified_at, updated_at, penalty_level, penalty_source, penalty_reason, suspended, company_scores(applications, opened_pct, replied_7d_pct, ghost_jobs_90d)', { count: 'exact' })
      .order('updated_at', { ascending: false })
    if (COMPANY_STATUSES.has(status)) query = query.eq('verification_status', status)
    else query = query.neq('verification_status', 'unverified')
    const { data, error, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    if (error) throw error

    const ids = (data || []).map((c) => c.id)
    const owners: Record<string, { email: string; full_name: string }[]> = {}
    if (ids.length) {
      const { data: members } = await supabaseAdmin.from('company_members').select('company_id, user:users(email, full_name)').in('company_id', ids)
      for (const mem of members || []) {
        const u = Array.isArray(mem.user) ? mem.user[0] : mem.user
        if (u) (owners[mem.company_id] ||= []).push(u)
      }
    }
    sendPaginated(res, (data || []).map((c) => ({ ...c, members: owners[c.id] || [] })), count || 0, page, PAGE_SIZE)
  } catch (error) {
    console.error('Admin list companies error:', error)
    sendError(res, 'Server error', 500)
  }
}

export async function setCompanyVerification(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id)
    if (!UUID_RE.test(id)) return sendError(res, 'Invalid company id', 400)
    const { status, note } = req.body as { status: 'verified' | 'rejected'; note?: string }
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({
        verification_status: status,
        verification_note: note ? stripHtml(note).slice(0, 500) : null,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name')
      .single()
    if (error || !data) return sendError(res, 'Company not found', 404)

    const { data: members } = await supabaseAdmin.from('company_members').select('user_id').eq('company_id', id)
    await notify(
      (members || []).map((mem) => ({
        user_id: mem.user_id,
        type: 'company_verification',
        title: status === 'verified' ? `${data.name} is verified` : `${data.name} wasn’t verified`,
        body: status === 'verified' ? 'You can now post jobs.' : note ? stripHtml(note).slice(0, 300) : 'Check your company details and try again.',
        link: '/recruiter/company',
      })),
    )
    sendSuccess(res, null, 200, `Company ${status}`)
  } catch (error) {
    console.error('Admin verify company error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── COMPANY PENALTIES ───────────────────────────────────
// level null = hand back to the automatic ghosting rules.
// level 3 = suspended (no publishing). Admin-set levels are never changed
// by the automatic refresh.
export async function setCompanyPenalty(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Company not found', 404)
    const { level, reason } = req.body as { level: number | null; reason: string }
    const patch =
      level === null
        ? { penalty_source: 'auto', penalty_level: 0, penalty_reason: null, suspended: false }
        : { penalty_source: 'admin', penalty_level: level, penalty_reason: level ? stripHtml(reason).slice(0, 500) : null, suspended: level === 3 }
    const { data, error } = await supabaseAdmin.from('companies').update(patch).eq('id', id).select('id, name').maybeSingle()
    if (error) throw error
    if (!data) return sendError(res, 'Company not found', 404)
    if (level === null) await supabaseAdmin.rpc('refresh_accountability')
    const members = await companyMemberIds(id)
    if (level) {
      await notify(
        members.map((user_id) => ({
          user_id,
          type: 'penalty',
          title: level === 3 ? `${data.name} is suspended from posting` : `${data.name} has a hiring warning`,
          body: stripHtml(reason).slice(0, 300),
          link: '/recruiter',
        })),
      )
    }
    sendSuccess(res, { id, ...patch })
  } catch (e) {
    console.error('setCompanyPenalty', e)
    sendError(res, 'Server error', 500)
  }
}
