// ============================================================
// FILE: apps/backend/src/jobs/interviews.jobs.ts
// • Reminder ~24h before a booked interview (both sides).
// • After it ends, both sides are asked "Did it happen?" once.
// Each row is claimed with a conditional update first, so it's sent once.
// ============================================================

import { supabaseAdmin } from '../config/supabase'
import { companyMemberIds, notify } from '../utils/recruiter'
import { emailHtml, sendEmail } from '../services/email.service'
import type { Task } from './scheduler'

const MIN = 60_000
const HOUR = 60 * MIN

type Row = { id: string; company_id: string; scheduled_at: string; duration_min: number; application: { user_id: string; job: { title: string } } }
const SELECT = 'id, company_id, scheduled_at, duration_min, application:job_applications!inner(user_id, job:jobs!inner(title))'

async function parties(r: Row) {
  const [members, { data: cand }] = await Promise.all([companyMemberIds(r.company_id), supabaseAdmin.from('users').select('email').eq('id', r.application.user_id).maybeSingle()])
  return { members, candidateEmail: cand?.email as string | undefined }
}

async function reminders() {
  const now = Date.now()
  const { data } = await supabaseAdmin
    .from('interviews')
    .select(SELECT)
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gt('scheduled_at', new Date(now).toISOString())
    .lt('scheduled_at', new Date(now + 24 * HOUR).toISOString())
    .limit(200)
  for (const r of (data || []) as unknown as Row[]) {
    const { data: claimed } = await supabaseAdmin.from('interviews').update({ reminder_sent_at: new Date().toISOString() }).eq('id', r.id).is('reminder_sent_at', null).select('id').maybeSingle()
    if (!claimed) continue
    const { members, candidateEmail } = await parties(r)
    const at = new Date(r.scheduled_at).toUTCString().replace(':00 GMT', ' UTC')
    const title = `Interview tomorrow: ${r.application.job.title}`
    await notify([r.application.user_id, ...members].map((user_id) => ({ user_id, type: 'interview', title, body: at, link: `/interviews/${r.id}` })))
    if (candidateEmail) await sendEmail(candidateEmail, title, emailHtml(title, [`It starts at ${at}.`], { label: 'Open interview', path: `/interviews/${r.id}` }))
  }
}

async function askConfirmation() {
  const { data } = await supabaseAdmin.from('interviews').select(SELECT).eq('status', 'scheduled').is('confirm_asked_at', null).lt('scheduled_at', new Date(Date.now() - 15 * MIN).toISOString()).limit(200)
  for (const r of (data || []) as unknown as Row[]) {
    if (new Date(r.scheduled_at).getTime() + r.duration_min * MIN > Date.now()) continue
    const { data: claimed } = await supabaseAdmin.from('interviews').update({ confirm_asked_at: new Date().toISOString() }).eq('id', r.id).is('confirm_asked_at', null).select('id').maybeSingle()
    if (!claimed) continue
    const { members } = await parties(r)
    await notify(
      [r.application.user_id, ...members].map((user_id) => ({
        user_id,
        type: 'interview_confirm',
        title: `Did the interview for ${r.application.job.title} happen?`,
        body: 'One tap to confirm. Only confirmed interviews count.',
        link: `/interviews/${r.id}`,
      })),
    )
  }
}

export const interviewTasks: Task[] = [
  { name: 'interviews.reminders', everyMs: 30 * MIN, run: reminders },
  { name: 'interviews.confirm', everyMs: 30 * MIN, run: askConfirmation },
]
