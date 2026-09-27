// ============================================================
// FILE: apps/backend/src/controllers/reports.controller.ts
// PURPOSE: Company intelligence report generation and history
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { processReport } from '../queues/reportQueue'
import { getCached, setCached, CACHE_TTL } from '../services/cache.service'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// ─── ANALYZE ──────────────────────────────────────────────
export async function analyzeCompany(req: Request, res: Response): Promise<void> {
  try {
    const { jd_text, company_name, job_title } = sanitizeObject(req.body)

    // Extract company name from JD if not provided separately
    const resolvedCompany = company_name || 'Unknown Company'
    const cacheKey = `${resolvedCompany}-${job_title || 'general'}`

    // Check report cache first
    const cached = await getCached('report', cacheKey)
    if (cached) {
      sendSuccess(res, cached)
      return
    }

    // Process report — runs all API calls in parallel
    const reportData = await processReport({
      companyName: resolvedCompany,
      jobTitle: job_title,
      jdText: jd_text,
    })

    // Save report to database
    const { data: savedReport, error } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: req.user!.userId,
        company_name: resolvedCompany,
        job_title: job_title || null,
        jd_text: jd_text || null,
        report_data: reportData,
      })
      .select()
      .single()

    if (error) {
      console.error('Save report error:', error)
    }

    // Cache the report data
    await setCached('report', cacheKey, reportData, CACHE_TTL.REPORT)

    sendSuccess(res, {
      id: savedReport?.id || null,
      company_name: resolvedCompany,
      job_title: job_title || null,
      report_data: reportData,
      created_at: savedReport?.created_at || new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analyze company error:', error)
    sendError(res, 'Failed to generate report', 500)
  }
}

// ─── GET HISTORY ──────────────────────────────────────────
export async function getReportHistory(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit

    const { data, error, count } = await supabaseAdmin
      .from('reports')
      .select('id, company_name, job_title, created_at', { count: 'exact' })
      .eq('user_id', req.user!.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch report history', 500)
      return
    }

    sendPaginated(res, data || [], count || 0, page, limit)
  } catch (error) {
    console.error('Get report history error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET SINGLE REPORT ────────────────────────────────────
export async function getReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .single()

    if (error || !data) {
      sendError(res, 'Report not found', 404)
      return
    }

    sendSuccess(res, data)
  } catch (error) {
    console.error('Get report error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── DELETE REPORT ────────────────────────────────────────
export async function deleteReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    const { error } = await supabaseAdmin
      .from('reports')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.userId)

    if (error) {
      sendError(res, 'Failed to delete report', 500)
      return
    }

    sendSuccess(res, null, 200, 'Report deleted')
  } catch (error) {
    console.error('Delete report error:', error)
    sendError(res, 'Server error', 500)
  }
}