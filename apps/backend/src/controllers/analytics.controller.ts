// ============================================================
// FILE: apps/backend/src/controllers/analytics.controller.ts
// PURPOSE: Aggregated job-hunt stats for the dashboard and analytics page.
//          All numbers computed from real rows — no mock data.
//          Free tier: 10 of each feature (uses FREE_LIMIT from utils/usage).
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { generateAnalyticsInsights } from '../services/groq.service'
import { FREE_LIMIT } from '../utils/usage'
import { sendSuccess, sendError } from '../utils/response'

type Period = '7d' | '30d' | '90d' | 'all'

function periodCutoff(period: Period): Date | null {
  if (period === 'all') return null
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return new Date(Date.now() - days * 86_400_000)
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const raw = String(req.query.period ?? '30d')
    const period: Period = raw === '7d' || raw === '90d' || raw === 'all' ? raw : '30d'
    const cutoff = periodCutoff(period)

    // ── Applications ─────────────────────────────────
    let appQuery = supabaseAdmin
      .from('applications')
      .select('id, status, match_score, created_at, date_applied')
      .eq('user_id', userId)

    if (cutoff) {
      appQuery = appQuery.gte('created_at', cutoff.toISOString())
    }

    const { data: applications, error: appError } = await appQuery

    if (appError) {
      console.error('Analytics — applications fetch error:', appError)
      sendError(res, 'Failed to load analytics', 500)
      return
    }

    const apps = applications || []
    const totalApplications = apps.length

    // Status breakdown
    const statusBreakdown = {
      saved: 0,
      applied: 0,
      screening: 0,
      interviewing: 0,
      offered: 0,
      rejected: 0,
      ghosted: 0,
    }
    for (const a of apps) {
      const s = a.status as keyof typeof statusBreakdown
      if (s in statusBreakdown) statusBreakdown[s]++
    }

    // Response rate = anything past 'saved' and 'applied' ÷ total
    const responded =
      statusBreakdown.screening +
      statusBreakdown.interviewing +
      statusBreakdown.offered +
      statusBreakdown.rejected
    const responseRate =
      totalApplications > 0
        ? Math.round((responded / totalApplications) * 1000) / 10
        : 0

    // Interview / offer / rejection / ghosted rates
    const interviewed =
      statusBreakdown.interviewing + statusBreakdown.offered
    const interviewRate =
      totalApplications > 0
        ? Math.round((interviewed / totalApplications) * 1000) / 10
        : 0
    const offerRate =
      totalApplications > 0
        ? Math.round((statusBreakdown.offered / totalApplications) * 1000) / 10
        : 0
    const rejectionRate =
      totalApplications > 0
        ? Math.round((statusBreakdown.rejected / totalApplications) * 1000) / 10
        : 0
    const ghostedRate =
      totalApplications > 0
        ? Math.round((statusBreakdown.ghosted / totalApplications) * 1000) / 10
        : 0

    // Avg match score across apps that have one
    const scored = apps.filter(
      (a) => typeof a.match_score === 'number' && a.match_score > 0,
    )
    const avgMatchScore =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, a) => sum + (a.match_score || 0), 0) /
              scored.length,
          )
        : 0

    // ── Reports run ──────────────────────────────────
    let reportQuery = supabaseAdmin
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (cutoff) {
      reportQuery = reportQuery.gte('created_at', cutoff.toISOString())
    }

    const { count: reportsRun } = await reportQuery

    // ── CV matches ───────────────────────────────────
    let cvQuery = supabaseAdmin
      .from('cv_matches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (cutoff) {
      cvQuery = cvQuery.gte('created_at', cutoff.toISOString())
    }

    const { count: cvMatches } = await cvQuery

    // ── Plan quotas ──────────────────────────────────
    // Free tier gets 10 of each. Paid plans are unlimited.
    // Uses the same FREE_LIMIT constant as utils/usage.ts so both stay in sync.
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single()

    const plan = userRow?.plan || 'free'
    const reportsQuota = plan === 'free' ? FREE_LIMIT : 999999
    const cvMatchesQuota = plan === 'free' ? FREE_LIMIT : 999999

    // ── AI insights (best-effort — failure doesn't break response) ──
    let insights: string[] = []
    if (totalApplications > 0) {
      try {
        const ai = await generateAnalyticsInsights({
          total_applications: totalApplications,
          response_rate: responseRate,
          interview_rate: interviewRate,
          offer_rate: offerRate,
          avg_match_score: avgMatchScore,
          status_breakdown: statusBreakdown,
        })
        if (ai) insights = ai
      } catch (e) {
        console.warn('Analytics insights failed (non-critical):', e)
      }
    }

    sendSuccess(res, {
      total_applications: totalApplications,
      response_rate: responseRate,
      interview_rate: interviewRate,
      offer_rate: offerRate,
      rejection_rate: rejectionRate,
      ghosted_rate: ghostedRate,
      cv_matches: cvMatches || 0,
      reports_run: reportsRun || 0,
      reports_quota: reportsQuota,
      cv_matches_quota: cvMatchesQuota,
      avg_match_score: avgMatchScore,
      status_breakdown: statusBreakdown,
      insights,
    })
  } catch (error) {
    console.error('Get analytics error:', error)
    sendError(res, 'Server error', 500)
  }
}