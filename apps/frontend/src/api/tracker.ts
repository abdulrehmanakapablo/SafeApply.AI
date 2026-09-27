// FILE: src/api/tracker.ts
// PURPOSE: Frontend API client for /api/tracker/*
// BACKEND: apps/backend/src/routes/tracker.ts

import api from '../lib/axios'

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'ghosted'

export type CommunicationType =
  | 'email'
  | 'call'
  | 'interview'
  | 'follow_up'
  | 'rejection'

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
}

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

// GET /api/tracker — list with filters
export async function getApplications(params?: {
  status?: string
  search?: string
  page?: number
}): Promise<ApplicationListResponse> {
  const res = await api.get<ApplicationListResponse>('/tracker', { params })
  return res.data
}

// GET /api/tracker/:id — single application with timeline + comm log
export async function getApplication(
  id: string
): Promise<ApplicationDetailResponse> {
  const res = await api.get<ApplicationDetailResponse>(`/tracker/${id}`)
  return res.data
}

// POST /api/tracker — create
export async function createApplication(payload: {
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
}) {
  const res = await api.post('/tracker', payload)
  return res.data
}

// PATCH /api/tracker/:id — update fields
export async function updateApplication(
  id: string,
  payload: Partial<{
    company_name: string
    job_title: string
    date_applied: string
    job_link: string
    salary_min: number
    salary_max: number
    location: string
    status: ApplicationStatus
    notes: string
    match_score: number
  }>
) {
  const res = await api.patch(`/tracker/${id}`, payload)
  return res.data
}

// DELETE /api/tracker/:id
export async function deleteApplication(id: string) {
  const res = await api.delete(`/tracker/${id}`)
  return res.data
}

// POST /api/tracker/:id/communication
export async function addCommunication(
  id: string,
  payload: { type: CommunicationType; notes: string; date: string }
) {
  const res = await api.post(`/tracker/${id}/communication`, payload)
  return res.data
}