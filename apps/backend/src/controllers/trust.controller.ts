// ============================================================
// FILE: apps/backend/src/controllers/trust.controller.ts
// PURPOSE: Freelance trust tools: contact sharing on contracts, inviting
//          outside clients to verify work, invoices, off-platform payment
//          logs.
// SECURITY: contacts only for the two parties of an active/completed
//   contract (every reveal logged). Invite tokens are 32 random bytes,
//   stored only as SHA-256, single use, 14-day expiry, and can only be
//   answered by the account whose email the invite was sent to.
// ============================================================

import { createHash, randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'
import { stripHtml, uuidParam } from '../utils/sanitize'
import { notify } from '../utils/recruiter'
import { FREE_CAPS, loadUserPro } from '../utils/plans'
import { emailHtml, sendEmail } from '../services/email.service'
import { h, shortName } from './freelance.controller'
import { loadContract } from './contracts.controller'

const INVITE_DAYS = 14
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/

async function overCap(uid: string, table: 'invoices' | 'client_invites', cap: number): Promise<boolean> {
  if (await loadUserPro(uid)) return false
  const { count } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('freelancer_id', uid)
  return (count || 0) >= cap
}

// ─── Contacts (contract parties only) ────────────────────────

export const getContacts = h('trust.contacts', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  if (r.c.status === 'cancelled') return sendError(res, 'Contact details are shared only on active or completed contracts.', 403)
  const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email, phone').in('id', [r.c.client_id, r.c.freelancer_id])
  const { data: profile } = await supabaseAdmin.from('freelancer_profiles').select('portfolio_url').eq('user_id', r.c.freelancer_id).maybeSingle()
  await supabaseAdmin.from('contact_views').upsert({ contract_id: r.c.id, viewer_id: req.user!.userId }, { onConflict: 'contract_id,viewer_id', ignoreDuplicates: true })
  const pick = (id: string) => {
    const u = users?.find((x) => x.id === id)
    return { name: u?.full_name || 'Member', email: u?.email || null, phone: u?.phone || null }
  }
  sendSuccess(res, { client: pick(r.c.client_id), freelancer: { ...pick(r.c.freelancer_id), portfolio_url: profile?.portfolio_url ?? null } })
})

// ─── Off-platform payment log ────────────────────────────────

export const listPayments = h('trust.payments', async (req, res) => {
  const r = await loadContract(req, res)
  if (!r) return
  const { data, error } = await supabaseAdmin
    .from('payment_logs')
    .select('id, milestone_id, logged_by, amount, method, paid_on, note, confirmed, confirmed_at, created_at')
    .eq('contract_id', r.c.id)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  const uid = req.user!.userId
  sendSuccess(res, (data || []).map(({ logged_by, ...p }) => ({ ...p, by: logged_by === r.c.client_id ? 'client' : 'freelancer', mine: logged_by === uid })))
})

export const logPayment = h('trust.logPayment', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  if (r.c.status === 'cancelled') return sendError(res, 'This contract was cancelled.', 409)
  const mid = req.body.milestone_id ? uuidParam(req.body.milestone_id) : null
  if (mid) {
    const { data: m } = await supabaseAdmin.from('milestones').select('id').eq('id', mid).eq('contract_id', r.c.id).maybeSingle()
    if (!m) return sendError(res, 'Milestone not found', 404)
  }
  const { data, error } = await supabaseAdmin
    .from('payment_logs')
    .insert({ contract_id: r.c.id, milestone_id: mid, logged_by: req.user!.userId, amount: req.body.amount, method: req.body.method, paid_on: req.body.paid_on, note: stripHtml(req.body.note || '') || null })
    .select('id')
    .single()
  if (error) throw error
  const other = r.side === 'client' ? r.c.freelancer_id : r.c.client_id
  const otherSide = r.side === 'client' ? 'freelancer' : 'client'
  await notify([{ user_id: other, type: 'payment_log', title: `Payment logged on “${r.c.title}”`, body: 'Confirm whether you sent or received it.', link: `/${otherSide}/contracts/${r.c.id}` }])
  sendSuccess(res, data, 201, 'Payment logged')
})

export const confirmPayment = h('trust.confirmPayment', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const pid = uuidParam(req.params.pid)
  if (!pid) return sendError(res, 'Payment not found', 404)
  // Only the side that did NOT log it can confirm.
  const { data } = await supabaseAdmin
    .from('payment_logs')
    .update({ confirmed: Boolean(req.body.confirmed), confirmed_at: new Date().toISOString() })
    .eq('id', pid)
    .eq('contract_id', r.c.id)
    .neq('logged_by', req.user!.userId)
    .is('confirmed', null)
    .select('id')
    .maybeSingle()
  if (!data) return sendError(res, 'This payment can’t be confirmed by you.', 409)
  sendSuccess(res, { id: pid, confirmed: Boolean(req.body.confirmed) })
})

// ─── Invites + verified work ─────────────────────────────────

export const createInvite = h('trust.createInvite', async (req, res) => {
  const uid = req.user!.userId
  if (await overCap(uid, 'client_invites', FREE_CAPS.client_invites)) {
    return sendError(res, `The free plan includes ${FREE_CAPS.client_invites} client invites. Upgrade to Freelancer Pro for unlimited.`, 403, 'FREE_LIMIT_REACHED')
  }
  const email = String(req.body.client_email).trim().toLowerCase()
  const { data: me } = await supabaseAdmin.from('users').select('email, full_name').eq('id', uid).single()
  if (me?.email?.toLowerCase() === email) return sendError(res, 'You can’t invite yourself.', 400)
  const { count } = await supabaseAdmin.from('client_invites').select('id', { count: 'exact', head: true }).eq('freelancer_id', uid).eq('client_email', email).eq('status', 'pending')
  if (count) return sendError(res, 'There’s already a pending invite for this email.', 409)

  const token = randomBytes(32).toString('base64url')
  const { data: inv, error } = await supabaseAdmin
    .from('client_invites')
    .insert({ freelancer_id: uid, client_name: stripHtml(req.body.client_name), client_email: email, token_hash: sha(token), expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() })
    .select('id')
    .single()
  if (error) throw error
  const { error: wErr } = await supabaseAdmin.from('verified_work').insert({
    freelancer_id: uid,
    invite_id: inv.id,
    title: stripHtml(req.body.title),
    description: stripHtml(req.body.description || '') || null,
    amount: req.body.amount ?? null,
    currency: req.body.currency,
    completed_on: req.body.completed_on || null,
  })
  if (wErr) {
    await supabaseAdmin.from('client_invites').delete().eq('id', inv.id)
    throw wErr
  }
  const name = me?.full_name || 'A freelancer'
  const sent = await sendEmail(
    email,
    `${name} asked you to confirm their work`,
    emailHtml(`${name} asked you to confirm their work`, [`They listed “${stripHtml(req.body.title)}” as work they did for you.`, 'Confirming takes one click and helps them build a verified record. The link works for 14 days.'], { label: 'Review and confirm', path: `/invite/${token}` }),
  )
  // The link is returned once so the freelancer can share it directly if email isn't set up.
  sendSuccess(res, { id: inv.id, link: `/invite/${token}`, emailed: sent }, 201, 'Invite created')
})

export const revokeInvite = h('trust.revokeInvite', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Invite not found', 404)
  const { data } = await supabaseAdmin.from('client_invites').update({ status: 'revoked' }).eq('id', id).eq('freelancer_id', req.user!.userId).eq('status', 'pending').select('id').maybeSingle()
  if (!data) return sendError(res, 'This invite can’t be revoked.', 409)
  sendSuccess(res, { id, status: 'revoked' })
})

async function inviteByToken(token: string) {
  if (!TOKEN_RE.test(token)) return null
  const { data } = await supabaseAdmin
    .from('client_invites')
    .select('id, freelancer_id, client_name, client_email, status, expires_at, work:verified_work(id, title, description, amount, currency, completed_on, status)')
    .eq('token_hash', sha(token))
    .maybeSingle()
  return data
}

/** Public preview of an invite. Never reveals the invited email. */
export const getInvite = h('trust.getInvite', async (req, res) => {
  const inv = await inviteByToken(String(req.params.token))
  if (!inv) return sendError(res, 'This invite link isn’t valid.', 404)
  const { data: f } = await supabaseAdmin.from('users').select('full_name').eq('id', inv.freelancer_id).maybeSingle()
  const work = (Array.isArray(inv.work) ? inv.work[0] : inv.work) as Record<string, unknown> | null
  const expired = inv.status === 'pending' && new Date(inv.expires_at).getTime() < Date.now()
  sendSuccess(res, {
    freelancer: { id: inv.freelancer_id, name: f?.full_name || 'Freelancer' },
    client_name: inv.client_name,
    status: expired ? 'expired' : inv.status,
    work: work ? { title: work.title, description: work.description, amount: work.amount, currency: work.currency, completed_on: work.completed_on } : null,
  })
})

export const respondInvite = h('trust.respondInvite', async (req, res) => {
  const inv = await inviteByToken(String(req.params.token))
  if (!inv) return sendError(res, 'This invite link isn’t valid.', 404)
  if (inv.status !== 'pending' || new Date(inv.expires_at).getTime() < Date.now()) return sendError(res, 'This invite has expired or was already answered.', 409)
  const uid = req.user!.userId
  if (uid === inv.freelancer_id) return sendError(res, 'You can’t confirm your own work.', 403)
  const { data: me } = await supabaseAdmin.from('users').select('email').eq('id', uid).single()
  if (me?.email?.toLowerCase() !== inv.client_email.toLowerCase()) {
    return sendError(res, 'Log in with the email address this invite was sent to.', 403, 'WRONG_ACCOUNT')
  }
  const confirmed = Boolean(req.body.confirmed)
  const now = new Date().toISOString()
  const { data: claimed } = await supabaseAdmin.from('client_invites').update({ status: confirmed ? 'accepted' : 'declined', responded_by: uid, responded_at: now }).eq('id', inv.id).eq('status', 'pending').select('id').maybeSingle()
  if (!claimed) return sendError(res, 'This invite was already answered.', 409)
  await supabaseAdmin
    .from('verified_work')
    .update({ client_id: uid, status: confirmed ? 'verified' : 'declined', client_note: stripHtml(req.body.note || '') || null, verified_at: confirmed ? now : null })
    .eq('invite_id', inv.id)
  await notify([{ user_id: inv.freelancer_id, type: 'verified_work', title: confirmed ? `${inv.client_name} confirmed your work` : `${inv.client_name} didn’t confirm the work`, link: '/freelancer/work' }])
  sendSuccess(res, { status: confirmed ? 'accepted' : 'declined' })
})

/** Freelancer's own record: completed platform contracts + invite-based work. */
export const myWork = h('trust.myWork', async (req, res) => {
  const uid = req.user!.userId
  const [{ data: contracts }, { data: work }] = await Promise.all([
    supabaseAdmin.from('contracts').select('id, title, amount, currency, completed_at, client_id').eq('freelancer_id', uid).eq('status', 'completed').order('completed_at', { ascending: false }).limit(200),
    supabaseAdmin
      .from('verified_work')
      .select('id, title, description, amount, currency, completed_on, status, client_note, verified_at, created_at, invite:client_invites(id, client_name, client_email, status, expires_at)')
      .eq('freelancer_id', uid)
      .order('created_at', { ascending: false })
      .limit(200),
  ])
  const ids = [...new Set<string>((contracts || []).map((c: { client_id: string }) => c.client_id))]
  const names: Record<string, string> = {}
  if (ids.length) {
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', ids)
    for (const u of users || []) names[u.id] = shortName(u.full_name)
  }
  sendSuccess(res, {
    contracts: (contracts || []).map(({ client_id, ...c }: { client_id: string }) => ({ ...c, client: names[client_id] || 'Client' })),
    work: (work || []).map((w: Record<string, unknown>) => ({ ...w, invite: Array.isArray(w.invite) ? w.invite[0] : w.invite })),
  })
})

// ─── Invoices ────────────────────────────────────────────────

type Item = { description: string; qty: number; unit_amount: number }
const totalOf = (items: Item[]) => items.reduce((n, i) => n + Math.round(i.qty * i.unit_amount), 0)
const INVOICE_FIELDS = 'id, freelancer_id, contract_id, client_id, number, client_name, client_email, items, currency, total, notes, status, issued_on, due_on, paid_on, created_at, updated_at'

export const listMyInvoices = h('trust.invoices', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('invoices').select(INVOICE_FIELDS).eq('freelancer_id', req.user!.userId).order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  sendSuccess(res, data || [])
})

export const listClientInvoices = h('trust.clientInvoices', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(INVOICE_FIELDS)
    .eq('client_id', req.user!.userId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  const ids = [...new Set<string>((data || []).map((i: { freelancer_id: string }) => i.freelancer_id))]
  const names: Record<string, string> = {}
  if (ids.length) {
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', ids)
    for (const u of users || []) names[u.id] = u.full_name
  }
  sendSuccess(res, (data || []).map((i: { freelancer_id: string }) => ({ ...i, freelancer_name: names[i.freelancer_id] || 'Freelancer' })))
})

export const getInvoice = h('trust.invoice', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Invoice not found', 404)
  const uid = req.user!.userId
  const { data: inv } = await supabaseAdmin.from('invoices').select(INVOICE_FIELDS).eq('id', id).maybeSingle()
  const mine = inv?.freelancer_id === uid
  if (!inv || (!mine && !(inv.client_id === uid && inv.status !== 'draft'))) return sendError(res, 'Invoice not found', 404)
  const { data: f } = await supabaseAdmin.from('users').select('full_name, email').eq('id', inv.freelancer_id).single()
  sendSuccess(res, { ...inv, side: mine ? 'freelancer' : 'client', from: { name: f?.full_name, email: f?.email } })
})

export const createInvoice = h('trust.createInvoice', async (req, res) => {
  const uid = req.user!.userId
  if (await overCap(uid, 'invoices', FREE_CAPS.invoices)) {
    return sendError(res, `The free plan includes ${FREE_CAPS.invoices} invoices. Upgrade to Freelancer Pro for unlimited.`, 403, 'FREE_LIMIT_REACHED')
  }
  const b = req.body
  let clientId: string | null = null
  if (b.contract_id) {
    const { data: c } = await supabaseAdmin.from('contracts').select('id, client_id').eq('id', b.contract_id).eq('freelancer_id', uid).maybeSingle()
    if (!c) return sendError(res, 'Contract not found', 404)
    clientId = c.client_id
  }
  const items = (b.items as Item[]).map((i) => ({ description: stripHtml(i.description), qty: i.qty, unit_amount: i.unit_amount }))
  const year = new Date().getUTCFullYear()
  // Sequential per freelancer per year; the unique index guards races (retry once).
  for (let attempt = 0; attempt < 2; attempt++) {
    const { count } = await supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('freelancer_id', uid).like('number', `INV-${year}-%`)
    const number = `INV-${year}-${String((count || 0) + 1 + attempt).padStart(4, '0')}`
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        freelancer_id: uid,
        contract_id: b.contract_id || null,
        client_id: clientId,
        number,
        client_name: stripHtml(b.client_name),
        client_email: b.client_email || null,
        items,
        currency: b.currency,
        total: totalOf(items),
        notes: stripHtml(b.notes || '') || null,
        issued_on: b.issued_on,
        due_on: b.due_on || null,
      })
      .select('id, number')
      .single()
    if (!error) return sendSuccess(res, data, 201, 'Invoice created')
    if (error.code !== '23505') throw error
  }
  sendError(res, 'Couldn’t number the invoice. Try again.', 409)
})

const NEXT: Record<string, string[]> = { draft: ['draft', 'sent', 'void'], sent: ['sent', 'paid', 'void'], paid: ['paid'], void: ['void'] }

export const updateInvoice = h('trust.updateInvoice', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Invoice not found', 404)
  const uid = req.user!.userId
  const { data: cur } = await supabaseAdmin.from('invoices').select('status, client_id, number, contract_id').eq('id', id).eq('freelancer_id', uid).maybeSingle()
  if (!cur) return sendError(res, 'Invoice not found', 404)
  const b = req.body
  const status: string = b.status ?? cur.status
  if (!NEXT[cur.status].includes(status)) return sendError(res, 'That status change isn’t allowed.', 409)
  const editsContent = ['items', 'client_name', 'client_email', 'currency', 'notes', 'issued_on', 'due_on'].some((k) => k in b)
  if (editsContent && cur.status !== 'draft') return sendError(res, 'Only drafts can be edited. Void it and create a new one.', 409)
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (b.items) {
    patch.items = (b.items as Item[]).map((i) => ({ description: stripHtml(i.description), qty: i.qty, unit_amount: i.unit_amount }))
    patch.total = totalOf(patch.items as Item[])
  }
  for (const k of ['client_email', 'currency', 'issued_on', 'due_on'] as const) if (k in b) patch[k] = b[k] || null
  if ('client_name' in b) patch.client_name = stripHtml(b.client_name)
  if ('notes' in b) patch.notes = stripHtml(b.notes || '') || null
  if (status === 'paid' && cur.status !== 'paid') patch.paid_on = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin.from('invoices').update(patch).eq('id', id).eq('freelancer_id', uid).eq('status', cur.status).select(INVOICE_FIELDS).maybeSingle()
  if (error) throw error
  if (!data) return sendError(res, 'The invoice changed meanwhile. Reload and try again.', 409)
  if (status === 'sent' && cur.status === 'draft' && cur.client_id) {
    const side = 'client'
    await notify([{ user_id: cur.client_id, type: 'invoice', title: `New invoice ${cur.number}`, link: `/${side}/invoices/${id}` }])
  }
  sendSuccess(res, data, 200, 'Invoice saved')
})
