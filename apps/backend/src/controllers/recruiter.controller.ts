// ============================================================
// FILE: apps/backend/src/controllers/recruiter.controller.ts
// PURPOSE: Recruiter portal: company profile + verification request, jobs,
//          applicant pipeline, review replies, dashboard stats.
// SECURITY: company_id always comes from the caller's membership row.
//           Applicants/jobs are re-checked against that company on every call.
// ============================================================

import { FREE_CAPS, PRO_CEILING, isActive } from '../utils/plans'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'
import { sanitizeObject, uuidParam } from '../utils/sanitize'
import { sha256 } from '../utils/net'
import {
  STAGE_LABEL,
  STAGE_TO_TRACKER,
  type Membership,
  type Stage,
  companyMemberIds,
  companyResponseRate,
  companySlug,
  domainMatches,
  emailDomain,
  getMembership,
  hostOf,
  notify,
} from '../utils/recruiter'

/** Free companies: 3 open jobs. Recruiter plan: high ceiling. Admins: ceiling. */
const SUSPENDED_MSG = 'Your company is suspended from posting jobs. Contact support.'
// Penalty level 1+ (repeat ghosting) limits a company to one open job.
const jobCap = (m: Membership) => (m.company.penalty_level >= 1 ? 1 : isActive(m.company.pro_until) ? PRO_CEILING.open_jobs : FREE_CAPS.open_jobs)
const capMessage = (cap: number, m: Membership) =>
  m.company.penalty_level >= 1
    ? 'Your company is limited to one open job because recent jobs got applicants but no CV was opened. Open your applicants to lift this.'
    : isActive(m.company.pro_until) ? `You can have up to ${cap} open jobs.` : `The free plan includes ${cap} open jobs. Upgrade to the recruiter plan for more, or close one first.`
const COMPANY_FIELDS =
  'id, slug, name, industry, website, domain, about, size, locations, verification_status, verification_note, domain_match, verified_at, total_reviews, avg_overall_rating'

async function requireMembership(req: Request, res: Response): Promise<Membership | null> {
  const m = await getMembership(req.user!.userId)
  if (!m) sendError(res, 'Set up your company first.', 409, 'NO_COMPANY')
  return m
}

async function requireVerified(req: Request, res: Response): Promise<Membership | null> {
  const m = await requireMembership(req, res)
  if (m && m.company.verification_status !== 'verified') {
    sendError(res, 'Your company must be verified before you can do this.', 403, 'NOT_VERIFIED')
    return null
  }
  return m
}

/** Loads an application only if it belongs to one of the caller's company jobs. */
async function loadOwnedApplication(appId: string, companyId: string) {
  const { data: app } = await supabaseAdmin
    .from('job_applications')
    .select('id, job_id, user_id, cv_text, cover_note, match_score, stage, stage_changed_at, first_response_at, cv_opened_at, no_response, created_at, job:jobs!inner(id, title, company_id)')
    .eq('id', appId)
    .eq('job.company_id', companyId)
    .maybeSingle()
  if (!app) return null
  const job = Array.isArray(app.job) ? app.job[0] : app.job
  return job ? { ...app, job } : null
}

// ─── COMPANY ──────────────────────────────────────────────
export async function getMyCompany(req: Request, res: Response): Promise<void> {
  try {
    const m = await getMembership(req.user!.userId)
    if (!m) return sendSuccess(res, null)
    const { data } = await supabaseAdmin.from('companies').select(COMPANY_FIELDS).eq('id', m.company_id).single()
    sendSuccess(res, { ...data, member_role: m.member_role })
  } catch (e) {
    console.error('getMyCompany', e)
    sendError(res, 'Server error', 500)
  }
}

export async function saveMyCompany(req: Request, res: Response): Promise<void> {
  try {
    const body = sanitizeObject(req.body) as {
      name: string
      website: string
      industry: string
      size: string
      locations: string
      about: string
    }
    const userId = req.user!.userId
    const host = hostOf(body.website)
    if (!host || !host.includes('.')) return sendError(res, 'Enter a real company website.', 400)
    const match = domainMatches(emailDomain(req.user!.email), host)
    const profile = { industry: body.industry || null, size: body.size || null, locations: body.locations || null, about: body.about || null }

    const m = await getMembership(userId)
    if (m) {
      if (m.member_role !== 'owner') return sendError(res, 'Only the company owner can edit the profile.', 403)
      const verified = m.company.verification_status === 'verified'
      const { data: current } = await supabaseAdmin.from('companies').select('name, website').eq('id', m.company_id).single()
      const identityChanged = current && (current.name !== body.name || hostOf(current.website || '') !== host)
      if (verified && identityChanged) return sendError(res, 'Name and website are locked after verification. Contact support to change them.', 400)

      const update: Record<string, unknown> = { ...profile, updated_at: new Date().toISOString() }
      if (!verified) {
        Object.assign(update, { name: body.name, website: body.website, domain: host, domain_match: match, verification_status: 'pending', verification_note: null })
      }
      const { data, error } = await supabaseAdmin.from('companies').update(update).eq('id', m.company_id).select(COMPANY_FIELDS).single()
      if (error) throw error
      return sendSuccess(res, { ...data, member_role: m.member_role }, 200, 'Company saved')
    }

    // New membership: claim an existing (review-created) company or create one.
    const slug = companySlug(body.name, sha256)
    const { data: existing } = await supabaseAdmin.from('companies').select('id').eq('slug', slug).maybeSingle()
    let companyId: string
    if (existing) {
      const { count } = await supabaseAdmin.from('company_members').select('id', { count: 'exact', head: true }).eq('company_id', existing.id)
      if ((count || 0) > 0) return sendError(res, 'This company is already managed on SafeApply. Ask its owner to add you.', 409)
      companyId = existing.id
      const { error } = await supabaseAdmin
        .from('companies')
        .update({ ...profile, website: body.website, domain: host, domain_match: match, verification_status: 'pending', verification_note: null, updated_at: new Date().toISOString() })
        .eq('id', companyId)
      if (error) throw error
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('companies')
        .insert({ name: body.name, slug, ...profile, website: body.website, domain: host, domain_match: match, verification_status: 'pending' })
        .select('id')
        .single()
      if (error || !created) throw error || new Error('insert failed')
      companyId = created.id
    }

    const { error: memberErr } = await supabaseAdmin.from('company_members').insert({ company_id: companyId, user_id: userId, member_role: 'owner' })
    if (memberErr) {
      // unique(user_id) race: someone double-submitted.
      return sendError(res, 'You already belong to a company.', 409)
    }

    const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin').limit(20)
    await notify(
      (admins || []).map((a) => ({
        user_id: a.id,
        type: 'company_verification',
        title: `${body.name} wants to be verified`,
        body: match ? 'Email domain matches the website.' : 'Email domain does NOT match the website. Check manually.',
        link: '/admin/companies',
      })),
    )

    const { data } = await supabaseAdmin.from('companies').select(COMPANY_FIELDS).eq('id', companyId).single()
    sendSuccess(res, { ...data, member_role: 'owner' }, 201, 'Company submitted for verification')
  } catch (e) {
    console.error('saveMyCompany', e)
    sendError(res, 'Couldn’t save the company.', 500)
  }
}

// ─── DASHBOARD ────────────────────────────────────────────
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const m = await requireMembership(req, res)
    if (!m) return
    const { data: jobs } = await supabaseAdmin.from('jobs').select('id, status').eq('company_id', m.company_id).limit(500)
    const ids = (jobs || []).map((j) => j.id)
    let apps: { stage: string; created_at: string; first_response_at: string | null }[] = []
    if (ids.length) {
      const { data } = await supabaseAdmin.from('job_applications').select('stage, created_at, first_response_at').in('job_id', ids).limit(5000)
      apps = data || []
    }
    const overdueCutoff = Date.now() - 7 * 86_400_000
    const response = await companyResponseRate(m.company_id)
    sendSuccess(res, {
      open_jobs: (jobs || []).filter((j) => j.status === 'open').length,
      total_jobs: ids.length,
      applicants: apps.length,
      new_applicants: apps.filter((a) => a.stage === 'applied').length,
      overdue: apps.filter((a) => a.stage === 'applied' && !a.first_response_at && new Date(a.created_at).getTime() < overdueCutoff).length,
      hired: apps.filter((a) => a.stage === 'hired').length,
      response_rate: response.rate,
      response_sample: response.sample,
      verification_status: m.company.verification_status,
    })
  } catch (e) {
    console.error('recruiter getStats', e)
    sendError(res, 'Server error', 500)
  }
}

// ─── JOBS ─────────────────────────────────────────────────
const JOB_FIELDS = 'id, title, description, location, work_mode, employment_type, salary_min, salary_max, currency, salary_period, status, last_activity_at, created_at, updated_at, outcome, outcome_note, closed_at, ghost_flag, apps_count, opened_count, replied_count'

export async function listMyJobs(req: Request, res: Response): Promise<void> {
  try {
    const m = await requireMembership(req, res)
    if (!m) return
    const { data: jobs, error } = await supabaseAdmin.from('jobs').select(JOB_FIELDS).eq('company_id', m.company_id).order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    const ids = (jobs || []).map((j) => j.id)
    const counts: Record<string, { total: number; new: number }> = {}
    if (ids.length) {
      const { data: apps } = await supabaseAdmin.from('job_applications').select('job_id, stage').in('job_id', ids).limit(10000)
      for (const a of apps || []) {
        const c = (counts[a.job_id] ||= { total: 0, new: 0 })
        c.total += 1
        if (a.stage === 'applied') c.new += 1
      }
    }
    sendSuccess(res, (jobs || []).map((j) => ({ ...j, applicants: counts[j.id]?.total || 0, new_applicants: counts[j.id]?.new || 0 })))
  } catch (e) {
    console.error('listMyJobs', e)
    sendError(res, 'Server error', 500)
  }
}

export async function createJob(req: Request, res: Response): Promise<void> {
  try {
    const m = await requireMembership(req, res)
    if (!m) return
    const body = sanitizeObject(req.body) as Record<string, unknown>
    if (body.status === 'open' && m.company.suspended) return sendError(res, SUSPENDED_MSG, 403, 'SUSPENDED')
    // Drafts are allowed while verification is pending; publishing is not.
    if (body.status === 'open' && m.company.verification_status !== 'verified') {
      return sendError(res, 'Your company must be verified before jobs can go live. Save it as a draft for now.', 403, 'NOT_VERIFIED')
    }
    if (body.status === 'open') {
      const { count } = await supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', m.company_id).eq('status', 'open')
      const cap = jobCap(m)
      if ((count || 0) >= cap) return sendError(res, capMessage(cap, m), 403, cap === FREE_CAPS.open_jobs ? 'FREE_LIMIT_REACHED' : undefined)
    }
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .insert({ ...body, company_id: m.company_id, created_by: req.user!.userId })
      .select(JOB_FIELDS)
      .single()
    if (error) throw error
    sendSuccess(res, data, 201, 'Job saved')
  } catch (e) {
    console.error('createJob', e)
    sendError(res, 'Couldn’t save the job.', 500)
  }
}

export async function getMyJob(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Job not found', 404)
    const m = await requireMembership(req, res)
    if (!m) return
    const { data: job } = await supabaseAdmin.from('jobs').select(JOB_FIELDS).eq('id', id).eq('company_id', m.company_id).maybeSingle()
    if (!job) return sendError(res, 'Job not found', 404)

    const { data: apps } = await supabaseAdmin
      .from('job_applications')
      .select('id, user_id, match_score, stage, stage_changed_at, first_response_at, cv_opened_at, no_response, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1000)
    const userIds = [...new Set((apps || []).map((a) => a.user_id))]
    const names: Record<string, string> = {}
    if (userIds.length) {
      const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', userIds)
      for (const u of users || []) names[u.id] = u.full_name
    }
    sendSuccess(res, {
      ...job,
      applications: (apps || []).map(({ user_id, ...a }) => ({ ...a, candidate_name: names[user_id] || 'Candidate' })),
    })
  } catch (e) {
    console.error('getMyJob', e)
    sendError(res, 'Server error', 500)
  }
}

export async function updateJob(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Job not found', 404)
    const m = await requireMembership(req, res)
    if (!m) return
    if (req.body.status && req.body.status !== 'draft' && m.company.verification_status !== 'verified') {
      return sendError(res, 'Your company must be verified before jobs can go live.', 403, 'NOT_VERIFIED')
    }
    const { data: job } = await supabaseAdmin.from('jobs').select('id, status, salary_min, salary_max').eq('id', id).eq('company_id', m.company_id).maybeSingle()
    if (!job) return sendError(res, 'Job not found', 404)
    const body = sanitizeObject(req.body) as Record<string, unknown>
    if (job.status === 'closed') return sendError(res, 'Closed jobs can’t be changed. Post a new job instead.', 409)
    if (body.status === 'closed') return sendError(res, 'Close jobs from the Close job page so applicants get an answer.', 400, 'USE_CLOSE')
    if (body.status === 'open' && m.company.suspended) return sendError(res, SUSPENDED_MSG, 403, 'SUSPENDED')

    const min = (body.salary_min as number | undefined) ?? job.salary_min
    const max = (body.salary_max as number | undefined) ?? job.salary_max
    if (max < min) return sendError(res, 'Maximum salary must be at least the minimum', 400)
    if (body.status === 'open' && job.status !== 'open') {
      const { count } = await supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', m.company_id).eq('status', 'open')
      const cap = jobCap(m)
      if ((count || 0) >= cap) return sendError(res, capMessage(cap, m), 403, cap === FREE_CAPS.open_jobs ? 'FREE_LIMIT_REACHED' : undefined)
    }

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('jobs')
      .update({ ...body, updated_at: now, last_activity_at: now })
      .eq('id', id)
      .eq('company_id', m.company_id)
      .select(JOB_FIELDS)
      .single()
    if (error) throw error
    sendSuccess(res, data, 200, 'Job updated')
  } catch (e) {
    console.error('updateJob', e)
    sendError(res, 'Couldn’t update the job.', 500)
  }
}

// ─── APPLICANTS ───────────────────────────────────────────
export async function getApplicant(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Applicant not found', 404)
    const m = await requireMembership(req, res)
    if (!m) return
    const app = await loadOwnedApplication(id, m.company_id)
    if (!app) return sendError(res, 'Applicant not found', 404)

    // Read receipt: the first time anyone at the company opens this CV.
    if (!app.cv_opened_at) {
      const { data: first } = await supabaseAdmin
        .from('job_applications')
        .update({ cv_opened_at: new Date().toISOString() })
        .eq('id', id)
        .is('cv_opened_at', null)
        .select('cv_opened_at')
        .maybeSingle()
      if (first) {
        app.cv_opened_at = first.cv_opened_at
        void notify([{ user_id: app.user_id, type: 'cv_opened', title: `${m.company.name} opened your CV`, body: `For ${app.job.title}.`, link: `/dashboard/applications/${id}` }])
      }
    }

    const [{ data: user }, { data: events }] = await Promise.all([
      supabaseAdmin.from('users').select('full_name, email, location, job_title').eq('id', app.user_id).maybeSingle(),
      supabaseAdmin.from('application_events').select('stage, created_at').eq('application_id', id).order('created_at', { ascending: true }).limit(50),
    ])
    const { user_id: _uid, ...rest } = app
    void _uid
    sendSuccess(res, {
      ...rest,
      candidate: { full_name: user?.full_name || 'Candidate', email: user?.email || '', location: user?.location || '', job_title: user?.job_title || '' },
      events: events || [],
    })
  } catch (e) {
    console.error('getApplicant', e)
    sendError(res, 'Server error', 500)
  }
}

const OUTCOME_LABEL: Record<string, string> = { hired_here: 'filled', hired_elsewhere: 'filled', not_hired: 'closed without a hire', cancelled: 'cancelled' }

/** Close a job with an outcome. Everyone still waiting gets a final answer. */
export async function closeJob(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Job not found', 404)
    const m = await requireMembership(req, res)
    if (!m) return
    const outcome = req.body.outcome as string
    const hired = outcome === 'hired_here' ? uuidParam(req.body.hired_application_id) : null
    const { data, error } = await supabaseAdmin.rpc('close_job', {
      p_job: id,
      p_company: m.company_id,
      p_user: req.user!.userId,
      p_outcome: outcome,
      p_note: String(req.body.note || ''),
      p_hired: hired,
    })
    if (error) {
      if (error.message.includes('NOT_FOUND')) return sendError(res, 'Job not found', 404)
      if (error.message.includes('ALREADY_CLOSED')) return sendError(res, 'This job is already closed.', 409)
      if (error.message.includes('HIRED_REQUIRED')) return sendError(res, 'Pick the applicant you hired.', 400)
      throw error
    }
    const changed = (data || []) as { id: string; user_id: string; stage: Stage }[]
    const { data: job } = await supabaseAdmin.from('jobs').select('title').eq('id', id).single()
    await Promise.all([
      ...changed.map((c) => syncTracker(c.id, c.user_id, c.stage)),
      notify(
        changed.map((c) => ({
          user_id: c.user_id,
          type: 'application_stage',
          title: c.stage === 'hired' ? `${m.company.name}: you’re hired` : `${m.company.name}: position ${OUTCOME_LABEL[outcome]}`,
          body: c.stage === 'hired' ? `Congratulations on ${job?.title}. Confirm the hire from your application page.` : `${job?.title} is closed. Thanks for applying.`,
          link: `/dashboard/applications/${c.id}`,
        })),
      ),
    ])
    sendSuccess(res, { closed: true, answered: changed.length }, 200, 'Job closed')
  } catch (e) {
    console.error('closeJob', e)
    sendError(res, 'Couldn’t close the job.', 500)
  }
}

export async function setStage(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Applicant not found', 404)
    const m = await requireVerified(req, res)
    if (!m) return
    const app = await loadOwnedApplication(id, m.company_id)
    if (!app) return sendError(res, 'Applicant not found', 404)
    const stage = req.body.stage as Stage
    if (stage === app.stage) return sendSuccess(res, { stage })

    const now = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('job_applications')
      .update({ stage, stage_changed_at: now, ...(app.first_response_at ? {} : { first_response_at: now }) })
      .eq('id', id)
    if (error) throw error

    await Promise.all([
      supabaseAdmin.from('application_events').insert({ application_id: id, stage, changed_by: req.user!.userId }),
      supabaseAdmin.from('jobs').update({ last_activity_at: now }).eq('id', app.job.id),
      syncTracker(id, app.user_id, stage),
      notify([
        {
          user_id: app.user_id,
          type: 'application_stage',
          title: `${m.company.name}: ${STAGE_LABEL[stage]}`,
          body: `Your application for ${app.job.title} moved to ${STAGE_LABEL[stage]}.`,
          link: `/dashboard/applications/${id}`,
        },
      ]),
    ])
    sendSuccess(res, { stage }, 200, 'Stage updated')
  } catch (e) {
    console.error('setStage', e)
    sendError(res, 'Couldn’t update the stage.', 500)
  }
}

/** Mirror the recruiter's stage onto the candidate's own tracker card. */
export async function syncTracker(jobApplicationId: string, userId: string, stage: Stage): Promise<void> {
  const status = STAGE_TO_TRACKER[stage]
  const { data: card } = await supabaseAdmin
    .from('applications')
    .select('id, status')
    .eq('job_application_id', jobApplicationId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!card || card.status === status) return
  await supabaseAdmin.from('applications').update({ status, updated_at: new Date().toISOString() }).eq('id', card.id)
  await supabaseAdmin.from('application_timeline').insert({ application_id: card.id, status })
}

// ─── REVIEWS ──────────────────────────────────────────────
export async function listCompanyReviews(req: Request, res: Response): Promise<void> {
  try {
    const m = await requireMembership(req, res)
    if (!m) return
    // reviewer_id is never selected here: companies must not learn who wrote a review.
    const { data: reviews, error } = await supabaseAdmin
      .from('reviews')
      .select('id, relationship, role_type, overall_rating, culture_rating, interview_rating, would_recommend, review_text, interview_process, created_at')
      .eq('company_id', m.company_id)
      .eq('moderation_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    const ids = (reviews || []).map((r) => r.id)
    const replies: Record<string, { body: string; updated_at: string }> = {}
    if (ids.length) {
      const { data } = await supabaseAdmin.from('review_replies').select('review_id, body, updated_at').in('review_id', ids)
      for (const r of data || []) replies[r.review_id] = { body: r.body, updated_at: r.updated_at }
    }
    sendSuccess(res, (reviews || []).map((r) => ({ ...r, reply: replies[r.id] || null })))
  } catch (e) {
    console.error('listCompanyReviews', e)
    sendError(res, 'Server error', 500)
  }
}

export async function replyToReview(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) return sendError(res, 'Review not found', 404)
    const m = await requireVerified(req, res)
    if (!m) return
    const { data: review } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('id', id)
      .eq('company_id', m.company_id)
      .eq('moderation_status', 'approved')
      .maybeSingle()
    if (!review) return sendError(res, 'Review not found', 404)
    const body = sanitizeObject(req.body).body as string
    const { error } = await supabaseAdmin
      .from('review_replies')
      .upsert({ review_id: id, company_id: m.company_id, author_id: req.user!.userId, body, updated_at: new Date().toISOString() }, { onConflict: 'review_id' })
    if (error) throw error
    sendSuccess(res, { body }, 200, 'Reply published')
  } catch (e) {
    console.error('replyToReview', e)
    sendError(res, 'Couldn’t publish the reply.', 500)
  }
}

// Re-exported for the messages controller.
export { companyMemberIds }
