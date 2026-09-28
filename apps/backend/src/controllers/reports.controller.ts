// ============================================================
// FILE: apps/backend/src/controllers/reports.controller.ts
// PURPOSE: Company intelligence report generation, history, and the
//          anonymous landing-page demo JD extractor.
//
// PERMANENT RATE LIMIT POLICY
// ─────────────────────────────
// Production (NODE_ENV=production):
//   • 1 free demo extraction per IP per 24h (Upstash Redis)
//   • Input capped at 8,000 chars (≈2,000 tokens)
//   • Output declared at 800 tokens
//   • Total cost per visitor: ~2,800 tokens — well under Groq's
//     8,000 TPM free-tier ceiling
//
// Development (NODE_ENV=development):
//   • Rate limit BYPASSED so the demo can be tested freely
//   • Input/output caps still enforced (catches bugs)
//   • Nothing written to Redis — no stale keys to clean up
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { processReport } from '../queues/reportQueue'
import { getCached, setCached, CACHE_TTL } from '../services/cache.service'
import { extractJDData } from '../services/groq.service'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// ─── Tunables ─────────────────────────────────────────────
// Chars allowed in the anonymous demo. ~4 chars per token, so 8000
// chars ≈ 2000 input tokens. Plus 800 declared output tokens = 2800
// total, safely under Groq's 8000 TPM free-tier ceiling.
const DEMO_MAX_CHARS = 8000
const DEMO_MIN_CHARS = 50
const DEMO_OUTPUT_TOKENS = 800
const DEMO_RATE_LIMIT_SECONDS = 86400 // 24h

// Only production enforces the per-IP rate limit.
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

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

// ─── DEMO JD EXTRACT (anonymous) ──────────────────────────
// Landing page free try. No auth required.
//
// Rate limit is IP-based and enforced ONLY in production. Dev mode
// skips the check entirely so testing doesn't lock you out for 24h.
export async function demoExtractJD(req: Request, res: Response): Promise<void> {
  try {
    const { jd_text } = sanitizeObject(req.body)

    // ── Input validation ─────────────────────────────────
    if (!jd_text || typeof jd_text !== 'string') {
      sendError(res, 'Job description is required', 400)
      return
    }

    const trimmed = jd_text.trim()

    if (trimmed.length < DEMO_MIN_CHARS) {
      sendError(
        res,
        `Job description is too short — paste at least ${DEMO_MIN_CHARS} characters.`,
        400,
        'JD_TOO_SHORT'
      )
      return
    }

    if (trimmed.length > DEMO_MAX_CHARS) {
      sendError(
        res,
        `Job description is too long (${trimmed.length.toLocaleString()} characters). The free demo accepts up to ${DEMO_MAX_CHARS.toLocaleString()} — sign up to analyze full postings.`,
        400,
        'JD_TOO_LONG'
      )
      return
    }

    // ── Rate limit (production only) ─────────────────────
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(
      /[:.]/g,
      '_'
    )
    const rateLimitKey = `ip_${ip}`

    if (IS_PRODUCTION) {
      const alreadyUsed = await getCached<boolean>('demo_jd', rateLimitKey)

      if (alreadyUsed) {
        sendError(
          res,
          'You have used your free extraction. Sign up to continue with full reports.',
          429,
          'DEMO_EXHAUSTED'
        )
        return
      }
    }

    // ── Run the extraction ───────────────────────────────
    const extractedJD = await extractJDData(trimmed, {
      maxTokens: DEMO_OUTPUT_TOKENS,
    })

    if (!extractedJD) {
      sendError(
        res,
        'Extraction failed. Please try again in a moment.',
        500,
        'EXTRACTION_FAILED'
      )
      return
    }

    // ── Mark used (production only) ──────────────────────
    // Only set AFTER a successful extraction, so a transient Groq
    // failure doesn't burn the visitor's free try.
    if (IS_PRODUCTION) {
      await setCached('demo_jd', rateLimitKey, true, DEMO_RATE_LIMIT_SECONDS)
    }

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