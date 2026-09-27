// ============================================================
// FILE: apps/backend/src/controllers/tracker.controller.ts
// PURPOSE: Job application tracker CRUD operations
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// ─── GET ALL APPLICATIONS ─────────────────────────────────
export async function getApplications(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit
    const status = req.query.status as string
    const search = req.query.search as string

    let query = supabaseAdmin
      .from('applications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user!.userId)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,job_title.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch applications', 500)
      return
    }

    sendPaginated(res, data || [], count || 0, page, limit)
  } catch (error) {
    console.error('Get applications error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── CREATE APPLICATION ───────────────────────────────────
export async function createApplication(req: Request, res: Response): Promise<void> {
  try {
    const body = sanitizeObject(req.body)

    const { data, error } = await supabaseAdmin
      .from('applications')
      .insert({
        user_id: req.user!.userId,
        ...body,
      })
      .select()
      .single()

    if (error) {
      sendError(res, 'Failed to create application', 500)
      return
    }

    // Log initial status to timeline
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

    // Also fetch timeline and communication log
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

    // First get current application to check status change
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
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .select()
      .single()

    if (error) {
      sendError(res, 'Failed to update application', 500)
      return
    }

    // Log status change to timeline if status changed
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

    const { error } = await supabaseAdmin
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.userId)

    if (error) {
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

    // Verify user owns this application
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
      sendError(res, 'Failed to add communication log', 500)
      return
    }

    sendSuccess(res, data, 201)
  } catch (error) {
    console.error('Add communication error:', error)
    sendError(res, 'Server error', 500)
  }
}