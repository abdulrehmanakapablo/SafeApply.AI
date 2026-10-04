// ============================================================
// FILE: apps/backend/src/controllers/messages.controller.ts
// PURPOSE: One message thread per job application, between the candidate
//          and the hiring company. Access is re-checked on every call:
//          you're the candidate on that application, or a member of the
//          company that owns the job. Nobody else, admins included.
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'
import { stripHtml, uuidParam } from '../utils/sanitize'
import { companyMemberIds, getMembership, notify } from '../utils/recruiter'

type Side = 'candidate' | 'company'

async function resolveThread(appId: string, userId: string) {
  const { data: app } = await supabaseAdmin
    .from('job_applications')
    .select('id, user_id, stage, first_response_at, job:jobs!inner(id, title, company_id, company:companies(name, slug))')
    .eq('id', appId)
    .maybeSingle()
  if (!app) return null
  const job = Array.isArray(app.job) ? app.job[0] : app.job
  if (!job) return null
  const company = Array.isArray(job.company) ? job.company[0] : job.company
  let side: Side | null = null
  if (app.user_id === userId) side = 'candidate'
  else {
    const m = await getMembership(userId)
    if (m && m.company_id === job.company_id) side = 'company'
  }
  return side ? { app, job, company, side } : null
}

export async function listThreads(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const m = await getMembership(userId)
    let apps: { id: string; user_id: string; stage: string; job_id: string }[] = []
    let jobs: Record<string, { title: string; company: string }> = {}

    if (m) {
      const { data: js } = await supabaseAdmin.from('jobs').select('id, title').eq('company_id', m.company_id).limit(500)
      jobs = Object.fromEntries((js || []).map((j) => [j.id, { title: j.title, company: m.company.name }]))
      const ids = Object.keys(jobs)
      if (ids.length) {
        const { data } = await supabaseAdmin.from('job_applications').select('id, user_id, stage, job_id').in('job_id', ids).limit(2000)
        apps = data || []
      }
    } else {
      const { data } = await supabaseAdmin
        .from('job_applications')
        .select('id, user_id, stage, job_id, job:jobs(title, company:companies(name))')
        .eq('user_id', userId)
        .limit(500)
      for (const a of data || []) {
        const j = Array.isArray(a.job) ? a.job[0] : a.job
        const c = j && (Array.isArray(j.company) ? j.company[0] : j.company)
        jobs[a.job_id] = { title: j?.title || 'Job', company: c?.name || 'Company' }
      }
      apps = (data || []).map(({ id, user_id, stage, job_id }) => ({ id, user_id, stage, job_id }))
    }

    if (apps.length === 0) return sendSuccess(res, [])
    const { data: msgs } = await supabaseAdmin
      .from('messages')
      .select('application_id, body, sender_side, created_at')
      .in('application_id', apps.map((a) => a.id))
      .order('created_at', { ascending: false })
      .limit(1000)
    const last: Record<string, { body: string; sender_side: string; created_at: string }> = {}
    for (const msg of msgs || []) if (!last[msg.application_id]) last[msg.application_id] = msg

    // Companies see only threads that have messages; candidates see every application.
    const visible = m ? apps.filter((a) => last[a.id]) : apps
    const names: Record<string, string> = {}
    if (m && visible.length) {
      const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', [...new Set(visible.map((a) => a.user_id))])
      for (const u of users || []) names[u.id] = u.full_name
    }
    const out = visible
      .map((a) => ({
        application_id: a.id,
        stage: a.stage,
        job_title: jobs[a.job_id]?.title || 'Job',
        counterpart: m ? names[a.user_id] || 'Candidate' : jobs[a.job_id]?.company || 'Company',
        last_message: last[a.id] ? { ...last[a.id], body: last[a.id].body.slice(0, 140) } : null,
      }))
      .sort((x, y) => (y.last_message?.created_at || '').localeCompare(x.last_message?.created_at || ''))
    sendSuccess(res, out)
  } catch (e) {
    console.error('listThreads', e)
    sendError(res, 'Couldn’t load messages.', 500)
  }
}

export async function getThread(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.applicationId)
    if (!id) return sendError(res, 'Conversation not found', 404)
    const t = await resolveThread(id, req.user!.userId)
    if (!t) return sendError(res, 'Conversation not found', 404)
    const { data: msgs } = await supabaseAdmin
      .from('messages')
      .select('id, sender_side, body, created_at')
      .eq('application_id', id)
      .order('created_at', { ascending: false })
      .limit(200)
    let counterpart = t.company?.name || 'Company'
    if (t.side === 'company') {
      const { data: u } = await supabaseAdmin.from('users').select('full_name').eq('id', t.app.user_id).maybeSingle()
      counterpart = u?.full_name || 'Candidate'
    }
    sendSuccess(res, {
      application_id: id,
      side: t.side,
      stage: t.app.stage,
      job_title: t.job.title,
      job_id: t.job.id,
      counterpart,
      messages: (msgs || []).reverse(),
    })
  } catch (e) {
    console.error('getThread', e)
    sendError(res, 'Server error', 500)
  }
}

export async function postMessage(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.applicationId)
    if (!id) return sendError(res, 'Conversation not found', 404)
    const userId = req.user!.userId
    const t = await resolveThread(id, userId)
    if (!t) return sendError(res, 'Conversation not found', 404)

    const body = stripHtml(String(req.body.body)).slice(0, 4000)
    if (!body) return sendError(res, 'Write a message first.', 400)

    const { data: msg, error } = await supabaseAdmin
      .from('messages')
      .insert({ application_id: id, sender_id: userId, sender_side: t.side, body })
      .select('id, sender_side, body, created_at')
      .single()
    if (error) throw error

    if (t.side === 'company' && !t.app.first_response_at) {
      await supabaseAdmin.from('job_applications').update({ first_response_at: msg.created_at }).eq('id', id)
    }

    const recipients = t.side === 'company' ? [t.app.user_id] : (await companyMemberIds(t.job.company_id)).filter((u) => u !== userId)
    await notify(
      recipients.map((uid) => ({
        user_id: uid,
        type: 'message',
        title: t.side === 'company' ? `Message from ${t.company?.name || 'a company'}` : `New message about ${t.job.title}`,
        body: body.slice(0, 120),
        link: t.side === 'company' ? `/dashboard/messages/${id}` : `/recruiter/applicants/${id}`,
      })),
    )
    sendSuccess(res, msg, 201)
  } catch (e) {
    console.error('postMessage', e)
    sendError(res, 'Couldn’t send the message.', 500)
  }
}
