// ============================================================
// FILE: apps/backend/src/middleware/roles.ts
// PURPOSE: Role gates + optional auth.
//   requireRole('recruiter', 'admin') — run AFTER authMiddleware. The role
//   comes from the database on every request (authMiddleware re-reads it),
//   so a demoted user loses access immediately.
//   optionalAuth — attaches req.user when a valid token is sent, otherwise
//   continues anonymously (public pages that show "you applied" etc.).
// ============================================================

import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { supabaseAdmin } from '../config/supabase'

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'You don’t have access to this.' })
      return
    }
    next()
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return next()
  try {
    const p = verifyAccessToken(h.slice(7))
    const { data: user } = await supabaseAdmin.from('users').select('id, email, role, plan').eq('id', p.userId).maybeSingle()
    if (user) req.user = { userId: user.id, email: user.email, role: user.role, plan: user.plan }
  } catch {
    /* invalid/expired token on a public route = anonymous */
  }
  next()
}
