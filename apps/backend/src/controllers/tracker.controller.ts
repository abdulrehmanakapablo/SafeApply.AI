// ============================================================
// FILE: apps/backend/src/controllers/tracker.controller.ts
// PURPOSE: Job application tracker CRUD.
// Enforces 10 free applications per user (until paid plans ship).
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { checkFreeLimit, sendLimitError } from '../utils/usage'
import { sanitizeObject, safeSearchTerm, pageParam } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

const STATUSES = new Set(['saved', 'applied', 'screening', 'interviewing', 'offered', 'rejected', 'ghosted'])
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

// ─── GET ALL APPLICATIONS ─────────────────────────────────
export async function getApplications(req: Request, res: Response): Promise<void> {
  try {
    const page = pageParam(req.query.page)
    const requestedLimit = parseInt(req.query.limit as string) || DEFAULT_LIMIT
    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT)
    const offset = (page - 1) * limit
    const status = String(req.query.status ?? '')
    // Search text goes into a PostgREST filter string; strip its syntax chars
    // so it can't add or change filter clauses.
    const search = safeSearchTerm(req.query.search)

    let query = supabaseAdmin
      .from('applications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user!.userId)
      .order('created_at', { ascending: false })

    if (status && STATUSES.has(status)) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,job_title.ilike.%${search}%`,
      )
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch applications', 500)
      return
    }

    // Read receipts for applications sent through the SafeApply job board.
    const linked = (data || []).filter((a) => a.job_application_id).map((a) => a.job_application_id as string)
    const receipts: Record<string, { cv_opened_at: string | null; first_response_at: string | null; no_response: boolean; stage: string }> = {}
    if (linked.length) {
      const { data: rows } = await supabaseAdmin
        .from('job_applications')
        .select('id, cv_opened_at, first_response_at, no_response, stage')
        .in('id', linked)
        .eq('user_id', req.user!.userId)
      for (const r of rows || []) receipts[r.id] = { cv_opened_at: r.cv_opened_at, first_response_at: r.first_response_at, no_response: r.no_response, stage: r.stage }
    }
    sendPaginated(res, (data || []).map((a) => ({ ...a, receipt: a.job_application_id ? receipts[a.job_application_id] || null : null })), count || 0, page, limit)
  } catch (error) {
    console.error('Get applications error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── CREATE APPLICATION ───────────────────────────────────
export async function createApplication(req: Request, res: Response): Promise<void> {
  try {
    const limit = await checkFreeLimit(req.user!.userId, 'applications')
    if (!limit.allowed) return sendLimitError(res, limit, 'applications')

    const body = sanitizeObject(req.body)

    const { data, error } = await supabaseAdmin
      .from('applications')
      // user_id last so nothing in the body can override ownership.
      .insert({
        ...body,
        user_id: req.user!.userId,
      })
      .select()
      .single()

    if (error) {
      console.error('Create application DB error:', error)
      sendError(res, 'Failed to create application', 500)
      return
    }

    await supabaseAdmin.from('application_timeline').insert({
      application_id: data.id,
      status: data.status,
    })

    sendSuccess(res, data, 201)
  } catch (error) {
    console.error('Create application error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET SINGLE APPLICATION ───────────────────────────────
export async function getApplication(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    if (!isValidUuid(id)) {
      sendError(res, 'Invalid application id', 400)
      return
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .single()

    if (error || !data) {
      sendError(res, 'Application not found', 404)
      return
    }

    const [timelineResult, commResult] = await Promise.all([
      supabaseAdmin
        .from('application_timeline')
        .select('*')
        .eq('application_id', id)
        .order('changed_at', { ascending: true }),
      supabaseAdmin
        .from('communication_log')
        .select('*')
        .eq('application_id', id)
        .order('date', { ascending: false }),
    ])

    sendSuccess(res, {
      ...data,
      timeline: timelineResult.data || [],
      communication_log: commResult.data || [],
    })
  } catch (error) {
    console.error('Get application error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE APPLICATION ───────────────────────────────────
export async function updateApplication(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const body = sanitizeObject(req.body)

    if (!isValidUuid(id)) {
      sendError(res, 'Invalid application id', 400)
      return
    }

    const { data: current } = await supabaseAdmin
      .from('applications')
      .select('status')
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .single()

    if (!current) {
      sendError(res, 'Application not found', 404)
      return
    }

    const { data, error } = await supabaseAdmin
      .from('applications')
      .update({ ...body, user_id: req.user!.userId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .select()
      .single()

    if (error) {
      console.error('Update application DB error:', error)
      sendError(res, 'Failed to update application', 500)
      return
    }

    if (body.status && body.status !== current.status) {
      await supabaseAdmin.from('application_timeline').insert({
        application_id: id,
        status: body.status,
      })
    }

    sendSuccess(res, data)
  } catch (error) {
    console.error('Update application error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── DELETE APPLICATION ───────────────────────────────────
export async function deleteApplication(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    if (!isValidUuid(id)) {
      sendError(res, 'Invalid application id', 400)
      return
    }

    const { error } = await supabaseAdmin
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.userId)

    if (error) {
      console.error('Delete application DB error:', error)
      sendError(res, 'Failed to delete application', 500)
      return
    }

    sendSuccess(res, null, 200, 'Application deleted')
  } catch (error) {
    console.error('Delete application error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── ADD COMMUNICATION LOG ────────────────────────────────
export async function addCommunication(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { type, notes, date } = sanitizeObject(req.body)

    if (!isValidUuid(id)) {
      sendError(res, 'Invalid application id', 400)
      return
    }

    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .single()

    if (!app) {
      sendError(res, 'Application not found', 404)
      return
    }

    const { data, error } = await supabaseAdmin
      .from('communication_log')
      .insert({ application_id: id, type, notes, date })
      .select()
      .single()

    if (error) {
      console.error('Add communication DB error:', error)
      sendError(res, 'Failed to add communication log', 500)
      return
    }

    sendSuccess(res, data, 201)
  } catch (error) {
    console.error('Add communication error:', error)
    sendError(res, 'Server error', 500)
  }
}