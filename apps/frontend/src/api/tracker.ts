// FILE: src/api/tracker.ts
// PURPOSE: Frontend API client for /api/tracker/*

import api from '../lib/axios'

export type ApplicationStatus = 'saved' | 'applied' | 'screening' | 'interviewing' | 'offered' | 'rejected' | 'ghosted'

export type CommunicationType = 'email' | 'call' | 'interview' | 'follow_up' | 'rejection'

export interface Application {
  id: string
  user_id: string
  company_name: string
  job_title: string
  date_applied: string
  job_link?: string | null
  salary_min?: number | null
  salary_max?: number | null
  location?: string | null
  status: ApplicationStatus
  notes?: string | null
  jd_text?: string | null
  match_score?: number | null
  created_at: string
  updated_at: string
  job_application_id?: string | null
  /** Read receipt for applications sent through the SafeApply jobs board. */
  receipt?: { cv_opened_at: string | null; first_response_at: string | null; no_response: boolean; stage: string } | null
}

/** Board applications open their receipt timeline; manual ones open the tracker card. */
export const applicationHref = (a: Pick<Application, 'id' | 'job_application_id'>) => (a.job_application_id ? `/dashboard/applications/${a.job_application_id}` : `/dashboard/tracker/${a.id}`)

export interface ApplicationTimeline {
  id: string
  application_id: string
  status: string
  changed_at: string
}

export interface CommunicationLogEntry {
  id: string
  application_id: string
  type: CommunicationType
  notes: string
  date: string
  created_at: string
}

export interface ApplicationDetail extends Application {
  timeline: ApplicationTimeline[]
  communication_log: CommunicationLogEntry[]
}

export interface ApplicationListResponse {
  success: boolean
  data: Application[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface ApplicationDetailResponse {
  success: boolean
  data: ApplicationDetail
}

export type ApplicationInput = {
  company_name: string
  job_title: string
  date_applied: string
  job_link?: string
  salary_min?: number
  salary_max?: number
  location?: string
  status?: ApplicationStatus
  notes?: string
  jd_text?: string
}

export async function getApplications(params?: { status?: string; search?: string; page?: number }): Promise<ApplicationListResponse> {
  const res = await api.get<ApplicationListResponse>('/tracker', { params })
  return res.data
}

export async function getApplication(id: string): Promise<ApplicationDetailResponse> {
  const res = await api.get<ApplicationDetailResponse>(`/tracker/${id}`)
  return res.data
}

export async function createApplication(payload: ApplicationInput) {
  const res = await api.post('/tracker', payload)
  return res.data as { success: boolean; data?: Application; error?: string }
}

export async function updateApplication(
  id: string,
  payload: Partial<Omit<ApplicationInput, 'jd_text'> & { match_score: number }>,
) {
  const res = await api.patch(`/tracker/${id}`, payload)
  return res.data as { success: boolean; data?: Application; error?: string }
}

export async function deleteApplication(id: string) {
  const res = await api.delete(`/tracker/${id}`)
  return res.data as { success: boolean; error?: string }
}

export async function addCommunication(id: string, payload: { type: CommunicationType; notes: string; date: string }) {
  const res = await api.post(`/tracker/${id}/communication`, payload)
  return res.data as { success: boolean; data?: CommunicationLogEntry; error?: string }
}
