// ============================================================
// FILE: apps/backend/src/controllers/reports.controller.ts
// PURPOSE: Company intelligence report generation, history, and the
//          anonymous landing-page demo JD extractor.
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { processReport } from '../queues/reportQueue'
import { getCached, setCached, CACHE_TTL } from '../services/cache.service'
import { extractJDData } from '../services/groq.service'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// ─── ANALYZE (authenticated, full report) ─────────────────
export async function analyzeCompany(req: Request, res: Response): Promise<void> {
  try {
    const { jd_text, company_name, job_title } = sanitizeObject(req.body)

    const resolvedCompany = company_name || 'Unknown Company'
    const cacheKey = `${resolvedCompany}-${job_title || 'general'}`

    const cached = await getCached('report', cacheKey)
    if (cached) {
      sendSuccess(res, cached)
      return
    }

    const reportData = await processReport({
      companyName: resolvedCompany,
      jobTitle: job_title,
      jdText: jd_text,
    })

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

// ─── DEMO JD EXTRACT (anonymous, 1 per IP per 24h) ───────
// Landing page free try. No auth required.
//
// Token-smart by design:
//   • Input capped at 3,500 chars (~1,000 tokens)
//   • Output capped at 800 declared tokens
//   • 1 request per IP per 24h (Upstash Redis)
//   • Only JD extraction runs — no NewsAPI, GitHub, or SerpAPI calls
//
// A single demo visit costs roughly 1,500 tokens total — well under
// Groq's 8,000 TPM free-tier ceiling.
export async function demoExtractJD(req: Request, res: Response): Promise<void> {
  try {
    const { jd_text } = sanitizeObject(req.body)

    if (!jd_text || typeof jd_text !== 'string') {
      sendError(res, 'Job description is required', 400)
      return
    }

    const trimmed = jd_text.trim()

    if (trimmed.length < 50) {
      sendError(
        res,
        'Job description is too short — paste at least 50 characters.',
        400
      )
      return
    }

    if (trimmed.length > 3500) {
      sendError(
        res,
        'Job description is too long for the free demo. Sign up to analyze full postings.',
        400,
        'JD_TOO_LONG'
      )
      return
    }

    // IP-based rate limit — 1 free extraction per IP per 24h.
    // Dots and colons stripped so the key is Redis-safe.
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(
      /[:.]/g,
      '_'
    )
    const cacheKey = `ip_${ip}`
    const alreadyUsed = await getCached<boolean>('demo_jd', cacheKey)

    if (alreadyUsed) {
      sendError(
        res,
        'You have used your free extraction. Sign up to continue with full reports.',
        429,
        'DEMO_EXHAUSTED'
      )
      return
    }

    const extractedJD = await extractJDData(trimmed, { maxTokens: 800 })

    if (!extractedJD) {
      sendError(res, 'Extraction failed. Please try again in a moment.', 500)
      return
    }

    // Only mark the IP as used AFTER a successful extraction — so a
    // transient Groq failure doesn't eat the visitor's one free try.
    await setCached('demo_jd', cacheKey, true, 86400)

    sendSuccess(res, { extracted_jd: extractedJD })
  } catch (error) {
    console.error('Demo JD extract error:', error)
    sendError(res, 'Server error', 500)
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