// ============================================================
// FILE: apps/backend/src/controllers/interviews.controller.ts
// PURPOSE: Interview scheduling between a company and an applicant.
//   Company proposes 1–5 time slots → candidate picks one (or asks to
//   reschedule) → after the time passes, BOTH sides confirm it happened.
//   Only interviews the candidate confirms count on the public record.
// SECURITY: every call resolves the caller's side from the DB (candidate =
//   owner of the application; company = member of the job's company).
//   Admins can read, never act. Company actions need a verified company.
// ============================================================

import { randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'
import { stripHtml, uuidParam } from '../utils/sanitize'
import { companyMemberIds, getMembership, notify, type Stage } from '../utils/recruiter'
import { emailHtml, sendEmail } from '../services/email.service'
import { syncTracker } from './recruiter.controller'
import { h } from './freelance.controller'

type Side = 'candidate' | 'company' | 'admin'
const ACTIVE = ['proposed', 'scheduled', 'reschedule_requested']
const FIELDS = 'id, application_id, company_id, mode, duration_min, location, note, video_url, status, scheduled_at, cancel_reason, cancelled_by, candidate_note, company_confirmed, candidate_confirmed, created_at, updated_at'
const MIN_LEAD_MS = 30 * 60_000
const MAX_AHEAD_MS = 90 * 86_400_000

interface Ctx {
  iv: Record<string, unknown> & { id: string; company_id: string; status: string; scheduled_at: string | null; duration_min: number; application_id: string }
  side: Side
  app: { id: string; user_id: string; stage: Stage; job: { title: string }; company: { name: string; verification_status: string } }
}

const when = (iso: string) => new Date(iso).toUTCString().replace(':00 GMT', ' UTC')
const link = (id: string) => `/interviews/${id}`

async function userEmail(id: string) {
  const { data } = await supabaseAdmin.from('users').select('email').eq('id', id).maybeSingle()
  return data?.email as string | undefined
}

/** Loads an interview and works out the caller's side, or sends 404. */
async function load(req: Request, res: Response, act = true): Promise<Ctx | null> {
  const id = uuidParam(req.params.id)
  const uid = req.user!.userId
  const { data: iv } = id ? await supabaseAdmin.from('interviews').select(FIELDS).eq('id', id).maybeSingle() : { data: null }
  if (!iv) {
    sendError(res, 'Interview not found', 404)
    return null
  }
  const { data: app } = await supabaseAdmin
    .from('job_applications')
    .select('id, user_id, stage, job:jobs!inner(title, company:companies!inner(name, verification_status))')
    .eq('id', iv.application_id)
    .maybeSingle()
  if (!app) {
    sendError(res, 'Interview not found', 404)
    return null
  }
  const job = app.job as unknown as { title: string; company: { name: string; verification_status: string } }
  let side: Side | null = null
  if (app.user_id === uid) side = 'candidate'
  else {
    const m = await getMembership(uid)
    if (m && m.company_id === iv.company_id) side = 'company'
    else if (req.user!.role === 'admin' && !act) side = 'admin'
  }
  if (!side) {
    sendError(res, 'Interview not found', 404)
    return null
  }
  return { iv: iv as Ctx['iv'], side, app: { id: app.id, user_id: app.user_id, stage: app.stage, job: { title: job.title }, company: job.company } }
}

function validSlots(raw: string[]): string[] | null {
  const now = Date.now()
  const out = [...new Set(raw.map((s) => new Date(s).toISOString()))]
  if (!out.length || out.length > 5) return null
  return out.every((s) => {
    const t = new Date(s).getTime()
    return t - now >= MIN_LEAD_MS && t - now <= MAX_AHEAD_MS
  })
    ? out.sort()
    : null
}

async function notifyCompany(companyId: string, title: string, body: string, path: string) {
  const ids = await companyMemberIds(companyId)
  await notify(ids.map((user_id) => ({ user_id, type: 'interview', title, body, link: path })))
}

// ─── Lists ───────────────────────────────────────────────────

export const listInterviews = h('interviews.list', async (req, res) => {
  const uid = req.user!.userId
  const m = req.user!.role === 'recruiter' || req.user!.role === 'admin' ? await getMembership(uid) : null
  let appIds: string[] = []
  if (!m) {
    const { data } = await supabaseAdmin.from('job_applications').select('id').eq('user_id', uid).limit(1000)
    appIds = (data || []).map((a) => a.id as string)
    if (!appIds.length) return sendSuccess(res, [])
  }
  let q = supabaseAdmin
    .from('interviews')
    .select(`${FIELDS}, application:job_applications!inner(id, user_id, job:jobs!inner(id, title, company:companies!inner(name, slug)))`)
    .order('scheduled_at', { ascending: true, nullsFirst: true })
    .limit(300)
  q = m ? q.eq('company_id', m.company_id) : q.in('application_id', appIds)
  const { data, error } = await q
  if (error) throw error
  const rows = (data || []) as unknown as (Record<string, unknown> & { application: { user_id: string } })[]
  const names: Record<string, string> = {}
  if (m && rows.length) {
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', [...new Set(rows.map((r) => r.application.user_id))])
    for (const u of users || []) names[u.id] = u.full_name
  }
  sendSuccess(
    res,
    rows.map(({ application, ...r }) => {
      const a = application as unknown as { id: string; user_id: string; job: { id: string; title: string; company: { name: string; slug: string } } }
      return { ...r, job: { id: a.job.id, title: a.job.title }, company: a.job.company, candidate_name: m ? names[a.user_id] || 'Candidate' : undefined }
    }),
  )
})

export const getInterview = h('interviews.get', async (req, res) => {
  const c = await load(req, res, false)
  if (!c) return
  const [{ data: slots }, { data: cand }] = await Promise.all([
    supabaseAdmin.from('interview_slots').select('id, starts_at').eq('interview_id', c.iv.id).order('starts_at'),
    c.side !== 'candidate' ? supabaseAdmin.from('users').select('full_name').eq('id', c.app.user_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  sendSuccess(res, { ...c.iv, side: c.side, slots: slots || [], job: c.app.job, company: { name: c.app.company.name }, candidate_name: cand?.full_name ?? null })
})

// ─── Company actions ─────────────────────────────────────────

export const createInterview = h('interviews.create', async (req, res) => {
  const uid = req.user!.userId
  const m = await getMembership(uid)
  if (!m) return sendError(res, 'Set up your company first.', 409, 'NO_COMPANY')
  if (m.company.verification_status !== 'verified') return sendError(res, 'Your company must be verified first.', 403, 'NOT_VERIFIED')
  const appId = uuidParam(req.body.application_id)
  const { data: app } = appId
    ? await supabaseAdmin.from('job_applications').select('id, user_id, stage, first_response_at, job:jobs!inner(id, title, company_id)').eq('id', appId).eq('job.company_id', m.company_id).maybeSingle()
    : { data: null }
  if (!app) return sendError(res, 'Applicant not found', 404)
  if (app.stage === 'rejected' || app.stage === 'hired') return sendError(res, 'This applicant is no longer in your pipeline.', 409)
  const slots = validSlots(req.body.slots)
  if (!slots) return sendError(res, 'Offer 1 to 5 different times, at least 30 minutes from now and within 90 days.', 400)
  const { count } = await supabaseAdmin.from('interviews').select('id', { count: 'exact', head: true }).eq('application_id', app.id).in('status', ACTIVE)
  if (count) return sendError(res, 'This applicant already has an interview in progress.', 409)

  const mode = req.body.mode as 'video' | 'phone' | 'onsite'
  const { data: iv, error } = await supabaseAdmin
    .from('interviews')
    .insert({
      application_id: app.id,
      company_id: m.company_id,
      created_by: uid,
      mode,
      duration_min: req.body.duration_min,
      location: stripHtml(req.body.location || '') || null,
      note: stripHtml(req.body.note || '') || null,
      video_url: mode === 'video' ? `https://meet.jit.si/SafeApply-${randomBytes(12).toString('base64url')}` : null,
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: slotErr } = await supabaseAdmin.from('interview_slots').insert(slots.map((starts_at) => ({ interview_id: iv.id, starts_at })))
  if (slotErr) {
    await supabaseAdmin.from('interviews').delete().eq('id', iv.id)
    throw slotErr
  }

  // Inviting someone to interview is a reply and moves them forward.
  const now = new Date().toISOString()
  const job = app.job as unknown as { id: string; title: string }
  const advance = app.stage === 'applied' || app.stage === 'screening'
  await Promise.all([
    supabaseAdmin
      .from('job_applications')
      .update({ ...(advance ? { stage: 'interview', stage_changed_at: now } : {}), ...(app.first_response_at ? {} : { first_response_at: now }) })
      .eq('id', app.id),
    advance ? supabaseAdmin.from('application_events').insert({ application_id: app.id, stage: 'interview', changed_by: uid }) : null,
    advance ? syncTracker(app.id, app.user_id, 'interview') : null,
    supabaseAdmin.from('jobs').update({ last_activity_at: now }).eq('id', job.id),
    notify([{ user_id: app.user_id, type: 'interview', title: `${m.company.name} invited you to interview`, body: `Pick a time for ${job.title}.`, link: link(iv.id) }]),
  ])
  const email = await userEmail(app.user_id)
  if (email) void sendEmail(email, `Interview invitation: ${job.title}`, emailHtml(`${m.company.name} invited you to interview`, [`For ${job.title}. They offered ${slots.length} time${slots.length === 1 ? '' : 's'}; pick the one that suits you.`], { label: 'Pick a time', path: link(iv.id) }))
  sendSuccess(res, { id: iv.id }, 201, 'Interview proposed')
})

export const proposeSlots = h('interviews.slots', async (req, res) => {
  const c = await load(req, res)
  if (!c) return
  if (c.side !== 'company') return sendError(res, 'Only the company can offer times.', 403)
  if (!['proposed', 'reschedule_requested', 'scheduled'].includes(c.iv.status)) return sendError(res, 'This interview is closed.', 409)
  const slots = validSlots(req.body.slots)
  if (!slots) return sendError(res, 'Offer 1 to 5 different times, at least 30 minutes from now and within 90 days.', 400)
  await supabaseAdmin.from('interview_slots').delete().eq('interview_id', c.iv.id)
  const { error } = await supabaseAdmin.from('interview_slots').insert(slots.map((starts_at) => ({ interview_id: c.iv.id, starts_at })))
  if (error) throw error
  await supabaseAdmin.from('interviews').update({ status: 'proposed', scheduled_at: null, reminder_sent_at: null, updated_at: new Date().toISOString() }).eq('id', c.iv.id)
  await notify([{ user_id: c.app.user_id, type: 'interview', title: `${c.app.company.name} offered new interview times`, link: link(c.iv.id) }])
  sendSuccess(res, { status: 'proposed' }, 200, 'New times sent')
})

// ─── Candidate actions ───────────────────────────────────────

export const pickSlot = h('interviews.pick', async (req, res) => {
  const c = await load(req, res)
  if (!c) return
  if (c.side !== 'candidate') return sendError(res, 'Only the candidate picks the time.', 403)
  const slotId = uuidParam(req.body.slot_id)
  const { data: slot } = slotId ? await supabaseAdmin.from('interview_slots').select('starts_at').eq('id', slotId).eq('interview_id', c.iv.id).maybeSingle() : { data: null }
  if (!slot) return sendError(res, 'That time isn’t available.', 404)
  if (new Date(slot.starts_at).getTime() <= Date.now()) return sendError(res, 'That time has passed. Ask for new times.', 409)
  const { data } = await supabaseAdmin
    .from('interviews')
    .update({ status: 'scheduled', scheduled_at: slot.starts_at, updated_at: new Date().toISOString() })
    .eq('id', c.iv.id)
    .eq('status', 'proposed')
    .select('id')
    .maybeSingle()
  if (!data) return sendError(res, 'This interview can’t be booked right now.', 409)
  await notifyCompany(c.iv.company_id, `Interview booked: ${c.app.job.title}`, `Booked for ${when(slot.starts_at)}.`, link(c.iv.id))
  sendSuccess(res, { status: 'scheduled', scheduled_at: slot.starts_at }, 200, 'Interview booked')
})

export const requestReschedule = h('interviews.reschedule', async (req, res) => {
  const c = await load(req, res)
  if (!c) return
  if (c.side !== 'candidate') return sendError(res, 'Only the candidate can ask for new times.', 403)
  const note = stripHtml(req.body.note || '')
  const { data } = await supabaseAdmin
    .from('interviews')
    .update({ status: 'reschedule_requested', candidate_note: note || null, updated_at: new Date().toISOString() })
    .eq('id', c.iv.id)
    .in('status', ['proposed', 'scheduled'])
    .select('id')
    .maybeSingle()
  if (!data) return sendError(res, 'This interview can’t be rescheduled.', 409)
  await notifyCompany(c.iv.company_id, `New times requested: ${c.app.job.title}`, note.slice(0, 200), link(c.iv.id))
  sendSuccess(res, { status: 'reschedule_requested' }, 200, 'Request sent')
})

// ─── Either side ─────────────────────────────────────────────

export const cancelInterview = h('interviews.cancel', async (req, res) => {
  const c = await load(req, res)
  if (!c) return
  if (c.side === 'admin') return sendError(res, 'Admins can’t act on interviews.', 403)
  const reason = stripHtml(req.body.reason)
  const { data } = await supabaseAdmin
    .from('interviews')
    .update({ status: 'cancelled', cancel_reason: reason, cancelled_by: c.side, updated_at: new Date().toISOString() })
    .eq('id', c.iv.id)
    .in('status', ACTIVE)
    .select('id')
    .maybeSingle()
  if (!data) return sendError(res, 'This interview is already closed.', 409)
  if (c.side === 'company') await notify([{ user_id: c.app.user_id, type: 'interview', title: `${c.app.company.name} cancelled the interview`, body: reason.slice(0, 200), link: link(c.iv.id) }])
  else await notifyCompany(c.iv.company_id, `Candidate cancelled: ${c.app.job.title}`, reason.slice(0, 200), link(c.iv.id))
  sendSuccess(res, { status: 'cancelled' }, 200, 'Interview cancelled')
})

export const confirmInterview = h('interviews.confirm', async (req, res) => {
  const c = await load(req, res)
  if (!c) return
  if (c.side === 'admin') return sendError(res, 'Admins can’t act on interviews.', 403)
  if (c.iv.status !== 'scheduled' || !c.iv.scheduled_at || new Date(c.iv.scheduled_at).getTime() > Date.now()) {
    return sendError(res, 'You can confirm once the interview time has passed.', 409)
  }
  const col = c.side === 'candidate' ? 'candidate_confirmed' : 'company_confirmed'
  const { data } = await supabaseAdmin
    .from('interviews')
    .update({ [col]: Boolean(req.body.held), updated_at: new Date().toISOString() })
    .eq('id', c.iv.id)
    .is(col, null)
    .select('id')
    .maybeSingle()
  if (!data) return sendError(res, 'You’ve already answered.', 409)
  sendSuccess(res, { [col]: Boolean(req.body.held) }, 200, 'Thanks for confirming')
})

// ─── Hire confirmation (candidate) ───────────────────────────

export const confirmHire = h('interviews.confirmHire', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Application not found', 404)
  const confirmed = Boolean(req.body.confirmed)
  const { data } = await supabaseAdmin
    .from('job_applications')
    .update({ hire_confirmed: confirmed, hire_confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', req.user!.userId)
    .eq('stage', 'hired')
    .is('hire_confirmed', null)
    .select('id, job:jobs(title, company_id)')
    .maybeSingle()
  if (!data) return sendError(res, 'There’s no hire to confirm here.', 409)
  const job = data.job as unknown as { title: string; company_id: string }
  if (!confirmed) await notifyCompany(job.company_id, `Hire not confirmed: ${job.title}`, 'The candidate says they weren’t hired. It won’t count as a verified hire.', '/recruiter')
  sendSuccess(res, { hire_confirmed: confirmed }, 200, confirmed ? 'Hire confirmed' : 'Thanks, noted')
})
