// ============================================================
// FILE: apps/backend/src/controllers/admin.controller.ts
// PURPOSE: Admin only operations — moderation and user management
// SECURITY: All routes protected by auth + adminOnly middleware
// reviewer_id IS visible here for moderation purposes
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// ─── PLATFORM STATS ───────────────────────────────────────
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const [usersResult, reportsResult, reviewsResult] = await Promise.all([
      supabaseAdmin.from('users').select('id, plan', { count: 'exact' }),
      supabaseAdmin
        .from('reports')
        .select('id', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      supabaseAdmin.from('reviews').select('id', { count: 'exact' }),
    ])

    const users = usersResult.data || []
    const proUsers = users.filter((u) => u.plan !== 'free').length

    sendSuccess(res, {
      total_users: usersResult.count || 0,
      pro_users: proUsers,
      reports_today: reportsResult.count || 0,
      total_reviews: reviewsResult.count || 0,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET ALL REVIEWS WITH REVIEWER IDENTITY ───────────────
export async function getReviews(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit
    const status = req.query.status as string

    let query = supabaseAdmin
      .from('reviews')
      // Admin sees reviewer_id and joins to users for identity
      .select(
        `id, company_name, role_type, overall_rating, review_text,
        moderation_status, created_at, reviewer_id,
        users!reviewer_id (email, full_name)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('moderation_status', status)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch reviews', 500)
      return
    }

    sendPaginated(res, data || [], count || 0, page, limit)
  } catch (error) {
    console.error('Admin get reviews error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE REVIEW STATUS ─────────────────────────────────
export async function updateReviewStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { status } = req.body

    const { error } = await supabaseAdmin
      .from('reviews')
      .update({ moderation_status: status })
      .eq('id', id)

    if (error) {
      sendError(res, 'Failed to update review', 500)
      return
    }

    sendSuccess(res, null, 200, `Review ${status}`)
  } catch (error) {
    console.error('Update review status error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET ALL USERS ────────────────────────────────────────
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit
    const search = req.query.search as string

    let query = supabaseAdmin
      .from('users')
      .select('id, email, full_name, plan, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch users', 500)
      return
    }

    sendPaginated(res, data || [], count || 0, page, limit)
  } catch (error) {
    console.error('Admin get users error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE USER ──────────────────────────────────────────
export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { plan, role } = req.body

    const { error } = await supabaseAdmin
      .from('users')
      .update({ ...(plan && { plan }), ...(role && { role }) })
      .eq('id', id)

    if (error) {
      sendError(res, 'Failed to update user', 500)
      return
    }

    sendSuccess(res, null, 200, 'User updated')
  } catch (error) {
    console.error('Update user error:', error)
    sendError(res, 'Server error', 500)
  }
}