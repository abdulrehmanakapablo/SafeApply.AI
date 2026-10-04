// ============================================================
// FILE: apps/backend/src/jobs/accountability.jobs.ts
// • Applicants with no reply after 21 days are marked "no response"
//   (counted publicly) and told so, instead of waiting forever.
// • Scores, ghost flags and automatic penalties are recomputed hourly.
// ============================================================

import { supabaseAdmin } from '../config/supabase'
import { notify } from '../utils/recruiter'
import type { Task } from './scheduler'

const HOUR = 3_600_000
const NO_RESPONSE_DAYS = 21

async function markNoResponse() {
  const cutoff = new Date(Date.now() - NO_RESPONSE_DAYS * 24 * HOUR).toISOString()
  const { data } = await supabaseAdmin
    .from('job_applications')
    .update({ no_response: true })
    .is('first_response_at', null)
    .eq('no_response', false)
    .lt('created_at', cutoff)
    .select('id, user_id, job:jobs(title, company:companies(name))')
  const rows = (data || []) as unknown as { id: string; user_id: string; job: { title: string; company: { name: string } | null } | null }[]
  if (rows.length) {
    await notify(
      rows.map((r) => ({
        user_id: r.user_id,
        type: 'no_response',
        title: `No reply from ${r.job?.company?.name || 'the company'} after ${NO_RESPONSE_DAYS} days`,
        body: `${r.job?.title || 'Your application'} is now counted as unanswered on their public record.`,
        link: `/dashboard/applications/${r.id}`,
      })),
    )
  }
}

async function refresh() {
  const { error } = await supabaseAdmin.rpc('refresh_accountability')
  if (error) throw new Error(error.message)
  const { error: e2 } = await supabaseAdmin.rpc('refresh_interview_scores')
  if (e2) throw new Error(e2.message)
}

export const accountabilityTasks: Task[] = [
  { name: 'accountability.no_response', everyMs: HOUR, run: markNoResponse },
  { name: 'accountability.refresh', everyMs: HOUR, run: refresh },
]
