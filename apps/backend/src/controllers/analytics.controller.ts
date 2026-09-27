// ============================================================
// FILE: apps/backend/src/controllers/analytics.controller.ts
// PURPOSE: Personal job hunt analytics aggregation
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { generateAnalyticsInsights } from '../services/groq.service'
import { getCached, setCached, CACHE_TTL } from '../services/cache.service'
import { sendSuccess, sendError } from '../utils/response'

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const period = (req.query.period as string) || '30d'
    const userId = req.user!.userId
    const cacheKey = `${userId}-${period}`

    // Check cache
    const cached = await getCached('analytics', cacheKey)
    if (cached) {
      sendSuccess(res, cached)
      return
    }

    // Calculate date range
    const now = new Date()
    let fromDate: Date | null = null

    if (period === '30d') {
      fromDate = new Date(now)
      fromDate.setDate(fromDate.getDate() - 30)
    } else if (period === '90d') {
      fromDate = new Date(now)
      fromDate.setDate(fromDate.getDate() - 90)
    }

    // Fetch all applications in period
    let query = supabaseAdmin
      .from('applications')
      .select('status, created_at, date_applied')
      .eq('user_id', userId)

    if (fromDate) {
      query = query.gte('created_at', fromDate.toISOString())
    }

    const { data: applications, error } = await query

    if (error) {
      sendError(res, 'Failed to fetch analytics', 500)
      return
    }

    const apps = applications || []
    const total = apps.length

    // Calculate rates
    const responded = apps.filter((a) =>
      ['screening', 'interviewing', 'offered', 'rejected'].includes(a.status)
    ).length

    const interviewed = apps.filter((a) =>
      ['interviewing', 'offered'].includes(a.status)
    ).length

    const offered = apps.filter((a) => a.status === 'offered').length

    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0
    const interviewRate = total > 0 ? Math.round((interviewed / total) * 100) : 0
    const offerRate = total > 0 ? Math.round((offered / total) * 100) : 0

    // Applications by status
    const byStatus = apps.reduce(
      (acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Applications over time — group by week
    const byWeek: Record<string, number> = {}
    apps.forEach((app) => {
      const week = new Date(app.created_at)
      week.setDate(week.getDate() - week.getDay())
      const key = week.toISOString().split('T')[0]
      byWeek[key] = (byWeek[key] || 0) + 1
    })

    const stats = {
      total_applications: total,
      response_rate: responseRate,
      interview_rate: interviewRate,
      offer_rate: offerRate,
      by_status: byStatus,
      by_week: Object.entries(byWeek)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, count]) => ({ week, count })),
    }

    // Generate AI insights from the stats
    const insights = await generateAnalyticsInsights(stats)

    const result = { ...stats, insights: insights || [] }

    await setCached('analytics', cacheKey, result, CACHE_TTL.ANALYTICS)
    sendSuccess(res, result)
  } catch (error) {
    console.error('Get analytics error:', error)
    sendError(res, 'Server error', 500)
  }
}