// FILE: src/api/analytics.ts
// PURPOSE: Frontend API client for /api/analytics

import api from '../lib/axios'

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all'

export interface AnalyticsData {
  total_applications: number
  response_rate: number
  interview_rate: number
  offer_rate: number
  rejection_rate: number
  ghosted_rate: number
  cv_matches: number
  reports_run: number
  reports_quota: number
  cv_matches_quota: number
  avg_match_score: number
  status_breakdown: {
    saved: number
    applied: number
    screening: number
    interviewing: number
    offered: number
    rejected: number
    ghosted: number
  }
  insights: string[]
}

export interface AnalyticsResponse {
  success: boolean
  data?: AnalyticsData
  error?: string
}

export async function getAnalytics(period: AnalyticsPeriod = '30d'): Promise<AnalyticsResponse> {
  const res = await api.get<AnalyticsResponse>('/analytics', { params: { period }, timeout: 30_000 })
  return res.data
}
