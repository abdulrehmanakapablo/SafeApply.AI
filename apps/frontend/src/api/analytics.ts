// FILE: src/api/analytics.ts
// PURPOSE: Frontend API client for /api/analytics
// BACKEND: apps/backend/src/routes/analytics.ts

import api from '../lib/axios'

export interface AnalyticsStats {
  total_applications: number
  response_rate: number
  interview_rate: number
  offer_rate: number
  by_status: Record<string, number>
  by_week: { week: string; count: number }[]
  insights: string[]
}

export interface AnalyticsResponse {
  success: boolean
  data?: AnalyticsStats
  error?: string
}

export type AnalyticsPeriod = '30d' | '90d' | 'all'

export async function getAnalytics(
  period: AnalyticsPeriod = '30d'
): Promise<AnalyticsResponse> {
  const res = await api.get<AnalyticsResponse>('/analytics', {
    params: { period },
  })
  return res.data
}