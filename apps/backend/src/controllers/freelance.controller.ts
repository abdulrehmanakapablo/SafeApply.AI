// ============================================================
// FILE: apps/backend/src/controllers/freelance.controller.ts
// PURPOSE: Freelance marketplace: public board + profiles, freelancer
//          profile/proposals, client projects/hiring, admin moderation.
// SECURITY: owner ids always come from req.user (DB-backed role); every
//           mutation filters by owner in the WHERE clause, so another
//           user's id can never match. Multi-row changes go through the
//           fl_* SQL functions (atomic, row-locked). Emails are never
//           returned; clients appear publicly as "First L.".
// ============================================================

import { FREE_CAPS, PRO_CEILING, loadUserPro } from '../utils/plans'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendPaginated, sendSuccess } from '../utils/response'
import { pageParam, safeSearchTerm, stripHtml, uuidParam } from '../utils/sanitize'
import { notify } from '../utils/recruiter'

type H = (req: Request, res: Response) => Promise<void>
/** Wraps a handler so an unexpected throw is logged once and returns a 500. */
export const h =
  (name: string, fn: H): H =>
  async (req, res) => {
    try {
      await fn(req, res)
    } catch (e) {
      console.error(`freelance.${name}`, e instanceof Error ? e.message : e)
      if (!res.headersSent) sendError(res, 'Server error', 500)
    }
  }

const PAGE = 20
const FRESH_DAYS = 30
const SKILL_RE = /^[a-z0-9][a-z0-9 +#./-]{0,29}$/
const PROJECT_FIELDS = 'id, title, description, skills, budget_type, budget_min, budget_max, currency, duration, status, last_activity_at, created_at, updated_at'
const PUBLIC_STATUSES = new Set(['open', 'in_progress', 'completed'])

const me = (req: Request) => req.user!.userId
const freshSince = () => new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString()

/** "Ayesha Khan" → "Ayesha K." (clients are shown publicly this way). */
export function shortName(full: string | null | undefined): string {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Member'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

/** Maps fl_* function exceptions to HTTP responses. */
const RPC_ERRORS: Record<string, [number, string]> = {
  NOT_FOUND: [404, 'Not found'],
  PROJECT_NOT_OPEN: [409, 'This project is no longer open.'],
  SELF_HIRE: [400, 'You can’t hire yourself.'],
  PROPOSAL_NOT_AVAILABLE: [409, 'This proposal can no longer be accepted.'],
  BAD_MILESTONES: [400, 'Add between 1 and 20 milestones.'],
  MILESTONE_TOTAL: [400, 'Milestones must add up exactly to the agreed amount.'],
  CONTRACT_NOT_ACTIVE: [409, 'This contract is no longer active.'],
  NOT_SUBMITTED: [409, 'This milestone hasn’t been handed in yet.'],
  WORK_DELIVERED: [409, 'Work has already been handed in, so this contract can’t be cancelled here. Contact support.'],
}
export function rpcFail(res: Response, error: { message?: string } | null): void {
  const key = Object.keys(RPC_ERRORS).find((k) => error?.message?.includes(k))
  if (key) {
    const [status, msg] = RPC_ERRORS[key]
    return sendError(res, msg, status, key)
  }
  console.error('freelance rpc', error?.message)
  sendError(res, 'Server error', 500)
}

/** Rating, review count, completed contracts and profile basics per freelancer. */
async function freelancerSummaries(ids: string[]) {
  const out: Record<string, { name: string; headline: string; skills: string[]; rating: number | null; reviews: number; completed: number; trust_level: number }> = {}
  if (!ids.length) return out
  const [users, profiles, reviews, done] = await Promise.all([
    supabaseAdmin.from('users').select('id, full_name, trust_level').in('id', ids),
    supabaseAdmin.from('freelancer_profiles').select('user_id, headline, skills').in('user_id', ids),
    supabaseAdmin.from('freelance_reviews').select('reviewee_id, rating').in('reviewee_id', ids).limit(5000),
    supabaseAdmin.from('contracts').select('freelancer_id').eq('status', 'completed').in('freelancer_id', ids).limit(5000),
  ])
  for (const id of ids) out[id] = { name: 'Freelancer', headline: '', skills: [], rating: null, reviews: 0, completed: 0, trust_level: 0 }
  for (const u of users.data || []) Object.assign(out[u.id], { name: u.full_name || 'Freelancer', trust_level: u.trust_level ?? 0 })
  for (const p of profiles.data || []) Object.assign(out[p.user_id], { headline: p.headline, skills: p.skills })
  const sums: Record<string, number> = {}
  for (const r of reviews.data || []) {
    sums[r.reviewee_id] = (sums[r.reviewee_id] || 0) + r.rating
    out[r.reviewee_id].reviews++
  }
  for (const id of ids) if (out[id].reviews) out[id].rating = Math.round((sums[id] / out[id].reviews) * 10) / 10
  for (const c of done.data || []) out[c.freelancer_id].completed++
  return out
}

const proposalsCount = (row: { proposals?: { count: number }[] }) => row.proposals?.[0]?.count ?? 0

// ─── Public ──────────────────────────────────────────────────

export const listProjects = h('listProjects', async (req, res) => {
  const page = pageParam(req.query.page)
  const q = safeSearchTerm(req.query.q)
  const skill = String(req.query.skill ?? '').trim().toLowerCase()
  const type = String(req.query.budget_type ?? '')

  let query = supabaseAdmin
    .from('projects')
    .select(`${PROJECT_FIELDS}, client_trust, proposals(count)`, { count: 'exact' })
    .eq('status', 'open')
    .gte('last_activity_at', freshSince())
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)
  if (SKILL_RE.test(skill)) query = query.contains('skills', [skill])
  if (type === 'fixed' || type === 'hourly') query = query.eq('budget_type', type)

  // Trust first, then recency. Nobody can pay to move up.
  const { data, count, error } = await query.order('client_trust', { ascending: false }).order('last_activity_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  if (error) throw error
  sendPaginated(
    res,
    (data || []).map(({ proposals, description, ...p }) => ({ ...p, description: description.slice(0, 280), proposals_count: proposalsCount({ proposals }) })),
    count || 0,
    page,
    PAGE,
  )
})

export const getProject = h('getProject', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Project not found', 404)
  const { data: p } = await supabaseAdmin.from('projects').select(`${PROJECT_FIELDS}, client_id, proposals(count)`).eq('id', id).maybeSingle()
  const viewer = req.user?.userId
  const isOwner = Boolean(viewer && p && p.client_id === viewer)
  if (!p || (!PUBLIC_STATUSES.has(p.status) && !isOwner && req.user?.role !== 'admin')) return sendError(res, 'Project not found', 404)

  const [client, posted, hires, mine] = await Promise.all([
    supabaseAdmin.from('users').select('full_name, created_at, trust_level').eq('id', p.client_id).maybeSingle(),
    supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('client_id', p.client_id).neq('status', 'draft'),
    supabaseAdmin.from('contracts').select('id', { count: 'exact', head: true }).eq('client_id', p.client_id),
    viewer && !isOwner
      ? supabaseAdmin.from('proposals').select('id, status, amount, duration_days, created_at').eq('project_id', id).eq('freelancer_id', viewer).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const { client_id: _c, proposals, ...rest } = p
  sendSuccess(res, {
    ...rest,
    proposals_count: proposalsCount({ proposals }),
    fresh: p.status === 'open' && p.last_activity_at >= freshSince(),
    client: { name: shortName(client.data?.full_name), member_since: client.data?.created_at || null, projects_posted: posted.count || 0, hires: hires.count || 0, trust_level: client.data?.trust_level ?? 0 },
    viewer: { is_owner: isOwner, my_proposal: mine.data || null },
  })
})

export const getFreelancer = h('getFreelancer', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Profile not found', 404)
  const [{ data: profile }, { data: user }, { data: reviews }] = await Promise.all([
    supabaseAdmin.from('freelancer_profiles').select('headline, bio, skills, hourly_rate, currency, location, portfolio_url, available, updated_at').eq('user_id', id).maybeSingle(),
    supabaseAdmin.from('users').select('full_name, avatar_url, created_at, trust_level').eq('id', id).maybeSingle(),
    supabaseAdmin.from('freelance_reviews').select('id, reviewer_id, rating, comment, created_at').eq('reviewee_id', id).order('created_at', { ascending: false }).limit(50),
  ])
  if (!profile || !user) return sendError(res, 'Profile not found', 404)
  const [summary, { data: work }, { data: done }] = await Promise.all([
    freelancerSummaries([id]).then((x) => x[id]),
    supabaseAdmin.from('verified_work').select('id, title, amount, currency, completed_on, verified_at').eq('freelancer_id', id).eq('status', 'verified').order('verified_at', { ascending: false }).limit(50),
    supabaseAdmin.from('contracts').select('id, title, completed_at').eq('freelancer_id', id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(50),
  ])
  const reviewerIds = [...new Set((reviews || []).map((r) => r.reviewer_id))]
  const names: Record<string, string> = {}
  if (reviewerIds.length) {
    const { data } = await supabaseAdmin.from('users').select('id, full_name').in('id', reviewerIds)
    for (const u of data || []) names[u.id] = shortName(u.full_name)
  }
  sendSuccess(res, {
    id,
    name: user.full_name,
    avatar_url: user.avatar_url,
    member_since: user.created_at,
    ...profile,
    rating: summary.rating,
    completed: summary.completed,
    trust_level: user.trust_level ?? 0,
    badges: ((await supabaseAdmin.from('badges_earned').select('badge_key, earned_at').eq('subject_type', 'user').eq('subject_id', id)).data || []),
    verified_work: [
      ...(done || []).map((c) => ({ id: c.id, title: c.title, source: 'safeapply' as const, at: c.completed_at })),
      ...(work || []).map((w) => ({ id: w.id, title: w.title, source: 'client_confirmed' as const, at: w.verified_at })),
    ],
    reviews: (reviews || []).map(({ reviewer_id, ...r }) => ({ ...r, reviewer: names[reviewer_id] || 'Client' })),
  })
})

// ─── Freelancer ──────────────────────────────────────────────

export const getMyProfile = h('getMyProfile', async (req, res) => {
  const { data } = await supabaseAdmin.from('freelancer_profiles').select('*').eq('user_id', me(req)).maybeSingle()
  sendSuccess(res, data)
})

export const saveMyProfile = h('saveMyProfile', async (req, res) => {
  const b = req.body
  const row = {
    user_id: me(req),
    headline: stripHtml(b.headline),
    bio: stripHtml(b.bio),
    skills: b.skills,
    hourly_rate: b.hourly_rate,
    currency: b.currency,
    location: stripHtml(b.location) || null,
    portfolio_url: b.portfolio_url || null,
    available: b.available,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin.from('freelancer_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single()
  if (error) throw error
  sendSuccess(res, data, 200, 'Profile saved')
})

export const submitProposal = h('submitProposal', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Project not found', 404)
  const uid = me(req)
  const [{ data: profile }, { data: p }] = await Promise.all([
    supabaseAdmin.from('freelancer_profiles').select('user_id').eq('user_id', uid).maybeSingle(),
    supabaseAdmin.from('projects').select('id, client_id, title, status, last_activity_at').eq('id', id).maybeSingle(),
  ])
  if (!profile) return sendError(res, 'Set up your freelancer profile before sending proposals.', 409, 'NO_PROFILE')
  if (!p || p.status !== 'open' || p.last_activity_at < freshSince()) return sendError(res, 'This project isn’t accepting proposals.', 409)
  if (p.client_id === uid) return sendError(res, 'You can’t send a proposal to your own project.', 400)

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .insert({ project_id: id, freelancer_id: uid, cover_letter: stripHtml(req.body.cover_letter), amount: req.body.amount, duration_days: req.body.duration_days })
    .select('id, status, amount, duration_days, created_at')
    .single()
  if (error) {
    if (error.code === '23505') return sendError(res, 'You’ve already sent a proposal for this project.', 409)
    throw error
  }
  await notify([{ user_id: p.client_id, type: 'proposal', title: `New proposal for “${p.title}”`, link: `/client/projects/${id}` }])
  sendSuccess(res, data, 201, 'Proposal sent')
})

export const listMyProposals = h('listMyProposals', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('proposals')
    .select('id, status, amount, duration_days, created_at, updated_at, project:projects(id, title, status, currency, budget_type)')
    .eq('freelancer_id', me(req))
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  sendSuccess(res, data || [])
})

export const withdrawProposal = h('withdrawProposal', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Proposal not found', 404)
  const { data } = await supabaseAdmin
    .from('proposals')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('freelancer_id', me(req))
    .in('status', ['pending', 'shortlisted'])
    .select('id')
    .maybeSingle()
  if (!data) return sendError(res, 'This proposal can’t be withdrawn.', 409)
  sendSuccess(res, { id, status: 'withdrawn' }, 200, 'Proposal withdrawn')
})

export const freelancerStats = h('freelancerStats', async (req, res) => {
  const uid = me(req)
  const [props, contracts, earned, profile] = await Promise.all([
    supabaseAdmin.from('proposals').select('status').eq('freelancer_id', uid).limit(5000),
    supabaseAdmin.from('contracts').select('id, status').eq('freelancer_id', uid).limit(5000),
    supabaseAdmin.from('milestones').select('amount, contracts!inner(freelancer_id, currency)').eq('status', 'approved').eq('contracts.freelancer_id', uid).limit(5000),
    supabaseAdmin.from('freelancer_profiles').select('user_id').eq('user_id', uid).maybeSingle(),
  ])
  const count = (rows: { status: string }[] | null, s: string) => (rows || []).filter((r) => r.status === s).length
  const byCurrency: Record<string, number> = {}
  for (const m of (earned.data || []) as unknown as { amount: number; contracts: { currency: string } }[]) {
    byCurrency[m.contracts.currency] = (byCurrency[m.contracts.currency] || 0) + m.amount
  }
  sendSuccess(res, {
    has_profile: Boolean(profile.data),
    proposals_open: count(props.data, 'pending') + count(props.data, 'shortlisted'),
    shortlisted: count(props.data, 'shortlisted'),
    active: count(contracts.data, 'active'),
    completed: count(contracts.data, 'completed'),
    approved_by_currency: byCurrency,
  })
})

// ─── Client ──────────────────────────────────────────────────

export const listClientProjects = h('listClientProjects', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select(`${PROJECT_FIELDS}, proposals(count)`)
    .eq('client_id', me(req))
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  sendSuccess(res, (data || []).map(({ proposals, ...p }) => ({ ...p, proposals_count: proposalsCount({ proposals }) })))
})

export const createProject = h('createProject', async (req, res) => {
  const uid = me(req)
  const b = req.body
  if (b.status === 'open') {
    const { count } = await supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('client_id', uid).eq('status', 'open')
    const cap = (await loadUserPro(uid)) ? PRO_CEILING.open_projects : FREE_CAPS.open_projects
    if ((count || 0) >= cap) return sendError(res, cap === FREE_CAPS.open_projects ? `The free plan includes ${cap} open projects. Upgrade to Client Pro for more, or close one first.` : `You can have up to ${cap} open projects.`, 403, cap === FREE_CAPS.open_projects ? 'FREE_LIMIT_REACHED' : undefined)
  }
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      client_id: uid,
      title: stripHtml(b.title),
      description: stripHtml(b.description),
      skills: b.skills,
      budget_type: b.budget_type,
      budget_min: b.budget_min,
      budget_max: b.budget_max,
      currency: b.currency,
      duration: b.duration,
      status: b.status,
    })
    .select(PROJECT_FIELDS)
    .single()
  if (error) throw error
  sendSuccess(res, data, 201, b.status === 'draft' ? 'Draft saved' : 'Project posted')
})

export const getClientProject = h('getClientProject', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Project not found', 404)
  const { data: p } = await supabaseAdmin.from('projects').select(PROJECT_FIELDS).eq('id', id).eq('client_id', me(req)).maybeSingle()
  if (!p) return sendError(res, 'Project not found', 404)
  const [{ data: props }, { data: contract }] = await Promise.all([
    supabaseAdmin.from('proposals').select('id, freelancer_id, cover_letter, amount, duration_days, status, created_at').eq('project_id', id).order('created_at', { ascending: true }).limit(500),
    supabaseAdmin.from('contracts').select('id, status').eq('project_id', id).maybeSingle(),
  ])
  const ids: string[] = Array.from(new Set((props || []).map((x: { freelancer_id: string }) => x.freelancer_id)))
  const summaries = await freelancerSummaries(ids)
  sendSuccess(res, {
    ...p,
    contract: contract || null,
    proposals: (props || []).map((x) => ({ ...x, freelancer: summaries[x.freelancer_id] })),
  })
})

const EDITABLE = new Set(['draft', 'open'])
const TRANSITIONS: Record<string, string[]> = { draft: ['draft', 'open'], open: ['open', 'closed'], closed: ['closed', 'open'] }

export const updateProject = h('updateProject', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Project not found', 404)
  const uid = me(req)
  const { data: cur } = await supabaseAdmin.from('projects').select('status, budget_min, budget_max, moderated').eq('id', id).eq('client_id', uid).maybeSingle()
  if (!cur) return sendError(res, 'Project not found', 404)
  const b = req.body
  const status: string = b.status ?? cur.status
  if (!TRANSITIONS[cur.status]?.includes(status)) return sendError(res, 'This project can’t be changed any more.', 409)
  if (cur.moderated && status !== cur.status) return sendError(res, 'This project was closed by moderation. Contact support.', 403)
  const fieldsChanged = Object.keys(b).some((k) => k !== 'status')
  if (fieldsChanged && !EDITABLE.has(cur.status)) return sendError(res, 'Reopen the project before editing it.', 409)
  const min = b.budget_min ?? cur.budget_min
  const max = b.budget_max ?? cur.budget_max
  if (max < min) return sendError(res, 'Maximum budget must be at least the minimum.', 400)
  if (status === 'open' && cur.status !== 'open') {
    const { count } = await supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }).eq('client_id', uid).eq('status', 'open')
    const cap = (await loadUserPro(uid)) ? PRO_CEILING.open_projects : FREE_CAPS.open_projects
    if ((count || 0) >= cap) return sendError(res, cap === FREE_CAPS.open_projects ? `The free plan includes ${cap} open projects. Upgrade to Client Pro for more, or close one first.` : `You can have up to ${cap} open projects.`, 403, cap === FREE_CAPS.open_projects ? 'FREE_LIMIT_REACHED' : undefined)
  }
  const patch: Record<string, unknown> = { ...b, status, updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }
  for (const k of ['title', 'description'] as const) if (typeof b[k] === 'string') patch[k] = stripHtml(b[k])
  const { data, error } = await supabaseAdmin.from('projects').update(patch).eq('id', id).eq('client_id', uid).eq('status', cur.status).select(PROJECT_FIELDS).maybeSingle()
  if (error) throw error
  if (!data) return sendError(res, 'The project changed while you were editing. Reload and try again.', 409)
  sendSuccess(res, data, 200, 'Project saved')
})

/** Loads a proposal only if it belongs to a project the caller owns. */
async function ownedProposal(proposalId: string, clientId: string) {
  const { data } = await supabaseAdmin
    .from('proposals')
    .select('id, status, freelancer_id, projects!inner(id, title, status, client_id)')
    .eq('id', proposalId)
    .eq('projects.client_id', clientId)
    .maybeSingle()
  if (!data) return null
  const { projects, ...rest } = data as unknown as { id: string; status: string; freelancer_id: string; projects: { id: string; title: string; status: string } }
  return { ...rest, project: projects }
}

export const setProposalStatus = h('setProposalStatus', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Proposal not found', 404)
  const prop = await ownedProposal(id, me(req))
  if (!prop) return sendError(res, 'Proposal not found', 404)
  if (prop.project.status !== 'open' || !['pending', 'shortlisted'].includes(prop.status)) return sendError(res, 'This proposal can’t be changed.', 409)
  const status = req.body.status as 'shortlisted' | 'declined'
  const { data } = await supabaseAdmin
    .from('proposals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['pending', 'shortlisted'])
    .select('id, status')
    .maybeSingle()
  if (!data) return sendError(res, 'This proposal can’t be changed.', 409)
  await Promise.all([
    supabaseAdmin.from('projects').update({ last_activity_at: new Date().toISOString() }).eq('id', prop.project.id),
    notify([
      {
        user_id: prop.freelancer_id,
        type: 'proposal',
        title: status === 'shortlisted' ? `You’re shortlisted for “${prop.project.title}”` : `Your proposal for “${prop.project.title}” wasn’t selected`,
        link: '/freelancer/proposals',
      },
    ]),
  ])
  sendSuccess(res, data)
})

const todayUtc = () => new Date().toISOString().slice(0, 10)

export const hireProposal = h('hireProposal', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Proposal not found', 404)
  const milestones = (req.body.milestones as { title: string; amount: number; due_date: string | null }[]).map((m) => ({
    title: stripHtml(m.title),
    amount: m.amount,
    due_date: m.due_date || null,
  }))
  if (milestones.some((m) => m.title.length < 3)) return sendError(res, 'Each milestone needs a title.', 400)
  if (milestones.some((m) => m.due_date && (m.due_date < todayUtc() || Number.isNaN(Date.parse(m.due_date))))) return sendError(res, 'Due dates must be valid and not in the past.', 400)

  const { data: contractId, error } = await supabaseAdmin.rpc('fl_hire', { p_proposal: id, p_client: me(req), p_milestones: milestones })
  if (error) return rpcFail(res, error)

  const { data: c } = await supabaseAdmin.from('contracts').select('id, project_id, freelancer_id, title').eq('id', contractId).single()
  const { data: declined } = await supabaseAdmin.from('proposals').select('freelancer_id').eq('project_id', c.project_id).eq('status', 'declined').limit(500)
  await notify([
    { user_id: c.freelancer_id, type: 'contract', title: `You’re hired for “${c.title}”`, body: 'Your contract and milestones are ready.', link: `/freelancer/contracts/${c.id}` },
    ...(declined || []).map((d) => ({ user_id: d.freelancer_id, type: 'proposal', title: `“${c.title}” was filled`, link: '/freelancer/proposals' })),
  ])
  sendSuccess(res, { contract_id: c.id }, 201, 'Freelancer hired')
})

export const clientStats = h('clientStats', async (req, res) => {
  const uid = me(req)
  const [projects, contracts] = await Promise.all([
    supabaseAdmin.from('projects').select('id, status, proposals(status)').eq('client_id', uid).limit(1000),
    supabaseAdmin.from('contracts').select('status').eq('client_id', uid).limit(5000),
  ])
  const rows = (projects.data || []) as unknown as { status: string; proposals: { status: string }[] }[]
  sendSuccess(res, {
    open: rows.filter((p) => p.status === 'open').length,
    drafts: rows.filter((p) => p.status === 'draft').length,
    new_proposals: rows.filter((p) => p.status === 'open').reduce((n, p) => n + p.proposals.filter((x) => x.status === 'pending').length, 0),
    active: (contracts.data || []).filter((c) => c.status === 'active').length,
    completed: (contracts.data || []).filter((c) => c.status === 'completed').length,
  })
})

// ─── Admin ───────────────────────────────────────────────────

export const adminListProjects = h('adminListProjects', async (req, res) => {
  const page = pageParam(req.query.page)
  const status = String(req.query.status ?? '')
  let query = supabaseAdmin.from('projects').select(`${PROJECT_FIELDS}, client_id`, { count: 'exact' })
  if (['draft', 'open', 'in_progress', 'completed', 'cancelled', 'closed'].includes(status)) query = query.eq('status', status)
  const { data, count, error } = await query.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
  if (error) throw error
  const ids = [...new Set((data || []).map((p) => p.client_id as string))]
  const emails: Record<string, { name: string; email: string }> = {}
  if (ids.length) {
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email').in('id', ids)
    for (const u of users || []) emails[u.id] = { name: u.full_name, email: u.email }
  }
  sendPaginated(res, (data || []).map(({ client_id, ...p }) => ({ ...p, client: emails[client_id] || null })), count || 0, page, PAGE)
})

export const adminSetProject = h('adminSetProject', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Project not found', 404)
  const status = req.body.status as 'open' | 'closed'
  const from = status === 'closed' ? ['open', 'draft'] : ['closed']
  const { data } = await supabaseAdmin
    .from('projects')
    .update({ status, moderated: status === 'closed', updated_at: new Date().toISOString(), ...(status === 'open' && { last_activity_at: new Date().toISOString() }) })
    .eq('id', id)
    .in('status', from)
    .select('id, status, client_id, title')
    .maybeSingle()
  if (!data) return sendError(res, 'This project can’t be changed.', 409)
  if (status === 'closed') await notify([{ user_id: data.client_id, type: 'project', title: `“${data.title}” was closed by moderation`, link: `/client/projects/${id}` }])
  sendSuccess(res, { id, status })
})
