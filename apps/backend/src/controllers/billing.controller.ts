// ============================================================
// FILE: apps/backend/src/controllers/billing.controller.ts
// PURPOSE: Plans, manual local payments, plan status + usage, and the
//          admin side (approve payments, set the spending budget).
// SECURITY: the plan a user pays for is derived from their role, never
//           trusted from the body. Transaction ids are unique per method
//           (DB index). Approval runs in billing_approve() atomically.
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { env } from '../config/env'
import { sendError, sendPaginated, sendSuccess } from '../utils/response'
import { pageParam, stripHtml, uuidParam } from '../utils/sanitize'
import { FOUNDING_SEATS, FREE_CAPS, PERIOD_DAYS, PLANS, isActive, planKeyForRole, userIsPro, type PlanKey } from '../utils/plans'
import { FREE_LIMIT, countUsage } from '../utils/usage'
import { budgetState, resetBudgetCache } from '../utils/budget'
import { getMembership, notify } from '../utils/recruiter'
import { emailHtml, sendEmail } from '../services/email.service'
import { h } from './freelance.controller'

const MAX_PENDING = 2
const PAGE = 20

export const getConfig = h('billing.config', async (_req, res) => {
  const { count } = await supabaseAdmin.from('manual_payments').select('id', { count: 'exact', head: true }).eq('status', 'approved')
  const a = env.payAccounts
  sendSuccess(res, {
    plans: PLANS,
    period_days: PERIOD_DAYS,
    free_limit: FREE_LIMIT,
    free_caps: FREE_CAPS,
    founding_left: Math.max(0, FOUNDING_SEATS - (count || 0)),
    card_enabled: false,
    methods: {
      jazzcash: a.jazzcash.number ? a.jazzcash : null,
      easypaisa: a.easypaisa.number ? a.easypaisa : null,
      bank: a.bank.iban ? a.bank : null,
    },
  })
})

type Usage = { key: string; label: string; used: number; limit: number | null }

/** Current plan, expiry and usage for the caller's side of the platform. */
export const getStatus = h('billing.status', async (req, res) => {
  const uid = req.user!.userId
  const { data: u } = await supabaseAdmin.from('users').select('role, plan, plan_expires_at, trust_level').eq('id', uid).single()
  const role = u?.role || 'user'
  const planKey = planKeyForRole(role)
  let pro = userIsPro(u || {})
  let until: string | null = u?.plan === 'lifetime' ? null : u?.plan_expires_at ?? null
  const usage: Usage[] = []
  let trust = u?.trust_level ?? 0

  if (role === 'recruiter' || role === 'admin') {
    const m = await getMembership(uid)
    if (role === 'recruiter') {
      pro = isActive(m?.company.pro_until)
      until = m?.company.pro_until ?? null
      if (m) trust = (await supabaseAdmin.from('companies').select('trust_level').eq('id', m.company_id).single()).data?.trust_level ?? 0
    }
    if (m) {
      const { count } = await supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', m.company_id).eq('status', 'open')
      usage.push({ key: 'open_jobs', label: 'Open jobs', used: count || 0, limit: pro ? null : FREE_CAPS.open_jobs })
    }
  }
  if (role === 'user' || role === 'admin') {
    const [r, c, a] = await Promise.all([countUsage(uid, 'reports'), countUsage(uid, 'cv_matches'), countUsage(uid, 'applications')])
    const lim = pro ? null : FREE_LIMIT
    usage.push({ key: 'reports', label: 'Company reports', used: r, limit: lim }, { key: 'cv_matches', label: 'CV matches', used: c, limit: lim }, { key: 'applications', label: 'Tracked applications', used: a, limit: lim })
  }
  if (role === 'client') {
    const { count } = await supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('client_id', uid).eq('status', 'open')
    usage.push({ key: 'open_projects', label: 'Open projects', used: count || 0, limit: pro ? null : FREE_CAPS.open_projects })
  }
  if (role === 'freelancer') {
    const [inv, invites] = await Promise.all([
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('freelancer_id', uid),
      supabaseAdmin.from('client_invites').select('id', { count: 'exact', head: true }).eq('freelancer_id', uid),
    ])
    usage.push(
      { key: 'invoices', label: 'Invoices', used: inv.count || 0, limit: pro ? null : FREE_CAPS.invoices },
      { key: 'client_invites', label: 'Client invites', used: invites.count || 0, limit: pro ? null : FREE_CAPS.client_invites },
    )
  }

  const [{ data: pending }, budget] = await Promise.all([
    supabaseAdmin.from('manual_payments').select('id, method, amount_pkr, created_at').eq('user_id', uid).eq('status', 'pending').order('created_at', { ascending: false }).limit(MAX_PENDING),
    budgetState(),
  ])
  sendSuccess(res, {
    role,
    plan_key: planKey,
    pro: role === 'admin' ? true : pro,
    until,
    usage,
    pending: pending || [],
    free_ai_paused: !pro && budget.freePaused,
    trust_level: trust,
  })
})

export const submitManual = h('billing.manual', async (req, res) => {
  const uid = req.user!.userId
  const { data: u } = await supabaseAdmin.from('users').select('role, email').eq('id', uid).single()
  const planKey = planKeyForRole(u?.role)
  if (!planKey) return sendError(res, 'This account type doesn’t need a plan.', 400)
  if (planKey === 'recruiter' && !(await getMembership(uid))) return sendError(res, 'Set up your company profile before paying.', 409, 'NO_COMPANY')

  const method = req.body.method as 'jazzcash' | 'easypaisa' | 'bank'
  const acct = env.payAccounts[method] as { number?: string; iban?: string }
  if (!acct.number && !acct.iban) return sendError(res, 'That payment method isn’t available.', 400)
  if (req.body.amount_pkr < PLANS[planKey].pkr) return sendError(res, `The amount must be at least PKR ${PLANS[planKey].pkr}.`, 400)

  const { count } = await supabaseAdmin.from('manual_payments').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'pending')
  if ((count || 0) >= MAX_PENDING) return sendError(res, 'You already have payments waiting for review. We’ll check them shortly.', 409)

  const { data, error } = await supabaseAdmin
    .from('manual_payments')
    .insert({
      user_id: uid,
      plan_key: planKey,
      method,
      transaction_id: req.body.transaction_id,
      sender_name: stripHtml(req.body.sender_name),
      amount_pkr: req.body.amount_pkr,
    })
    .select('id, plan_key, method, amount_pkr, status, created_at')
    .single()
  if (error) {
    if (error.code === '23505') return sendError(res, 'This transaction ID has already been submitted.', 409)
    throw error
  }
  const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'admin').limit(20)
  await notify((admins || []).map((a) => ({ user_id: a.id, type: 'payment', title: `Payment to review: PKR ${data.amount_pkr}`, link: '/admin/payments' })))
  sendSuccess(res, data, 201, 'Payment submitted')
})

export const getHistory = h('billing.history', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('manual_payments')
    .select('id, plan_key, method, transaction_id, amount_pkr, status, admin_note, period_end, created_at, reviewed_at')
    .eq('user_id', req.user!.userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  sendSuccess(res, data || [])
})

// ─── Admin ───────────────────────────────────────────────────

export const adminListPayments = h('billing.adminList', async (req, res) => {
  const page = pageParam(req.query.page)
  const status = String(req.query.status ?? 'pending')
  let q = supabaseAdmin.from('manual_payments').select('id, user_id, plan_key, method, transaction_id, sender_name, amount_pkr, status, admin_note, period_end, created_at, reviewed_at', { count: 'exact' })
  if (['pending', 'approved', 'rejected'].includes(status)) q = q.eq('status', status)
  const { data, count, error } = await q.order('created_at', { ascending: status === 'pending' }).range((page - 1) * PAGE, page * PAGE - 1)
  if (error) throw error
  const ids = [...new Set<string>((data || []).map((p: { user_id: string }) => p.user_id))]
  const users: Record<string, { name: string; email: string }> = {}
  if (ids.length) {
    const { data: rows } = await supabaseAdmin.from('users').select('id, full_name, email').in('id', ids)
    for (const r of rows || []) users[r.id] = { name: r.full_name, email: r.email }
  }
  sendPaginated(res, (data || []).map(({ user_id, ...p }: { user_id: string }) => ({ ...p, user: users[user_id] || null })), count || 0, page, PAGE)
})

export const adminReviewPayment = h('billing.adminReview', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Payment not found', 404)
  const note = stripHtml(req.body.note || '')
  const { data: p } = await supabaseAdmin.from('manual_payments').select('id, user_id, plan_key, status, amount_pkr').eq('id', id).maybeSingle()
  if (!p) return sendError(res, 'Payment not found', 404)
  if (p.status !== 'pending') return sendError(res, 'This payment was already reviewed.', 409)
  const { data: user } = await supabaseAdmin.from('users').select('email').eq('id', p.user_id).maybeSingle()
  const billingPath = '/billing/history'

  if (req.body.action === 'reject') {
    if (note.length < 5) return sendError(res, 'Add a short reason so the user knows what to fix.', 400)
    const { data } = await supabaseAdmin
      .from('manual_payments')
      .update({ status: 'rejected', admin_note: note, reviewed_by: req.user!.userId, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!data) return sendError(res, 'This payment was already reviewed.', 409)
    await notify([{ user_id: p.user_id, type: 'payment', title: 'We couldn’t confirm your payment', body: note, link: billingPath }])
    if (user?.email) void sendEmail(user.email, 'We couldn’t confirm your payment', emailHtml('We couldn’t confirm your payment', [note, 'Check the details and submit it again, or reply with your receipt.'], { label: 'Open billing', path: billingPath }))
    return sendSuccess(res, { id, status: 'rejected' })
  }

  const { data: until, error } = await supabaseAdmin.rpc('billing_approve', { p_payment: id, p_admin: req.user!.userId, p_note: note })
  if (error) {
    if (error.message.includes('NO_COMPANY')) return sendError(res, 'This recruiter has no company yet.', 409)
    if (error.message.includes('NOT_PENDING')) return sendError(res, 'This payment was already reviewed.', 409)
    throw error
  }
  const plan = PLANS[p.plan_key as PlanKey]
  const ends = new Date(until as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  await notify([{ user_id: p.user_id, type: 'payment', title: `${plan.name} is active`, body: `Your plan runs until ${ends}.`, link: billingPath }])
  if (user?.email) void sendEmail(user.email, `${plan.name} is active`, emailHtml(`${plan.name} is active`, [`Thanks for paying PKR ${p.amount_pkr}. Your plan runs until ${ends}.`], { label: 'Open SafeApply', path: '/' }))
  sendSuccess(res, { id, status: 'approved', until })
})

export const adminGetBudget = h('billing.adminBudget', async (_req, res) => {
  const [state, { data: history }] = await Promise.all([
    budgetState(true),
    supabaseAdmin.from('spend_months').select('month, ai_usd, search_usd, ai_calls, searches').order('month', { ascending: false }).limit(12),
  ])
  sendSuccess(res, { ...state, history: history || [] })
})

export const adminSetBudget = h('billing.adminSetBudget', async (req, res) => {
  const { free_usd, hard_usd } = req.body as { free_usd: number; hard_usd: number }
  if (hard_usd < free_usd) return sendError(res, 'The hard limit must be at least the free-user limit.', 400)
  const { error } = await supabaseAdmin.from('app_settings').upsert({ key: 'budget', value: { free_usd, hard_usd }, updated_at: new Date().toISOString() })
  if (error) throw error
  resetBudgetCache()
  sendSuccess(res, await budgetState(true), 200, 'Budget saved')
})
