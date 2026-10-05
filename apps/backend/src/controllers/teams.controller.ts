// ============================================================
// FILE: apps/backend/src/controllers/teams.controller.ts
// PURPOSE: Recruiter plan features: company teams, shared candidate notes,
//          talent search over opted-in seekers, saved folders, invite to
//          apply, hiring analytics, and the embeddable website badge.
// SECURITY:
//   • company_id always comes from the caller's membership row.
//   • Team invites: verified company, owner only, invitee email must be on
//     the company domain, 32 random bytes stored only as SHA-256, single
//     use, 7-day expiry, answerable only by the invited email.
//   • Talent: only seekers who opted in, never shown to companies they hid
//     from. Recruiters see an opaque public_id, never the account id, email
//     or phone. Contact happens only through invite-to-apply.
// ============================================================

import { createHash, randomBytes } from 'crypto'
import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendPaginated, sendSuccess } from '../utils/response'
import { pageParam, safeSearchTerm, stripHtml, uuidParam } from '../utils/sanitize'
import { FREE_CAPS, PRO_CEILING, isActive } from '../utils/plans'
import { type Membership, STAGES, companyMemberIds, companyResponseRate, domainMatches, emailDomain, fetchAll, getMembership, notify } from '../utils/recruiter'
import { emailHtml, sendEmail } from '../services/email.service'
import { h } from './freelance.controller'

const INVITE_DAYS = 7
const PAGE = 20
const MAX_FOLDERS = 50
const DAY = 86_400_000
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const SKILL_RE = /^[a-z0-9][a-z0-9 +#./-]{0,29}$/
const isPro = (m: Membership) => isActive(m.company.pro_until)
const monthStart = () => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

async function member(req: Request, res: Response): Promise<Membership | null> {
  const m = await getMembership(req.user!.userId)
  if (!m) sendError(res, 'Set up your company first.', 409, 'NO_COMPANY')
  return m
}

async function verifiedMember(req: Request, res: Response): Promise<Membership | null> {
  const m = await member(req, res)
  if (!m) return null
  if (m.company.verification_status !== 'verified') {
    sendError(res, 'Your company must be verified before you can do this.', 403, 'NOT_VERIFIED')
    return null
  }
  if (m.company.suspended) {
    sendError(res, 'Your company is suspended. Contact support.', 403, 'SUSPENDED')
    return null
  }
  return m
}

async function ownerOnly(req: Request, res: Response): Promise<Membership | null> {
  const m = await verifiedMember(req, res)
  if (m && m.member_role !== 'owner') {
    sendError(res, 'Only the company owner can manage the team.', 403)
    return null
  }
  return m
}

// ═══ TEAM ════════════════════════════════════════════════════

export const getTeam = h('team.get', async (req, res) => {
  const m = await member(req, res)
  if (!m) return
  const owner = m.member_role === 'owner'
  const [{ data: rows }, { data: invites }] = await Promise.all([
    supabaseAdmin.from('company_members').select('id, user_id, member_role, created_at, user:users(full_name, email)').eq('company_id', m.company_id).order('created_at').limit(50),
    owner
      ? supabaseAdmin.from('team_invites').select('id, email, status, expires_at, created_at').eq('company_id', m.company_id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as { id: string; email: string; status: string; expires_at: string; created_at: string }[] }),
  ])
  const members = (rows || []).map((r) => {
    const u = Array.isArray(r.user) ? r.user[0] : r.user
    return { id: r.id, member_role: r.member_role, created_at: r.created_at, full_name: u?.full_name || 'Member', email: u?.email || '', is_me: r.user_id === req.user!.userId }
  })
  const cap = isPro(m) ? PRO_CEILING.team_seats : FREE_CAPS.team_seats
  sendSuccess(res, {
    members,
    invites: invites || [],
    seats: { used: members.length + (invites || []).length, cap },
    me: { member_role: m.member_role },
    company: { name: m.company.name, slug: m.company.slug, verified: m.company.verification_status === 'verified', pro: isPro(m) },
  })
})

export const inviteMember = h('team.invite', async (req, res) => {
  const m = await ownerOnly(req, res)
  if (!m) return
  const email = String(req.body.email).trim().toLowerCase()
  const { data: company } = await supabaseAdmin.from('companies').select('domain').eq('id', m.company_id).single()
  if (!company?.domain || !domainMatches(emailDomain(email), company.domain)) {
    return sendError(res, `Invite a work email on ${company?.domain || 'your company domain'}.`, 400, 'DOMAIN_MISMATCH')
  }
  const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) {
    const { count } = await supabaseAdmin.from('company_members').select('id', { count: 'exact', head: true }).eq('user_id', existing.id)
    if (count) return sendError(res, 'This person already belongs to a company on SafeApply.', 409)
  }
  const token = randomBytes(32).toString('base64url')
  const { data: invId, error } = await supabaseAdmin.rpc('team_invite_add', {
    p_company: m.company_id,
    p_email: email,
    p_hash: sha(token),
    p_by: req.user!.userId,
    p_expires: new Date(Date.now() + INVITE_DAYS * DAY).toISOString(),
    p_free: FREE_CAPS.team_seats,
    p_pro: PRO_CEILING.team_seats,
  })
  if (error) {
    if (error.message.includes('DUPLICATE')) return sendError(res, 'There’s already a pending invite for this email.', 409)
    if (error.message.includes('SEAT_LIMIT')) {
      const cap = isPro(m) ? PRO_CEILING.team_seats : FREE_CAPS.team_seats
      return sendError(res, isPro(m) ? `Your plan includes up to ${cap} seats.` : `The free plan includes ${cap} seats. Upgrade to the recruiter plan for a bigger team.`, 403, isPro(m) ? 'SEAT_LIMIT' : 'FREE_LIMIT_REACHED')
    }
    throw error
  }
  const path = `/team/join/${token}`
  const emailed = await sendEmail(
    email,
    `Join ${m.company.name} on SafeApply`,
    emailHtml(`Join ${m.company.name} on SafeApply`, [`You were invited to review applicants with the ${m.company.name} hiring team.`, `Sign in or create a recruiter account with this email address. The link works for ${INVITE_DAYS} days.`], { label: 'Join the team', path }),
  )
  sendSuccess(res, { id: invId as string, link: path, emailed }, 201, 'Invite created')
})

export const revokeInvite = h('team.revoke', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Invite not found', 404)
  const m = await ownerOnly(req, res)
  if (!m) return
  const { data } = await supabaseAdmin.from('team_invites').update({ status: 'revoked' }).eq('id', id).eq('company_id', m.company_id).eq('status', 'pending').select('id').maybeSingle()
  if (!data) return sendError(res, 'Invite not found', 404)
  sendSuccess(res, null, 200, 'Invite revoked')
})

export const removeMember = h('team.remove', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Member not found', 404)
  const m = await ownerOnly(req, res)
  if (!m) return
  const { data } = await supabaseAdmin.from('company_members').delete().eq('id', id).eq('company_id', m.company_id).eq('member_role', 'recruiter').select('user_id').maybeSingle()
  if (!data) return sendError(res, 'Member not found', 404)
  void notify([{ user_id: data.user_id, type: 'team', title: `You were removed from ${m.company.name}`, link: '/recruiter' }])
  sendSuccess(res, null, 200, 'Member removed')
})

export const leaveTeam = h('team.leave', async (req, res) => {
  const m = await member(req, res)
  if (!m) return
  if (m.member_role === 'owner') return sendError(res, 'Owners can’t leave their company. Contact support to transfer ownership.', 400)
  await supabaseAdmin.from('company_members').delete().eq('user_id', req.user!.userId).eq('company_id', m.company_id)
  sendSuccess(res, null, 200, 'You left the team')
})

async function loadInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  const { data } = await supabaseAdmin
    .from('team_invites')
    .select('id, email, status, expires_at, company_id, company:companies(name, slug)')
    .eq('token_hash', sha(token))
    .maybeSingle()
  if (!data) return null
  const company = Array.isArray(data.company) ? data.company[0] : data.company
  return { ...data, company }
}

export const previewInvite = h('team.preview', async (req, res) => {
  const inv = await loadInvite(String(req.params.token || ''))
  if (!inv) return sendError(res, 'This invite link isn’t valid.', 404)
  const expired = new Date(inv.expires_at).getTime() < Date.now()
  sendSuccess(res, {
    company: inv.company?.name || 'A company',
    status: inv.status === 'pending' && expired ? 'expired' : inv.status,
    email_matches: inv.email === req.user!.email.toLowerCase(),
    is_recruiter: req.user!.role === 'recruiter',
  })
})

export const joinTeam = h('team.join', async (req, res) => {
  const uid = req.user!.userId
  if (req.user!.role !== 'recruiter') return sendError(res, 'Use a recruiter account to join a hiring team.', 403)
  const inv = await loadInvite(String(req.body.token))
  if (!inv || inv.status !== 'pending' || new Date(inv.expires_at).getTime() < Date.now()) return sendError(res, 'This invite is no longer valid.', 410)
  if (inv.email !== req.user!.email.toLowerCase()) return sendError(res, 'This invite was sent to a different email address.', 403)
  if (await getMembership(uid)) return sendError(res, 'You already belong to a company.', 409)

  // One transaction: lock the invite, re-check seats, add the member, mark used.
  const { error } = await supabaseAdmin.rpc('team_join', { p_hash: sha(String(req.body.token)), p_user: uid, p_email: req.user!.email, p_free: FREE_CAPS.team_seats, p_pro: PRO_CEILING.team_seats })
  if (error) {
    if (error.message.includes('SEAT_LIMIT')) return sendError(res, 'This team has no free seats. Ask the owner to upgrade or remove a member.', 403, 'SEAT_LIMIT')
    if (error.message.includes('EMAIL_MISMATCH')) return sendError(res, 'This invite was sent to a different email address.', 403)
    if (error.message.includes('INVALID')) return sendError(res, 'This invite is no longer valid.', 410)
    if (error.code === '23505') return sendError(res, 'You already belong to a company.', 409)
    throw error
  }
  const { data: me } = await supabaseAdmin.from('users').select('full_name').eq('id', uid).single()
  const ids = (await companyMemberIds(inv.company_id)).filter((x) => x !== uid)
  void notify(ids.map((user_id) => ({ user_id, type: 'team', title: `${me?.full_name || 'A teammate'} joined your hiring team`, link: '/recruiter/team' })))
  sendSuccess(res, { company: inv.company?.name }, 200, 'Welcome to the team')
})

// ═══ CANDIDATE NOTES ═════════════════════════════════════════

async function ownedAppId(appId: string, companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('job_applications').select('id, job:jobs!inner(company_id)').eq('id', appId).eq('job.company_id', companyId).maybeSingle()
  return Boolean(data)
}

export const listNotes = h('notes.list', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Applicant not found', 404)
  const m = await member(req, res)
  if (!m) return
  if (!(await ownedAppId(id, m.company_id))) return sendError(res, 'Applicant not found', 404)
  const [{ data: notes }, { data: team }] = await Promise.all([
    supabaseAdmin.from('candidate_notes').select('id, author_id, body, rating, mentions, created_at').eq('application_id', id).eq('company_id', m.company_id).order('created_at').limit(200),
    supabaseAdmin.from('company_members').select('user_id, user:users(full_name)').eq('company_id', m.company_id).limit(50),
  ])
  const people = (team || []).map((t) => {
    const u = Array.isArray(t.user) ? t.user[0] : t.user
    return { id: t.user_id as string, full_name: u?.full_name || 'Member' }
  })
  const nameOf = new Map(people.map((p) => [p.id, p.full_name]))
  const uid = req.user!.userId
  const rows = (notes || []).map((n) => ({
    id: n.id,
    body: n.body,
    rating: n.rating,
    created_at: n.created_at,
    author: n.author_id ? nameOf.get(n.author_id) || 'Former member' : 'Former member',
    mine: n.author_id === uid,
    mentions: (n.mentions as string[]).map((x) => nameOf.get(x)).filter(Boolean),
  }))
  // Average of each author's latest rating, so one person can't stack ratings.
  const latest = new Map<string, number>()
  for (const n of notes || []) if (n.rating && n.author_id) latest.set(n.author_id, n.rating)
  const vals = [...latest.values()]
  sendSuccess(res, {
    notes: rows,
    rating: vals.length ? { avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length } : null,
    team: people.filter((p) => p.id !== uid),
    can_moderate: m.member_role === 'owner',
  })
})

export const addNote = h('notes.add', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Applicant not found', 404)
  const m = await member(req, res)
  if (!m) return
  if (!(await ownedAppId(id, m.company_id))) return sendError(res, 'Applicant not found', 404)
  const uid = req.user!.userId
  const team = new Set(await companyMemberIds(m.company_id))
  const mentions = (req.body.mentions as string[]).filter((x) => x !== uid && team.has(x))
  const body = stripHtml(req.body.body)
  if (!body) return sendError(res, 'Write a note.', 400)
  const { data, error } = await supabaseAdmin
    .from('candidate_notes')
    .insert({ application_id: id, company_id: m.company_id, author_id: uid, body, rating: req.body.rating ?? null, mentions })
    .select('id')
    .single()
  if (error) throw error
  if (mentions.length) {
    const { data: me } = await supabaseAdmin.from('users').select('full_name').eq('id', uid).single()
    void notify(mentions.map((user_id) => ({ user_id, type: 'mention', title: `${me?.full_name || 'A teammate'} mentioned you on an applicant`, body: body.slice(0, 140), link: `/recruiter/applicants/${id}` })))
  }
  sendSuccess(res, { id: data.id }, 201, 'Note added')
})

export const deleteNote = h('notes.delete', async (req, res) => {
  const id = uuidParam(req.params.noteId)
  if (!id) return sendError(res, 'Note not found', 404)
  const m = await member(req, res)
  if (!m) return
  let q = supabaseAdmin.from('candidate_notes').delete().eq('id', id).eq('company_id', m.company_id)
  if (m.member_role !== 'owner') q = q.eq('author_id', req.user!.userId)
  const { data } = await q.select('id').maybeSingle()
  if (!data) return sendError(res, 'Note not found', 404)
  sendSuccess(res, null, 200, 'Note deleted')
})

// ═══ SEEKER: TALENT PROFILE ══════════════════════════════════

const TALENT_EMPTY = { visible: false, open_to_work: false, headline: '', skills: [], location: '', desired_roles: '', work_modes: [], hidden_company_ids: [], updated_at: null }

export const getMyTalent = h('talent.me', async (req, res) => {
  const { data } = await supabaseAdmin
    .from('talent_profiles')
    .select('visible, open_to_work, headline, skills, location, desired_roles, work_modes, hidden_company_ids, updated_at')
    .eq('user_id', req.user!.userId)
    .maybeSingle()
  const p = data || TALENT_EMPTY
  const ids = p.hidden_company_ids as string[]
  const { data: hidden } = ids.length ? await supabaseAdmin.from('companies').select('id, name, slug').in('id', ids) : { data: [] }
  sendSuccess(res, { ...p, hidden_companies: hidden || [] })
})

export const saveMyTalent = h('talent.save', async (req, res) => {
  if (req.user!.role !== 'user') return sendError(res, 'Only job seekers can be listed for recruiters.', 403)
  const b = req.body as { visible: boolean; open_to_work: boolean; headline: string; skills: string[]; location: string; desired_roles: string; work_modes: string[]; hidden_company_ids: string[] }
  const skills = b.skills.map((s) => stripHtml(s)).filter((s) => SKILL_RE.test(s))
  // Keep only real companies so the list can't hold junk ids.
  const { data: real } = b.hidden_company_ids.length ? await supabaseAdmin.from('companies').select('id').in('id', b.hidden_company_ids) : { data: [] }
  const row = {
    user_id: req.user!.userId,
    visible: b.visible,
    open_to_work: b.open_to_work,
    headline: stripHtml(b.headline) || null,
    skills,
    location: stripHtml(b.location) || null,
    desired_roles: stripHtml(b.desired_roles) || null,
    work_modes: b.work_modes,
    hidden_company_ids: (real || []).map((r) => r.id as string),
    updated_at: new Date().toISOString(),
  }
  if (row.visible && !row.headline && skills.length === 0) return sendError(res, 'Add a headline or at least one skill so recruiters know what you do.', 400)
  const { error } = await supabaseAdmin.from('talent_profiles').upsert(row, { onConflict: 'user_id' })
  if (error) throw error
  sendSuccess(res, null, 200, row.visible ? 'You’re visible to verified recruiters' : 'Your profile is hidden')
})

// ═══ RECRUITER: TALENT SEARCH ════════════════════════════════

const TALENT_FIELDS = 'public_id, headline, skills, location, desired_roles, work_modes, open_to_work, updated_at, user:users!inner(full_name, role, trust_level)'

/** Base query: opted-in seekers who haven't hidden themselves from this company. */
const visibleTalent = (companyId: string, fields = TALENT_FIELDS, count = false) =>
  supabaseAdmin
    .from('talent_profiles')
    .select(fields, count ? { count: 'exact' } : undefined)
    .eq('visible', true)
    .eq('user.role', 'user')
    .not('hidden_company_ids', 'cs', `{${companyId}}`)

type TalentRow = {
  public_id: string
  headline: string | null
  skills: string[]
  location: string | null
  desired_roles: string | null
  work_modes: string[]
  open_to_work: boolean
  updated_at: string
  user: { full_name: string | null; trust_level?: number } | { full_name: string | null; trust_level?: number }[] | null
}
const talentOut = (r: TalentRow) => {
  const u = Array.isArray(r.user) ? r.user[0] : r.user
  return {
    id: r.public_id,
    full_name: u?.full_name || 'Candidate',
    headline: r.headline,
    skills: r.skills,
    location: r.location,
    desired_roles: r.desired_roles,
    work_modes: r.work_modes,
    open_to_work: r.open_to_work,
    updated_at: r.updated_at,
  }
}

export const searchTalent = h('talent.search', async (req, res) => {
  const m = await verifiedMember(req, res)
  if (!m) return
  const page = pageParam(req.query.page, 50)
  const q = safeSearchTerm(req.query.q)
  const skill = String(req.query.skill || '').trim().toLowerCase()
  const loc = safeSearchTerm(req.query.location, 60)
  const mode = String(req.query.mode || '')
  let query = visibleTalent(m.company_id, TALENT_FIELDS, true)
  if (q) query = query.or(`headline.ilike.%${q}%,desired_roles.ilike.%${q}%`)
  if (skill && SKILL_RE.test(skill)) query = query.contains('skills', [skill])
  if (loc) query = query.ilike('location', `%${loc}%`)
  if (['onsite', 'hybrid', 'remote'].includes(mode)) query = query.contains('work_modes', [mode])
  if (req.query.open === '1') query = query.eq('open_to_work', true)
  const from = (page - 1) * PAGE
  const { data, count, error } = await query.order('open_to_work', { ascending: false }).order('updated_at', { ascending: false }).range(from, from + PAGE - 1)
  if (error) throw error
  sendPaginated(res, ((data || []) as unknown as TalentRow[]).map(talentOut), count || 0, page, PAGE)
})

async function talentUserId(publicId: string, companyId: string): Promise<{ user_id: string; row: TalentRow } | null> {
  const { data } = await visibleTalent(companyId, `user_id, ${TALENT_FIELDS}`).eq('public_id', publicId).maybeSingle()
  // Dynamic select strings can't be inferred by supabase-js, so the row is typed here.
  const row = data as unknown as (TalentRow & { user_id: string }) | null
  return row ? { user_id: row.user_id, row } : null
}

export const getTalent = h('talent.get', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Profile not found', 404)
  const m = await verifiedMember(req, res)
  if (!m) return
  const t = await talentUserId(id, m.company_id)
  if (!t) return sendError(res, 'This profile isn’t available.', 404)
  const [{ data: folders }, { data: invites }, { data: jobs }, { count: used }] = await Promise.all([
    supabaseAdmin.from('talent_folders').select('id, name, items:talent_folder_items(user_id)').eq('company_id', m.company_id).order('name').limit(MAX_FOLDERS),
    supabaseAdmin.from('talent_invites').select('job_id, created_at').eq('company_id', m.company_id).eq('user_id', t.user_id).limit(100),
    supabaseAdmin.from('jobs').select('id, title').eq('company_id', m.company_id).eq('status', 'open').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('talent_invites').select('id', { count: 'exact', head: true }).eq('company_id', m.company_id).gte('created_at', monthStart()),
  ])
  const u = Array.isArray(t.row.user) ? t.row.user[0] : t.row.user
  sendSuccess(res, {
    ...talentOut(t.row),
    trust_level: u?.trust_level ?? 0,
    folders: (folders || []).map((f) => ({ id: f.id, name: f.name, saved: ((f.items || []) as { user_id: string }[]).some((i) => i.user_id === t.user_id) })),
    invited_job_ids: (invites || []).map((i) => i.job_id),
    open_jobs: jobs || [],
    invites_left: Math.max(0, (isPro(m) ? PRO_CEILING.talent_invites : FREE_CAPS.talent_invites) - (used || 0)),
  })
})

export const inviteTalent = h('talent.invite', async (req, res) => {
  const id = uuidParam(req.params.id)
  if (!id) return sendError(res, 'Profile not found', 404)
  const m = await verifiedMember(req, res)
  if (!m) return
  const t = await talentUserId(id, m.company_id)
  if (!t) return sendError(res, 'This profile isn’t available.', 404)
  const jobId = req.body.job_id as string
  const { data: job } = await supabaseAdmin.from('jobs').select('id, title').eq('id', jobId).eq('company_id', m.company_id).eq('status', 'open').maybeSingle()
  if (!job) return sendError(res, 'Pick one of your open jobs.', 400)
  const cap = isPro(m) ? PRO_CEILING.talent_invites : FREE_CAPS.talent_invites
  const { count: applied } = await supabaseAdmin.from('job_applications').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('user_id', t.user_id)
  if (applied) return sendError(res, 'This person already applied to that job.', 409)
  const { error } = await supabaseAdmin.rpc('talent_invite_add', { p_company: m.company_id, p_user: t.user_id, p_job: jobId, p_by: req.user!.userId, p_cap: cap })
  if (error) {
    if (error.message.includes('CAP')) {
      return sendError(res, isPro(m) ? `You’ve sent ${cap} invites this month.` : `The free plan includes ${cap} invites a month. Upgrade to the recruiter plan for more.`, 403, isPro(m) ? 'MONTHLY_LIMIT' : 'FREE_LIMIT_REACHED')
    }
    if (error.code === '23505') return sendError(res, 'You already invited this person to that job.', 409)
    throw error
  }
  void notify([{ user_id: t.user_id, type: 'talent_invite', title: `${m.company.name} invited you to apply`, body: `For ${job.title}. Applying is up to you.`, link: `/jobs/${jobId}` }])
  sendSuccess(res, null, 201, 'Invite sent')
})

// ── Folders ──────────────────────────────────────────────────

export const listFolders = h('folders.list', async (req, res) => {
  const m = await verifiedMember(req, res)
  if (!m) return
  const { data } = await supabaseAdmin.from('talent_folders').select('id, name, created_at, items:talent_folder_items(count)').eq('company_id', m.company_id).order('name').limit(MAX_FOLDERS)
  sendSuccess(res, (data || []).map((f) => ({ id: f.id, name: f.name, created_at: f.created_at, count: (f.items as unknown as { count: number }[])?.[0]?.count ?? 0 })))
})

export const createFolder = h('folders.create', async (req, res) => {
  const m = await verifiedMember(req, res)
  if (!m) return
  const { count } = await supabaseAdmin.from('talent_folders').select('id', { count: 'exact', head: true }).eq('company_id', m.company_id)
  if ((count || 0) >= MAX_FOLDERS) return sendError(res, `You can have up to ${MAX_FOLDERS} folders.`, 403)
  const { data, error } = await supabaseAdmin.from('talent_folders').insert({ company_id: m.company_id, name: stripHtml(req.body.name) }).select('id, name').single()
  if (error) {
    if (error.code === '23505') return sendError(res, 'You already have a folder with that name.', 409)
    throw error
  }
  sendSuccess(res, data, 201, 'Folder created')
})

export const deleteFolder = h('folders.delete', async (req, res) => {
  const id = uuidParam(req.params.folderId)
  if (!id) return sendError(res, 'Folder not found', 404)
  const m = await verifiedMember(req, res)
  if (!m) return
  const { data } = await supabaseAdmin.from('talent_folders').delete().eq('id', id).eq('company_id', m.company_id).select('id').maybeSingle()
  if (!data) return sendError(res, 'Folder not found', 404)
  sendSuccess(res, null, 200, 'Folder deleted')
})

async function ownedFolder(folderId: string | null, companyId: string): Promise<{ id: string; name: string } | null> {
  if (!folderId) return null
  const { data } = await supabaseAdmin.from('talent_folders').select('id, name').eq('id', folderId).eq('company_id', companyId).maybeSingle()
  return data
}

export const getFolder = h('folders.get', async (req, res) => {
  const m = await verifiedMember(req, res)
  if (!m) return
  const folder = await ownedFolder(uuidParam(req.params.folderId), m.company_id)
  if (!folder) return sendError(res, 'Folder not found', 404)
  const { data: items } = await supabaseAdmin.from('talent_folder_items').select('user_id, note, created_at').eq('folder_id', folder.id).order('created_at', { ascending: false }).limit(500)
  const ids = (items || []).map((i) => i.user_id as string)
  // Re-apply visibility: a seeker who hid their profile disappears from saved lists too.
  const { data: rows } = ids.length ? await visibleTalent(m.company_id, `user_id, ${TALENT_FIELDS}`).in('user_id', ids) : { data: [] }
  const byUser = new Map(((rows || []) as unknown as (TalentRow & { user_id: string })[]).map((r) => [r.user_id, r]))
  sendSuccess(res, {
    ...folder,
    items: (items || []).flatMap((i) => {
      const r = byUser.get(i.user_id)
      return r ? [{ ...talentOut(r), note: i.note, saved_at: i.created_at }] : []
    }),
    hidden_count: ids.length - byUser.size,
  })
})

export const addFolderItem = h('folders.add', async (req, res) => {
  const m = await verifiedMember(req, res)
  if (!m) return
  const folder = await ownedFolder(uuidParam(req.params.folderId), m.company_id)
  if (!folder) return sendError(res, 'Folder not found', 404)
  const t = await talentUserId(req.body.talent_id, m.company_id)
  if (!t) return sendError(res, 'This profile isn’t available.', 404)
  const { count } = await supabaseAdmin.from('talent_folder_items').select('user_id', { count: 'exact', head: true }).eq('folder_id', folder.id)
  if ((count || 0) >= 500) return sendError(res, 'This folder is full.', 403)
  const { error } = await supabaseAdmin
    .from('talent_folder_items')
    .upsert({ folder_id: folder.id, user_id: t.user_id, added_by: req.user!.userId, note: stripHtml(req.body.note || '') || null }, { onConflict: 'folder_id,user_id' })
  if (error) throw error
  sendSuccess(res, null, 200, `Saved to ${folder.name}`)
})

export const removeFolderItem = h('folders.remove', async (req, res) => {
  const m = await verifiedMember(req, res)
  if (!m) return
  const folder = await ownedFolder(uuidParam(req.params.folderId), m.company_id)
  const talentId = uuidParam(req.params.talentId)
  if (!folder || !talentId) return sendError(res, 'Not found', 404)
  const { data: tp } = await supabaseAdmin.from('talent_profiles').select('user_id').eq('public_id', talentId).maybeSingle()
  if (tp) await supabaseAdmin.from('talent_folder_items').delete().eq('folder_id', folder.id).eq('user_id', tp.user_id)
  sendSuccess(res, null, 200, 'Removed')
})

// ═══ ANALYTICS ═══════════════════════════════════════════════

const median = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const hours = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000
const weekStart = (iso: string) => {
  const d = new Date(iso)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

export const getAnalytics = h('analytics', async (req, res) => {
  const m = await member(req, res)
  if (!m) return
  const days = [30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 90
  const since = new Date(Date.now() - days * DAY).toISOString()
  const { data: jobs } = await supabaseAdmin.from('jobs').select('id, title, status').eq('company_id', m.company_id).limit(500)
  const jobIds = (jobs || []).map((j) => j.id as string)
  type App = { id: string; job_id: string; stage: string; created_at: string; first_response_at: string | null; cv_opened_at: string | null }
  const apps: App[] = []
  const events: { application_id: string; stage: string; changed_by: string | null; created_at: string }[] = []
  for (let i = 0; i < jobIds.length; i += 200) {
    const chunk = jobIds.slice(i, i + 200)
    apps.push(...(await fetchAll<App>((from, to) => supabaseAdmin.from('job_applications').select('id, job_id, stage, created_at, first_response_at, cv_opened_at').in('job_id', chunk).gte('created_at', since).order('created_at').order('id').range(from, to))))
  }
  const appIds = apps.map((a) => a.id)
  for (let i = 0; i < appIds.length; i += 300) {
    const chunk = appIds.slice(i, i + 300)
    events.push(...(await fetchAll<(typeof events)[number]>((from, to) => supabaseAdmin.from('application_events').select('application_id, stage, changed_by, created_at').in('application_id', chunk).order('created_at').order('id').range(from, to))))
  }

  // Funnel: a stage counts as reached if the applicant is in it now or ever was.
  const reached = new Map<string, Set<string>>(apps.map((a) => [a.id, new Set([a.stage])]))
  const hiredAt = new Map<string, string>()
  for (const e of events) {
    reached.get(e.application_id)?.add(e.stage)
    if (e.stage === 'hired' && !hiredAt.has(e.application_id)) hiredAt.set(e.application_id, e.created_at)
  }
  const ORDER = STAGES.filter((s) => s !== 'rejected')
  const funnel = ORDER.map((stage, i) => ({
    stage,
    count: apps.filter((a) => {
      const r = reached.get(a.id)!
      return ORDER.slice(i).some((s) => r.has(s))
    }).length,
  }))

  const created = new Map(apps.map((a) => [a.id, a.created_at]))
  const weekly = new Map<string, number>()
  for (const a of apps) weekly.set(weekStart(a.created_at), (weekly.get(weekStart(a.created_at)) || 0) + 1)

  const titles = new Map<string, { title: string; status: string }>((jobs || []).map((j) => [j.id as string, { title: j.title as string, status: j.status as string }]))
  const perJob = new Map<string, { apps: number; opened: number; replied: number; hired: number }>()
  for (const a of apps) {
    const row = perJob.get(a.job_id) || { apps: 0, opened: 0, replied: 0, hired: 0 }
    row.apps += 1
    if (a.cv_opened_at) row.opened += 1
    if (a.first_response_at) row.replied += 1
    if (reached.get(a.id)!.has('hired')) row.hired += 1
    perJob.set(a.job_id, row)
  }

  const team = await supabaseAdmin.from('company_members').select('user_id, user:users(full_name)').eq('company_id', m.company_id).limit(50)
  const moves = new Map<string, number>()
  for (const e of events) if (e.changed_by && e.created_at >= since) moves.set(e.changed_by, (moves.get(e.changed_by) || 0) + 1)

  const round = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10)
  sendSuccess(res, {
    days,
    totals: { applications: apps.length, opened: apps.filter((a) => a.cv_opened_at).length, replied: apps.filter((a) => a.first_response_at).length, hired: hiredAt.size },
    funnel,
    median_hours: {
      to_open: round(median(apps.filter((a) => a.cv_opened_at).map((a) => hours(a.created_at, a.cv_opened_at!)))),
      to_reply: round(median(apps.filter((a) => a.first_response_at).map((a) => hours(a.created_at, a.first_response_at!)))),
      to_hire: round(median([...hiredAt].map(([id, at]) => hours(created.get(id)!, at)))),
    },
    weekly: [...weekly].sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count })),
    jobs: [...perJob]
      .map(([id, r]) => ({ id, title: titles.get(id)?.title || 'Job', status: titles.get(id)?.status || '', ...r }))
      .sort((a, b) => b.apps - a.apps)
      .slice(0, 50),
    team: (team.data || [])
      .map((t) => {
        const u = Array.isArray(t.user) ? t.user[0] : t.user
        return { full_name: u?.full_name || 'Member', moves: moves.get(t.user_id) || 0 }
      })
      .sort((a, b) => b.moves - a.moves),
  })
})

// ═══ WEBSITE BADGE (public SVG) ══════════════════════════════

const LEVEL_NAMES = ['New', 'Verified', 'Reliable', 'Proven', 'Trusted']
const badgeCache = new Map<string, { svg: string; status: number; at: number }>()
const BADGE_TTL = 60_000
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function badgeSvg(right: string, sub: string, ok: boolean): string {
  const w = 236
  const accent = ok ? '#22C55E' : '#737373'
  const title = `SafeApply: ${right}${sub ? `, ${sub}` : ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="44" viewBox="0 0 ${w} 44" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><rect width="${w}" height="44" rx="8" fill="#0D0D0D"/><rect x="0.5" y="0.5" width="${w - 1}" height="43" rx="7.5" fill="none" stroke="#1A1A1A"/><circle cx="22" cy="22" r="9" fill="${accent}"/>${ok ? '<path d="M17.5 22.2l3 3 6-6.2" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' : ''}<text x="40" y="19" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="12" font-weight="600" fill="#FFFFFF">${esc(right)}</text><text x="40" y="33" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="10.5" fill="#737373">${esc(sub)}</text></svg>`
}

export async function companyBadge(req: Request, res: Response): Promise<void> {
  const file = String(req.params.file || '').toLowerCase()
  const slug = file.endsWith('.svg') ? file.slice(0, -4) : ''
  res.set({
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=60, must-revalidate',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
  })
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
    res.status(404).send(badgeSvg('Not on SafeApply', '', false))
    return
  }
  const hit = badgeCache.get(slug)
  if (hit && Date.now() - hit.at < BADGE_TTL) {
    res.status(hit.status).send(hit.svg)
    return
  }
  try {
    const { data: c } = await supabaseAdmin.from('companies').select('id, verification_status, suspended, trust_level').eq('slug', slug).maybeSingle()
    let out: { svg: string; status: number }
    if (!c) out = { svg: badgeSvg('Not on SafeApply', '', false), status: 404 }
    else if (c.verification_status !== 'verified' || c.suspended) out = { svg: badgeSvg('Not verified', 'Checked by SafeApply', false), status: 200 }
    else {
      const rr = await companyResponseRate(c.id)
      const level = LEVEL_NAMES[c.trust_level as number] || 'Verified'
      out = { svg: badgeSvg('Verified employer', `${level}${rr.rate !== null ? ` · ${rr.rate}% get a reply` : ''} · SafeApply`, true), status: 200 }
    }
    if (badgeCache.size > 5000) badgeCache.clear()
    badgeCache.set(slug, { ...out, at: Date.now() })
    res.status(out.status).send(out.svg)
  } catch (e) {
    console.error('badge', e instanceof Error ? e.message : e)
    res.status(503).set('Cache-Control', 'no-store').send(badgeSvg('Status unavailable', '', false))
  }
}
