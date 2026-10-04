// ============================================================
// FILE: apps/backend/src/jobs/billing.jobs.ts
// Renewal reminders (3 days before) and downgrades after expiry.
// ============================================================

import { supabaseAdmin } from '../config/supabase'
import { notify } from '../utils/recruiter'
import { emailHtml, sendEmail } from '../services/email.service'
import type { Task } from './scheduler'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

async function remindUsers() {
  const now = new Date()
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, email, plan_expires_at')
    .eq('plan', 'pro')
    .is('renewal_reminded_at', null)
    .gt('plan_expires_at', now.toISOString())
    .lt('plan_expires_at', new Date(now.getTime() + 3 * DAY).toISOString())
    .limit(200)
  for (const u of data || []) {
    // Claim first so a parallel run can't send twice.
    const { data: claimed } = await supabaseAdmin.from('users').update({ renewal_reminded_at: now.toISOString() }).eq('id', u.id).is('renewal_reminded_at', null).select('id').maybeSingle()
    if (!claimed) continue
    const when = fmt(u.plan_expires_at)
    await notify([{ user_id: u.id, type: 'billing', title: `Pro ends on ${when}`, body: 'Renew to keep unlimited access.', link: '/billing/checkout' }])
    if (u.email) await sendEmail(u.email, `Your Pro plan ends on ${when}`, emailHtml(`Your Pro plan ends on ${when}`, ['Renew any time before then and the new 30 days are added on top.'], { label: 'Renew', path: '/billing/checkout' }))
  }
}

async function remindCompanies() {
  const now = new Date()
  const { data } = await supabaseAdmin
    .from('companies')
    .select('id, name, pro_until')
    .is('pro_reminded_at', null)
    .gt('pro_until', now.toISOString())
    .lt('pro_until', new Date(now.getTime() + 3 * DAY).toISOString())
    .limit(200)
  for (const c of data || []) {
    const { data: claimed } = await supabaseAdmin.from('companies').update({ pro_reminded_at: now.toISOString() }).eq('id', c.id).is('pro_reminded_at', null).select('id').maybeSingle()
    if (!claimed) continue
    const { data: owners } = await supabaseAdmin.from('company_members').select('user_id, user:users(email)').eq('company_id', c.id).eq('member_role', 'owner')
    const when = fmt(c.pro_until)
    for (const o of (owners || []) as unknown as { user_id: string; user: { email: string } | null }[]) {
      await notify([{ user_id: o.user_id, type: 'billing', title: `Recruiter plan ends on ${when}`, link: '/billing/checkout' }])
      if (o.user?.email) await sendEmail(o.user.email, `${c.name}: recruiter plan ends on ${when}`, emailHtml('Your recruiter plan is ending', [`${c.name}'s plan ends on ${when}. Extra open jobs pause after that.`], { label: 'Renew', path: '/billing/checkout' }))
    }
  }
}

async function downgradeExpired() {
  const { data } = await supabaseAdmin.from('users').update({ plan: 'free' }).eq('plan', 'pro').lt('plan_expires_at', new Date().toISOString()).select('id')
  if (data?.length) await notify(data.map((u) => ({ user_id: u.id, type: 'billing', title: 'Your Pro plan has ended', body: 'Free limits apply again. Nothing you saved was removed.', link: '/billing/checkout' })))
}

export const billingTasks: Task[] = [
  { name: 'billing.reminders', everyMs: 6 * HOUR, run: async () => { await remindUsers(); await remindCompanies() } },
  { name: 'billing.downgrade', everyMs: HOUR, run: downgradeExpired },
]
