// ============================================================
// FILE: apps/backend/src/controllers/jobs.controller.ts
// PURPOSE: Public jobs board + job detail + applying (seekers).
// Only jobs that are open, from a verified company, and touched by the
// company in the last 60 days are public: stale "ghost" jobs drop off
// automatically.
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendPaginated, sendSuccess } from '../utils/response'
import { pageParam, safeSearchTerm, sanitizeObject, uuidParam } from '../utils/sanitize'
import { companyMemberIds, companyResponseRate, keywordMatch, notify } from '../utils/recruiter'

const PAGE = 20
const FRESH_DAYS = 60
const freshCutoff = () => new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString()

const PUBLIC_JOB =
  'id, title, location, work_mode, employment_type, salary_min, salary_max, currency, salary_period, last_activity_at, created_at, ghost_flag, company:companies!inner(id, name, slug, verification_status, suspended, company_scores(opened_pct, replied_7d_pct))'

export async function listJobs(req: Request, res: Response): Promise<void> {
  try {
    const page = pageParam(req.query.page, 200)
    const q = safeSearchTerm(req.query.q)
    const loc = safeSearchTerm(req.query.location, 60)
    const mode = String(req.query.work_mode ?? '')
    const type = String(req.query.employment_type ?? '')

    let query = supabaseAdmin
      .from('jobs')
      .select(PUBLIC_JOB, { count: 'exact' })
      .eq('status', 'open')
      .eq('company.verification_status', 'verified')
      .eq('company.suspended', false)
      .gte('last_activity_at', freshCutoff())
      .order('last_activity_at', { ascending: false })

    if (q) query = query.ilike('title', `%${q}%`)
    if (loc) query = query.ilike('location', `%${loc}%`)
    if (['onsite', 'hybrid', 'remote'].includes(mode)) query = query.eq('work_mode', mode)
    if (['full_time', 'part_time', 'contract', 'internship'].includes(type)) query = query.eq('employment_type', type)

    const { data, error, count } = await query.range((page - 1) * PAGE, page * PAGE - 1)
    if (error) throw error
    sendPaginated(
      res,
      (data || []).map(({ company, ...j }) => {
        const c = Array.isArray(company) ? company[0] : company
        const sc = Array.isArray(c?.company_scores) ? c.company_scores[0] : c?.company_scores
        return { ...j, company: { name: c?.name, slug: c?.slug }, record: { opened_pct: sc?.opened_pct ?? null, replied_7d_pct: sc?.replied_7d_pct ?? null } }
      }),
      count || 0,
      page,
      PAGE,
    )
  } catch (e) {
    console.error('listJobs', e)
    sendError(res, 'Couldn’t load jobs.', 500)
  }
}

async function loadPublicJob(id: string) {
  const { data } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, title, description, location, work_mode, employment_type, salary_min, salary_max, currency, salary_period, status, last_activity_at, created_at, ghost_flag, apps_count, opened_count, outcome, company:companies!inner(id, name, slug, website, about, size, locations, industry, verification_status, suspended, penalty_level, avg_overall_rating, total_reviews)',
    )
    .eq('id', id)
    .eq('company.verification_status', 'verified')
    .eq('company.suspended', false)
    .maybeSingle()
  if (!data) return null
  const company = Array.isArray(data.company) ? data.company[0] : data.company
  if (!company) return null
  const live = data.status === 'open' && new Date(data.last_activity_at).getTime() >= Date.now() - FRESH_DAYS * 86_400_000
  return { ...data, company, live }
}

export async function getJob(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Job not found', 404)
    const job = await loadPublicJob(id)
    if (!job || (!job.live && job.status !== 'closed')) return sendError(res, 'This job isn’t open any more.', 404)

    const [response, { data: score }] = await Promise.all([
      companyResponseRate(job.company.id),
      supabaseAdmin.from('company_scores').select('applications, opened_pct, replied_7d_pct, no_response_pct, ghost_jobs_90d, hires_here, hires_verified, interviews_confirmed').eq('company_id', job.company.id).maybeSingle(),
    ])
    let applied: { id: string; stage: string } | null = null
    if (req.user) {
      const { data } = await supabaseAdmin.from('job_applications').select('id, stage').eq('job_id', id).eq('user_id', req.user.userId).maybeSingle()
      applied = data
    }
    const { id: companyId, ...company } = job.company
    void companyId
    sendSuccess(res, { ...job, company, response_rate: response.rate, response_sample: response.sample, record: score || null, applied })
  } catch (e) {
    console.error('getJob', e)
    sendError(res, 'Server error', 500)
  }
}

export async function applyToJob(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Job not found', 404)
    const job = await loadPublicJob(id)
    if (!job || !job.live) return sendError(res, 'This job isn’t accepting applications.', 400)

    const userId = req.user!.userId
    const { cv_text, cover_note } = sanitizeObject(req.body) as { cv_text: string; cover_note?: string }
    const score = keywordMatch(cv_text, `${job.title} ${job.description}`)

    const { data: app, error } = await supabaseAdmin
      .from('job_applications')
      .insert({ job_id: id, user_id: userId, cv_text, cover_note: cover_note || '', match_score: score })
      .select('id, stage, created_at')
      .single()
    if (error) {
      if ((error as { code?: string }).code === '23505') return sendError(res, 'You’ve already applied to this job.', 409)
      throw error
    }

    // Tracker card for the seeker, linked so recruiter updates sync to it.
    const today = new Date().toISOString().slice(0, 10)
    const { data: card } = await supabaseAdmin
      .from('applications')
      .insert({
        user_id: userId,
        company_name: job.company.name,
        job_title: job.title,
        date_applied: today,
        location: job.location || null,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        status: 'applied',
        jd_text: job.description.slice(0, 10000),
        match_score: score,
        job_application_id: app.id,
      })
      .select('id')
      .single()

    await Promise.all([
      supabaseAdmin.from('application_events').insert({ application_id: app.id, stage: 'applied', changed_by: userId }),
      card ? supabaseAdmin.from('application_timeline').insert({ application_id: card.id, status: 'applied' }) : Promise.resolve(),
      companyMemberIds(job.company.id).then((ids) =>
        notify(
          ids.map((uid) => ({
            user_id: uid,
            type: 'new_applicant',
            title: `New applicant for ${job.title}`,
            body: `Keyword match ${score}%.`,
            link: `/recruiter/applicants/${app.id}`,
          })),
        ),
      ),
    ])

    sendSuccess(res, { id: app.id, stage: app.stage, tracker_id: card?.id ?? null }, 201, 'Application sent')
  } catch (e) {
    console.error('applyToJob', e)
    sendError(res, 'Couldn’t send your application.', 500)
  }
}

/** The candidate's own application: receipts, stages, outcome. */
export async function getMyJobApplication(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Application not found', 404)
    const { data: app } = await supabaseAdmin
      .from('job_applications')
      .select('id, stage, created_at, cv_opened_at, first_response_at, no_response, cover_note, hire_confirmed, job:jobs!inner(id, title, status, outcome, closed_at, company:companies!inner(name, slug))')
      .eq('id', id)
      .eq('user_id', req.user!.userId)
      .maybeSingle()
    if (!app) return sendError(res, 'Application not found', 404)
    const { data: events } = await supabaseAdmin.from('application_events').select('stage, created_at').eq('application_id', id).order('created_at', { ascending: true }).limit(50)
    const job = (Array.isArray(app.job) ? app.job[0] : app.job) as unknown as { id: string; title: string; status: string; outcome: string | null; closed_at: string | null; company: { name: string; slug: string } | { name: string; slug: string }[] }
    const company = Array.isArray(job.company) ? job.company[0] : job.company
    sendSuccess(res, { ...app, job: { ...job, company }, events: events || [] })
  } catch (e) {
    console.error('getMyJobApplication', e)
    sendError(res, 'Server error', 500)
  }
}
