// FILE: src/api/interviews.ts
import api from '../lib/axios'

type Ok<T> = { success: boolean; data: T; message?: string; error?: string }

export type InterviewMode = 'video' | 'phone' | 'onsite'
export type InterviewStatus = 'proposed' | 'scheduled' | 'reschedule_requested' | 'cancelled'

export interface InterviewBase {
  id: string
  application_id: string
  mode: InterviewMode
  duration_min: number
  location: string | null
  note: string | null
  video_url: string | null
  status: InterviewStatus
  scheduled_at: string | null
  cancel_reason: string | null
  cancelled_by: 'company' | 'candidate' | null
  candidate_note: string | null
  company_confirmed: boolean | null
  candidate_confirmed: boolean | null
  created_at: string
}
export interface InterviewRow extends InterviewBase {
  job: { id: string; title: string }
  company: { name: string; slug: string }
  candidate_name?: string
}
export interface InterviewDetail extends InterviewBase {
  side: 'candidate' | 'company' | 'admin'
  slots: { id: string; starts_at: string }[]
  job: { title: string }
  company: { name: string }
  candidate_name: string | null
}

export const MODE_LABEL: Record<InterviewMode, string> = { video: 'Video call', phone: 'Phone call', onsite: 'In person' }
export const MODE_ICON: Record<InterviewMode, string> = { video: 'videocam', phone: 'call', onsite: 'apartment' }
export const STATUS_LABEL: Record<InterviewStatus, string> = { proposed: 'Waiting for a time', scheduled: 'Booked', reschedule_requested: 'New times requested', cancelled: 'Cancelled' }

export const listInterviews = async () => (await api.get<Ok<InterviewRow[]>>('/interviews')).data
export const getInterview = async (id: string) => (await api.get<Ok<InterviewDetail>>(`/interviews/${id}`)).data
export const createInterview = async (b: { application_id: string; mode: InterviewMode; duration_min: number; location: string; note: string; slots: string[] }) =>
  (await api.post<Ok<{ id: string }>>('/interviews', b)).data
export const proposeSlots = async (id: string, slots: string[]) => (await api.post<Ok<unknown>>(`/interviews/${id}/slots`, { slots })).data
export const pickSlot = async (id: string, slot_id: string) => (await api.post<Ok<{ scheduled_at: string }>>(`/interviews/${id}/pick`, { slot_id })).data
export const requestReschedule = async (id: string, note: string) => (await api.post<Ok<unknown>>(`/interviews/${id}/reschedule`, { note })).data
export const cancelInterview = async (id: string, reason: string) => (await api.post<Ok<unknown>>(`/interviews/${id}/cancel`, { reason })).data
export const confirmInterview = async (id: string, held: boolean) => (await api.post<Ok<unknown>>(`/interviews/${id}/confirm`, { held })).data
export const confirmHire = async (applicationId: string, confirmed: boolean) => (await api.post<Ok<unknown>>(`/jobs/applications/${applicationId}/confirm-hire`, { confirmed })).data

/** "Tue 14 Oct, 15:30" in the viewer's own time zone. */
export const fmtSlot = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const isPast = (iv: Pick<InterviewBase, 'scheduled_at' | 'duration_min'>) => Boolean(iv.scheduled_at && new Date(iv.scheduled_at).getTime() < Date.now())
