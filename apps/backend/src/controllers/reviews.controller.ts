// ============================================================
// FILE: apps/backend/src/controllers/reviews.controller.ts
// PURPOSE: Anonymous company reviews — read and write
// SECURITY: reviewer_id NEVER included in public responses
// Writing reviews is unlimited for signed-up users (rate limited per hour).
// ============================================================

import { Request, Response } from 'express'
import { createHash } from 'crypto'
import { supabaseAdmin } from '../config/supabase'
import { sanitizeObject, safeSearchTerm, pageParam, uuidParam } from '../utils/sanitize'
import { getCached, setCached } from '../services/cache.service'
import { companyResponseRate } from '../utils/recruiter'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// Helper to build company slug from name
function buildSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
  // Names with no latin letters (e.g. 日本電気) would give an empty slug.
  return slug || `company-${createHash('sha256').update(name.trim().toLowerCase()).digest('hex').slice(0, 12)}`
}

// ─── GET COMPANIES ────────────────────────────────────────
export async function getCompanies(req: Request, res: Response): Promise<void> {
  try {
    const page = pageParam(req.query.page)
    const limit = 20
    const offset = (page - 1) * limit
    const search = safeSearchTerm(req.query.search)
    const minRating = Math.min(5, Math.max(0, parseFloat(String(req.query.min_rating)) || 0))

    let query = supabaseAdmin
      .from('companies')
      .select(
        'id, slug, name, industry, avg_overall_rating, avg_culture_rating, avg_interview_rating, total_reviews',
        { count: 'exact' },
      )
      .gt('total_reviews', 0)
      .gte('avg_overall_rating', minRating)
      .order('total_reviews', { ascending: false })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch companies', 500)
      return
    }

    sendPaginated(res, data || [], count || 0, page, limit)
  } catch (error) {
    console.error('Get companies error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET COMPANY DETAIL ───────────────────────────────────
const SLUG_RE = /^[a-z0-9-]{1,200}$/

export async function getCompany(req: Request, res: Response): Promise<void> {
  try {
    const slug = String(req.params.slug ?? '')
    if (!SLUG_RE.test(slug)) {
      sendError(res, 'Company not found', 404)
      return
    }

    // Explicit public columns: internal verification notes and domain-check
    // results stay private.
    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('id, slug, name, industry, avg_overall_rating, avg_culture_rating, avg_interview_rating, total_reviews, website, about, size, locations, verification_status, penalty_level, trust_level, company_scores(applications, opened_pct, replied_7d_pct, no_response_pct, ghost_jobs_90d, hires_here, hires_verified, interviews_confirmed)')
      .eq('slug', slug)
      .single()

    if (error || !company) {
      sendError(res, 'Company not found', 404)
      return
    }

    const verified = company.verification_status === 'verified'
    const [jobsRes, response] = verified
      ? await Promise.all([
          supabaseAdmin
            .from('jobs')
            .select('id, title, location, work_mode, employment_type')
            .eq('company_id', company.id)
            .eq('status', 'open')
            .gte('last_activity_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
            .order('last_activity_at', { ascending: false })
            .limit(10),
          companyResponseRate(company.id),
        ])
      : [{ data: [] }, { rate: null, sample: 0 }]

    const { verification_status: _vs, penalty_level, company_scores, ...pub } = company
    void _vs
    const record = Array.isArray(company_scores) ? company_scores[0] : company_scores
    sendSuccess(res, {
      ...pub,
      record: record || null,
      // Level 2+ = repeated ghosting; shown publicly as a warning.
      ghost_warning: (penalty_level || 0) >= 2,
      badges: verified ? ((await supabaseAdmin.from('badges_earned').select('badge_key, earned_at').eq('subject_type', 'company').eq('subject_id', company.id)).data || []) : [],
      verified,
      // Only verified profiles show employer-written text.
      website: verified ? company.website : null,
      about: verified ? company.about : null,
      open_jobs: jobsRes.data || [],
      response_rate: response.rate,
      response_sample: response.sample,
    })
  } catch (error) {
    console.error('Get company error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET COMPANY REVIEWS ──────────────────────────────────
export async function getCompanyReviews(req: Request, res: Response): Promise<void> {
  try {
    const slug = String(req.params.slug ?? '')
    if (!SLUG_RE.test(slug)) {
      sendError(res, 'Company not found', 404)
      return
    }
    const page = pageParam(req.query.page)
    const limit = 20
    const offset = (page - 1) * limit

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!company) {
      sendError(res, 'Company not found', 404)
      return
    }

    // SECURITY: Never select reviewer_id — it stays in database only
    const { data, error, count } = await supabaseAdmin
      .from('reviews')
      .select(
        'id, company_name, relationship, role_type, overall_rating, culture_rating, interview_rating, would_recommend, review_text, interview_process, salary_min, salary_max, helpful_count, created_at',
        { count: 'exact' },
      )
      .eq('company_id', company.id)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch reviews', 500)
      return
    }

    // Attach the company's public reply (author is never exposed).
    const ids = (data || []).map((r) => r.id)
    const replies: Record<string, { body: string; updated_at: string }> = {}
    if (ids.length) {
      const { data: rows } = await supabaseAdmin.from('review_replies').select('review_id, body, updated_at').in('review_id', ids)
      for (const r of rows || []) replies[r.review_id] = { body: r.body, updated_at: r.updated_at }
    }

    sendPaginated(res, (data || []).map((r) => ({ ...r, reply: replies[r.id] || null })), count || 0, page, limit)
  } catch (error) {
    console.error('Get company reviews error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── CREATE REVIEW ────────────────────────────────────────
export async function createReview(req: Request, res: Response): Promise<void> {
  try {
    // Writing reviews is unlimited for signed-up users (auth route).
    const body = sanitizeObject(req.body)
    const slug = buildSlug(body.company_name as string)

    // Find or create company record
    let companyId: string

    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingCompany) {
      companyId = existingCompany.id
    } else {
      const { data: newCompany, error: createError } = await supabaseAdmin
        .from('companies')
        .insert({ name: body.company_name, slug })
        .select()
        .single()

      if (createError || !newCompany) {
        sendError(res, 'Failed to process company', 500)
        return
      }
      companyId = newCompany.id
    }

    // Insert review — store reviewer_id for admin moderation only
    const { error: reviewError } = await supabaseAdmin
      .from('reviews')
      .insert({
        company_id: companyId,
        company_name: body.company_name,
        reviewer_id: req.user!.userId,
        relationship: body.relationship,
        role_type: body.role_type,
        overall_rating: body.overall_rating,
        culture_rating: body.culture_rating,
        interview_rating: body.interview_rating,
        would_recommend: body.would_recommend,
        review_text: body.review_text,
        interview_process: body.interview_process || null,
        salary_min: body.salary_min || null,
        salary_max: body.salary_max || null,
        moderation_status: 'pending',
      })

    if (reviewError) {
      console.error('Insert review DB error:', reviewError)
      sendError(res, 'Failed to submit review', 500)
      return
    }

    // Update company aggregate scores
    await updateCompanyAggregates(companyId)

    sendSuccess(
      res,
      null,
      201,
      'Review submitted successfully. It will appear after moderation.',
    )
  } catch (error) {
    console.error('Create review error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── MARK REVIEW AS HELPFUL ───────────────────────────────
export async function markHelpful(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) {
      sendError(res, 'Invalid review id', 400)
      return
    }

    // One vote per user per review (remembered for a year in Redis).
    const voteKey = `${req.user!.userId}:${id}`
    if (await getCached<boolean>('helpful', voteKey)) {
      sendSuccess(res, null, 200, 'Already marked as helpful')
      return
    }

    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('id', id)
      .eq('moderation_status', 'approved')
      .maybeSingle()
    if (!review) {
      sendError(res, 'Review not found', 404)
      return
    }

    await supabaseAdmin.rpc('increment_helpful_count', { review_id: id })
    await setCached('helpful', voteKey, true, 365 * 86400)

    sendSuccess(res, null, 200, 'Marked as helpful')
  } catch (error) {
    console.error('Mark helpful error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── HELPER: Update company aggregate scores ──────────────
export async function updateCompanyAggregates(companyId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('reviews')
      .select('overall_rating, culture_rating, interview_rating')
      .eq('company_id', companyId)
      .eq('moderation_status', 'approved')

    const rows = data || []
    const total = rows.length
    const avg = (k: 'overall_rating' | 'culture_rating' | 'interview_rating') =>
      total ? rows.reduce((sum, r) => sum + (r[k] || 0), 0) / total : 0
    const avgOverall = avg('overall_rating')
    const avgCulture = avg('culture_rating')
    const avgInterview = avg('interview_rating')

    await supabaseAdmin
      .from('companies')
      .update({
        avg_overall_rating: Math.round(avgOverall * 10) / 10,
        avg_culture_rating: Math.round(avgCulture * 10) / 10,
        avg_interview_rating: Math.round(avgInterview * 10) / 10,
        total_reviews: total,
      })
      .eq('id', companyId)
  } catch (error) {
    console.error('Update company aggregates error:', error)
  }
}