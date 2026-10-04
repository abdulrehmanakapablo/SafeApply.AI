// ============================================================
// FILE: apps/backend/src/controllers/reports.controller.ts
// PURPOSE: Company report generation, history, and demo JD extract.
// Enforces 10 free reports per user (until paid plans ship).
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { processReport } from '../queues/reportQueue'
import { getCached, setCached, CACHE_TTL } from '../services/cache.service'
import { extractJDData } from '../services/groq.service'
import { checkFreeLimit, sendLimitError } from '../utils/usage'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'
import { hashedIp, sha256 } from '../utils/net'
import { pageParam } from '../utils/sanitize'

const DEMO_MAX_CHARS = 8000
const DEMO_MIN_CHARS = 50
const DEMO_OUTPUT_TOKENS = 800
const DEMO_RATE_LIMIT_SECONDS = 30 * 86400 // one guest check per IP per 30 days
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Express 5 types route params as string | string[]; reports only use single ids.
function paramId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

// ─── ANALYZE (authenticated full report) ─────────────────
export async function analyzeCompany(req: Request, res: Response): Promise<void> {
  try {
    const limit = await checkFreeLimit(req.user!.userId, 'reports')
    if (!limit.allowed) return sendLimitError(res, limit, 'reports')

    const body = sanitizeObject(req.body)
    const jd_text = body.jd_text as string | undefined
    const company_name = body.company_name as string | undefined
    const job_title = body.job_title as string | undefined

    const resolvedCompany = (company_name || 'Unknown Company').trim()
    // The cached report includes the decoded job post. Keying only on
    // company + title would serve one user's job post to another, so the
    // key includes a hash of the exact JD text.
    const cacheKey = sha256(`${resolvedCompany.toLowerCase()}|${(job_title || '').toLowerCase()}|${(jd_text || '').trim()}`)

    const cached = await getCached<Record<string, unknown>>('report', cacheKey)
    let reportData: Record<string, unknown>
    let savedReportId: string | null = null
    let savedCreatedAt: string | null = null

    if (cached) {
      reportData = cached
    } else {
      reportData = (await processReport({
        companyName: resolvedCompany,
        jobTitle: job_title,
        jdText: jd_text,
      })) as unknown as Record<string, unknown>
      await setCached('report', cacheKey, reportData, CACHE_TTL.REPORT)
    }

    const { data: savedReport, error } = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: req.user!.userId,
        company_name: resolvedCompany,
        job_title: job_title || null,
        jd_text: jd_text || null,
        report_data: reportData,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Save report error:', error)
    } else if (savedReport) {
      savedReportId = savedReport.id
      savedCreatedAt = savedReport.created_at
    }

    sendSuccess(res, {
      id: savedReportId,
      company_name: resolvedCompany,
      job_title: job_title || null,
      report_data: reportData,
      created_at: savedCreatedAt || new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analyze company error:', error)
    sendError(res, 'Failed to generate report', 500)
  }
}

// ─── DEMO JD EXTRACT (anonymous, 1 per IP per 30 days) ──
export async function demoExtractJD(req: Request, res: Response): Promise<void> {
  try {
    const body = sanitizeObject(req.body)
    const jd_text = body.jd_text as string | undefined

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
        'JD_TOO_SHORT',
      )
      return
    }

    if (trimmed.length > DEMO_MAX_CHARS) {
      sendError(
        res,
        `Job description is too long (${trimmed.length.toLocaleString()} characters). The free demo accepts up to ${DEMO_MAX_CHARS.toLocaleString()}.`,
        400,
        'JD_TOO_LONG',
      )
      return
    }

    // Raw IPs are never stored: the key is an HMAC of the IP.
    const rateLimitKey = `ip_${hashedIp(req)}`

    if (IS_PRODUCTION) {
      const alreadyUsed = await getCached<boolean>('demo_jd', rateLimitKey)
      if (alreadyUsed) {
        sendError(
          res,
          'You have used your free extraction. Sign up to continue.',
          429,
          'DEMO_EXHAUSTED',
        )
        return
      }
    }

    const extractedJD = await extractJDData(trimmed, {
      maxTokens: DEMO_OUTPUT_TOKENS,
    })

    if (!extractedJD) {
      sendError(res, 'Extraction failed. Please try again.', 500, 'EXTRACTION_FAILED')
      return
    }

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
    const page = pageParam(req.query.page)
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
    const id = paramId(req.params.id)

    if (!id) {
      sendError(res, 'Invalid report id', 400)
      return
    }

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

    sendSuccess(res, {
      id: data.id,
      company_name: data.company_name,
      job_title: data.job_title,
      report_data: data.report_data,
      created_at: data.created_at,
      share_id: data.share_id ?? null,
    })
  } catch (error) {
    console.error('Get report error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── DELETE REPORT ────────────────────────────────────────
export async function deleteReport(req: Request, res: Response): Promise<void> {
  try {
    const id = paramId(req.params.id)

    if (!id) {
      sendError(res, 'Invalid report id', 400)
      return
    }

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
