// ============================================================
// FILE: apps/backend/src/controllers/notifications.controller.ts
// ============================================================

import type { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { sendError, sendSuccess } from '../utils/response'

export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    const [{ data, error }, { count }] = await Promise.all([
      supabaseAdmin.from('notifications').select('id, type, title, body, link, read_at, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
    ])
    if (error) throw error
    sendSuccess(res, { items: data || [], unread: count || 0 })
  } catch (e) {
    console.error('listNotifications', e)
    sendError(res, 'Server error', 500)
  }
}

export async function markRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId
    let q = supabaseAdmin.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
    if (!req.body.all) q = q.in('id', req.body.ids as string[])
    const { error } = await q
    if (error) throw error
    sendSuccess(res, null)
  } catch (e) {
    console.error('markRead', e)
    sendError(res, 'Server error', 500)
  }
}
