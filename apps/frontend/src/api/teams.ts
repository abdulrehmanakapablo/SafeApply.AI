// FILE: src/api/teams.ts
// PURPOSE: Recruiter plan clients: team, candidate notes, talent search,
//          folders, analytics; seeker visibility; team invite links.

import api from '../lib/axios'
import type { WorkMode } from './recruiter'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }
type Paged<T> = { success: boolean; data: T[]; total: number; page: number; limit: number; total_pages: number }

// ── Team ─────────────────────────────────────────────────────
export interface TeamMember {
  id: string
  member_role: 'owner' | 'recruiter'
  full_name: string
  email: string
  created_at: string
  is_me: boolean
}
export interface TeamInvite {
  id: string
  email: string
  expires_at: string
  created_at: string
}
export interface Team {
  members: TeamMember[]
  invites: TeamInvite[]
  seats: { used: number; cap: number }
  me: { member_role: 'owner' | 'recruiter' }
  company: { name: string; slug: string; verified: boolean; pro: boolean }
}
export const getTeam = () => api.get<Ok<Team>>('/recruiter/team').then((r) => r.data)
export const inviteTeammate = (email: string) => api.post<Ok<{ id: string; link: string; emailed: boolean }>>('/recruiter/team/invites', { email }).then((r) => r.data)
export const revokeTeamInvite = (id: string) => api.delete<Ok<null>>(`/recruiter/team/invites/${id}`).then((r) => r.data)
export const removeTeammate = (id: string) => api.delete<Ok<null>>(`/recruiter/team/members/${id}`).then((r) => r.data)
export const leaveTeam = () => api.post<Ok<null>>('/recruiter/team/leave').then((r) => r.data)

export interface InvitePreview {
  company: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  email_matches: boolean
  is_recruiter: boolean
}
export const previewTeamInvite = (token: string) => api.get<Ok<InvitePreview>>(`/team/invites/${encodeURIComponent(token)}`).then((r) => r.data)
export const joinTeam = (token: string) => api.post<Ok<{ company: string }>>('/team/join', { token }).then((r) => r.data)

// ── Notes ────────────────────────────────────────────────────
export interface CandidateNote {
  id: string
  body: string
  rating: number | null
  created_at: string
  author: string
  mine: boolean
  mentions: string[]
}
export interface NotesPayload {
  notes: CandidateNote[]
  rating: { avg: number; count: number } | null
  team: { id: string; full_name: string }[]
  can_moderate: boolean
}
export const listNotes = (appId: string) => api.get<Ok<NotesPayload>>(`/recruiter/applicants/${appId}/notes`).then((r) => r.data)
export const addNote = (appId: string, body: { body: string; rating: number | null; mentions: string[] }) =>
  api.post<Ok<{ id: string }>>(`/recruiter/applicants/${appId}/notes`, body).then((r) => r.data)
export const deleteNote = (appId: string, noteId: string) => api.delete<Ok<null>>(`/recruiter/applicants/${appId}/notes/${noteId}`).then((r) => r.data)

// ── Talent ───────────────────────────────────────────────────
export interface Talent {
  id: string
  full_name: string
  headline: string | null
  skills: string[]
  location: string | null
  desired_roles: string | null
  work_modes: WorkMode[]
  open_to_work: boolean
  updated_at: string
}
export interface TalentDetail extends Talent {
  trust_level: number
  folders: { id: string; name: string; saved: boolean }[]
  invited_job_ids: string[]
  open_jobs: { id: string; title: string }[]
  invites_left: number
}
export interface TalentQuery {
  q?: string
  skill?: string
  location?: string
  mode?: string
  open?: '1'
  page?: number
}
export const searchTalent = (params: TalentQuery) => api.get<Paged<Talent>>('/recruiter/talent', { params }).then((r) => r.data)
export const getTalent = (id: string) => api.get<Ok<TalentDetail>>(`/recruiter/talent/${id}`).then((r) => r.data)
export const inviteTalent = (id: string, job_id: string) => api.post<Ok<null>>(`/recruiter/talent/${id}/invite`, { job_id }).then((r) => r.data)

export interface Folder {
  id: string
  name: string
  created_at: string
  count: number
}
export interface FolderDetail {
  id: string
  name: string
  items: (Talent & { note: string | null; saved_at: string })[]
  hidden_count: number
}
export const listFolders = () => api.get<Ok<Folder[]>>('/recruiter/talent/folders').then((r) => r.data)
export const createFolder = (name: string) => api.post<Ok<{ id: string; name: string }>>('/recruiter/talent/folders', { name }).then((r) => r.data)
export const getFolder = (id: string) => api.get<Ok<FolderDetail>>(`/recruiter/talent/folders/${id}`).then((r) => r.data)
export const deleteFolder = (id: string) => api.delete<Ok<null>>(`/recruiter/talent/folders/${id}`).then((r) => r.data)
export const saveToFolder = (folderId: string, talent_id: string, note = '') => api.post<Ok<null>>(`/recruiter/talent/folders/${folderId}/items`, { talent_id, note }).then((r) => r.data)
export const removeFromFolder = (folderId: string, talentId: string) => api.delete<Ok<null>>(`/recruiter/talent/folders/${folderId}/items/${talentId}`).then((r) => r.data)

// ── Analytics ────────────────────────────────────────────────
export interface HiringAnalytics {
  days: number
  totals: { applications: number; opened: number; replied: number; hired: number }
  funnel: { stage: string; count: number }[]
  median_hours: { to_open: number | null; to_reply: number | null; to_hire: number | null }
  weekly: { week: string; count: number }[]
  jobs: { id: string; title: string; status: string; apps: number; opened: number; replied: number; hired: number }[]
  team: { full_name: string; moves: number }[]
}
export const getHiringAnalytics = (days: number) => api.get<Ok<HiringAnalytics>>('/recruiter/analytics', { params: { days } }).then((r) => r.data)

// ── Seeker visibility ────────────────────────────────────────
export interface MyTalent {
  visible: boolean
  open_to_work: boolean
  headline: string | null
  skills: string[]
  location: string | null
  desired_roles: string | null
  work_modes: WorkMode[]
  hidden_company_ids: string[]
  hidden_companies: { id: string; name: string; slug: string }[]
  updated_at: string | null
}
export type MyTalentInput = Omit<MyTalent, 'hidden_companies' | 'updated_at' | 'headline' | 'location' | 'desired_roles'> & { headline: string; location: string; desired_roles: string }
export const getMyTalent = () => api.get<Ok<MyTalent>>('/talent/me').then((r) => r.data)
export const saveMyTalent = (body: MyTalentInput) => api.put<Ok<null>>('/talent/me', body).then((r) => r.data)

/** Human duration from hours: "5 h", "3.2 days". */
export function fmtHours(h: number | null): string {
  if (h === null) return 'No data'
  if (h < 48) return `${Math.max(1, Math.round(h))} h`
  return `${Math.round((h / 24) * 10) / 10} days`
}
