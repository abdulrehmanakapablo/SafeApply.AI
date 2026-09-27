// ============================================================
// FILE: apps/backend/src/controllers/reviews.controller.ts
// PURPOSE: Anonymous company reviews — read and write
// SECURITY: reviewer_id NEVER included in public responses
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError, sendPaginated } from '../utils/response'

// Helper to build company slug from name
function buildSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── GET COMPANIES ────────────────────────────────────────
export async function getCompanies(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit
    const search = req.query.search as string
    const minRating = parseFloat(req.query.min_rating as string) || 0

    let query = supabaseAdmin
      .from('companies')
      .select('id, slug, name, industry, avg_overall_rating, avg_culture_rating, avg_interview_rating, total_reviews', { count: 'exact' })
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
export async function getCompany(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !company) {
      sendError(res, 'Company not found', 404)
      return
    }

    sendSuccess(res, company)
  } catch (error) {
    console.error('Get company error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET COMPANY REVIEWS ──────────────────────────────────
export async function getCompanyReviews(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = 20
    const offset = (page - 1) * limit

    // Get company id from slug
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
        { count: 'exact' }
      )
      .eq('company_id', company.id)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      sendError(res, 'Failed to fetch reviews', 500)
      return
    }

    sendPaginated(res, data || [], count || 0, page, limit)
  } catch (error) {
    console.error('Get company reviews error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── CREATE REVIEW ────────────────────────────────────────
export async function createReview(req: Request, res: Response): Promise<void> {
  try {
    const body = sanitizeObject(req.body)
    const slug = buildSlug(body.company_name)

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
        reviewer_id: req.user!.userId, // Stored but never returned publicly
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
      sendError(res, 'Failed to submit review', 500)
      return
    }

    // Update company aggregate scores
    await updateCompanyAggregates(companyId)

    sendSuccess(res, null, 201, 'Review submitted successfully. It will appear after moderation.')
  } catch (error) {
    console.error('Create review error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── MARK REVIEW AS HELPFUL ───────────────────────────────
export async function markHelpful(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    await supabaseAdmin.rpc('increment_helpful_count', { review_id: id })

    sendSuccess(res, null, 200, 'Marked as helpful')
  } catch (error) {
    console.error('Mark helpful error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── HELPER: Update company aggregate scores ──────────────
async function updateCompanyAggregates(companyId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('reviews')
      .select('overall_rating, culture_rating, interview_rating')
      .eq('company_id', companyId)
      .eq('moderation_status', 'approved')

    if (!data || data.length === 0) return

    const total = data.length
    const avgOverall = data.reduce((sum, r) => sum + r.overall_rating, 0) / total
    const avgCulture = data.reduce((sum, r) => sum + r.culture_rating, 0) / total
    const avgInterview = data.reduce((sum, r) => sum + r.interview_rating, 0) / total

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