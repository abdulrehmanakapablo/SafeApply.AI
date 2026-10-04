// ============================================================
// FILE: apps/backend/src/controllers/contracts.controller.ts
// PURPOSE: Contracts between a client and a freelancer: milestones,
//          messages, cancellation, two-way reviews.
// SECURITY: every call loads the contract and checks the caller is one of
//           its two parties (admins may read, never act). Milestone ids are
//           re-checked against the contract id. State changes use
//           conditional updates or the atomic fl_* functions.
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'
import { stripHtml, uuidParam } from '../utils/sanitize'
import { notify } from '../utils/recruiter'
import { h, rpcFail } from './freelance.controller'

export interface Contract {
  id: string
  project_id: string
  client_id: string
  freelancer_id: string
  title: string
  amount: number
  currency: string
  status: 'active' | 'completed' | 'cancelled'
  cancel_reason: string | null
  cancelled_by: string | null
  created_at: string
  completed_at: string | null
}
type Side = 'client' | 'freelancer' | 'admin'

const FIELDS = 'id, project_id, client_id, freelancer_id, title, amount, currency, status, cancel_reason, cancelled_by, created_at, completed_at'
const linkFor = (side: 'client' | 'freelancer', id: string) => `/${side}/contracts/${id}`

/** Contract + the caller's side, or null (sends 404) if they aren't a party. */
export async function loadContract(req: Request, res: Response, act = false): Promise<{ c: Contract; side: Side } | null> {
  const id = uuidParam(req.params.id)
  const uid = req.user!.userId
  const { data: c } = id ? await supabaseAdmin.from('contracts').select(FIELDS).eq('id', id).maybeSingle() : { data: null }
  const side: Side | null = !c ? null : c.client_id === uid ? 'client' : c.freelancer_id === uid ? 'freelancer' : req.user!.role === 'admin' && !act ? 'admin' : null
  if (!c || !side) {
    sendError(res, 'Contract not found', 404)
    return null
  }
  return { c: c as Contract, side }
}

const other = (c: Contract, side: Side) => (side === 'client' ? c.freelancer_id : c.client_id)

export const listContracts = h('listContracts', async (req, res) => {
  const uid = req.user!.userId
  const { data, error } = await supabaseAdmin
    .from('contracts')
    .select(`${FIELDS}, milestones(status)`)
    .or(`client_id.eq.${uid},freelancer_id.eq.${uid}`)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = (data || []) as unknown as (Contract & { milestones: { status: string }[] })[]
  const ids = [...new Set(rows.map((c) => (c.client_id === uid ? c.freelancer_id : c.client_id)))]
  const names: Record<string, string> = {}
  if (ids.length) {
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', ids)
    for (const u of users || []) names[u.id] = u.full_name
  }
  sendSuccess(
    res,
    rows.map(({ milestones, client_id, freelancer_id, cancelled_by: _cb, ...c }) => {
      const side = client_id === uid ? 'client' : 'freelancer'
      const otherId = side === 'client' ? freelancer_id : client_id
      return {
        ...c,
        side,
        other_party: names[otherId] || 'Member',
        milestones_total: milestones.length,
        milestones_approved: milestones.filter((m) => m.status === 'approved').length,
        needs_action: milestones.some((m) => (side === 'client' ? m.status === 'submitted' : m.status === 'revision')),
      }
    }),
  )
})

export const getContract = h('getContract', async (req, res) => {
  const r = await loadContract(req, res)
  if (!r) return
  const { c, side } = r
  const [{ data: milestones }, { data: users }, { data: reviews }] = await Promise.all([
    supabaseAdmin.from('milestones').select('id, position, title, amount, due_date, status, note, feedback, submitted_at, approved_at').eq('contract_id', c.id).order('position'),
    supabaseAdmin.from('users').select('id, full_name').in('id', [c.client_id, c.freelancer_id]),
    supabaseAdmin.from('freelance_reviews').select('reviewer_id, rating, comment, created_at').eq('contract_id', c.id),
  ])
  const name = (id: string) => users?.find((u) => u.id === id)?.full_name || 'Member'
  const { cancelled_by, ...rest } = c
  sendSuccess(res, {
    ...rest,
    side,
    cancelled_by_side: cancelled_by ? (cancelled_by === c.client_id ? 'client' : 'freelancer') : null,
    client: { name: name(c.client_id) },
    freelancer: { id: c.freelancer_id, name: name(c.freelancer_id) },
    milestones: milestones || [],
    reviews: (reviews || []).map(({ reviewer_id, ...x }) => ({ ...x, by: reviewer_id === c.client_id ? 'client' : 'freelancer' })),
  })
})

/** Milestone row of this contract, or null. */
async function milestone(contractId: string, raw: unknown) {
  const mid = uuidParam(raw)
  if (!mid) return null
  const { data } = await supabaseAdmin.from('milestones').select('id, title, status').eq('id', mid).eq('contract_id', contractId).maybeSingle()
  return data
}

export const submitMilestone = h('submitMilestone', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const { c, side } = r
  if (side !== 'freelancer') return sendError(res, 'Only the freelancer can hand in work.', 403)
  if (c.status !== 'active') return sendError(res, 'This contract is no longer active.', 409)
  const m = await milestone(c.id, req.params.mid)
  if (!m) return sendError(res, 'Milestone not found', 404)
  const { data } = await supabaseAdmin
    .from('milestones')
    .update({ status: 'submitted', note: stripHtml(req.body.note || '') || null, submitted_at: new Date().toISOString() })
    .eq('id', m.id)
    .in('status', ['pending', 'revision'])
    .select('id, status, note, submitted_at')
    .maybeSingle()
  if (!data) return sendError(res, 'This milestone can’t be handed in right now.', 409)
  await notify([{ user_id: c.client_id, type: 'milestone', title: `Work handed in: ${m.title}`, body: `Review it on “${c.title}”.`, link: linkFor('client', c.id) }])
  sendSuccess(res, data, 200, 'Work handed in')
})

export const approveMilestone = h('approveMilestone', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const { c, side } = r
  if (side !== 'client') return sendError(res, 'Only the client can approve work.', 403)
  const m = await milestone(c.id, req.params.mid)
  if (!m) return sendError(res, 'Milestone not found', 404)
  const { data: status, error } = await supabaseAdmin.rpc('fl_approve', { p_milestone: m.id, p_client: c.client_id })
  if (error) return rpcFail(res, error)
  await notify([
    {
      user_id: c.freelancer_id,
      type: 'milestone',
      title: status === 'completed' ? `Contract complete: ${c.title}` : `Approved: ${m.title}`,
      body: status === 'completed' ? 'Every milestone is approved. Leave a review for the client.' : undefined,
      link: linkFor('freelancer', c.id),
    },
  ])
  sendSuccess(res, { contract_status: status }, 200, status === 'completed' ? 'Contract complete' : 'Milestone approved')
})

export const requestRevision = h('requestRevision', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const { c, side } = r
  if (side !== 'client') return sendError(res, 'Only the client can ask for changes.', 403)
  if (c.status !== 'active') return sendError(res, 'This contract is no longer active.', 409)
  const m = await milestone(c.id, req.params.mid)
  if (!m) return sendError(res, 'Milestone not found', 404)
  const { data } = await supabaseAdmin
    .from('milestones')
    .update({ status: 'revision', feedback: stripHtml(req.body.feedback) })
    .eq('id', m.id)
    .eq('status', 'submitted')
    .select('id, status, feedback')
    .maybeSingle()
  if (!data) return sendError(res, 'Only handed-in work can be sent back.', 409)
  await notify([{ user_id: c.freelancer_id, type: 'milestone', title: `Changes requested: ${m.title}`, link: linkFor('freelancer', c.id) }])
  sendSuccess(res, data, 200, 'Changes requested')
})

export const cancelContract = h('cancelContract', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const { c, side } = r
  const { error } = await supabaseAdmin.rpc('fl_cancel', { p_contract: c.id, p_user: req.user!.userId, p_reason: stripHtml(req.body.reason) })
  if (error) return rpcFail(res, error)
  const to = side === 'client' ? 'freelancer' : 'client'
  await notify([{ user_id: other(c, side), type: 'contract', title: `Contract cancelled: ${c.title}`, link: linkFor(to, c.id) }])
  sendSuccess(res, { status: 'cancelled' }, 200, 'Contract cancelled')
})

export const listContractMessages = h('listContractMessages', async (req, res) => {
  const r = await loadContract(req, res)
  if (!r) return
  const { data, error } = await supabaseAdmin
    .from('contract_messages')
    .select('id, sender_id, body, created_at')
    .eq('contract_id', r.c.id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  const uid = req.user!.userId
  sendSuccess(
    res,
    (data || []).reverse().map(({ sender_id, ...m }) => ({ ...m, mine: sender_id === uid, from: sender_id === r.c.client_id ? 'client' : 'freelancer' })),
  )
})

export const postContractMessage = h('postContractMessage', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const body = stripHtml(req.body.body)
  if (!body) return sendError(res, 'Message can’t be empty.', 400)
  const { data, error } = await supabaseAdmin
    .from('contract_messages')
    .insert({ contract_id: r.c.id, sender_id: req.user!.userId, body })
    .select('id, body, created_at')
    .single()
  if (error) throw error
  const to = r.side === 'client' ? 'freelancer' : 'client'
  await notify([{ user_id: other(r.c, r.side), type: 'message', title: `New message on “${r.c.title}”`, body: body.slice(0, 140), link: linkFor(to, r.c.id) }])
  sendSuccess(res, { ...data, mine: true, from: r.side }, 201)
})

export const reviewContract = h('reviewContract', async (req, res) => {
  const r = await loadContract(req, res, true)
  if (!r) return
  const { c, side } = r
  if (c.status !== 'completed') return sendError(res, 'Reviews open once the contract is complete.', 409)
  const comment = stripHtml(req.body.comment)
  if (comment.length < 20) return sendError(res, 'Write at least 20 characters.', 400)
  const { error } = await supabaseAdmin.from('freelance_reviews').insert({
    contract_id: c.id,
    reviewer_id: req.user!.userId,
    reviewee_id: other(c, side),
    rating: req.body.rating,
    comment,
  })
  if (error) {
    if (error.code === '23505') return sendError(res, 'You’ve already reviewed this contract.', 409)
    throw error
  }
  sendSuccess(res, null, 201, 'Review posted')
})
