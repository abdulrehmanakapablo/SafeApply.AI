// ============================================================
// FILE: apps/backend/src/controllers/records.controller.ts
// PURPOSE: Public Hiring Record for a company: computed scores plus the
//          per-job facts behind them (applicants, CVs opened, replies,
//          ghost flags, outcomes). Only data recorded on SafeApply.
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'

const SLUG_RE = /^[a-z0-9-]{1,200}$/

export async function getCompanyRecord(req: Request, res: Response): Promise<void> {
  try {
    const slug = String(req.params.slug ?? '')
    if (!SLUG_RE.test(slug)) return sendError(res, 'Company not found', 404)
    const { data: c } = await supabaseAdmin
      .from('companies')
      .select('id, name, slug, verification_status, penalty_level, penalty_reason, suspended, verified_at')
      .eq('slug', slug)
      .maybeSingle()
    if (!c || c.verification_status !== 'verified') return sendError(res, 'Company not found', 404)

    const [{ data: score }, { data: jobs }] = await Promise.all([
      supabaseAdmin.from('company_scores').select('*').eq('company_id', c.id).maybeSingle(),
      supabaseAdmin
        .from('jobs')
        .select('id, title, status, created_at, closed_at, outcome, apps_count, opened_count, replied_count, ghost_flag')
        .eq('company_id', c.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    const { company_id: _cid, ...rest } = score || ({} as Record<string, unknown>)
    void _cid
    sendSuccess(res, {
      company: { name: c.name, slug: c.slug, verified_at: c.verified_at, suspended: c.suspended },
      warning: c.penalty_level >= 2 ? c.penalty_reason : null,
      score: score ? rest : null,
      jobs: jobs || [],
    })
  } catch (e) {
    console.error('getCompanyRecord', e)
    sendError(res, 'Server error', 500)
  }
}
