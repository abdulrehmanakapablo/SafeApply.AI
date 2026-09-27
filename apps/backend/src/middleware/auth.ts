// ============================================================
// FILE: apps/backend/src/middleware/auth.ts
// PURPOSE: JWT verification middleware for protected routes
// Extracts Bearer token from Authorization header
// Attaches decoded user to req.user for use in controllers
// Returns 401 if token is missing, expired, or invalid
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { supabaseAdmin } from '../config/supabase'

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
        role: string
        plan: string
      }
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Extract token from Authorization: Bearer <token> header
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  try {
    // Verify token signature and expiry
    const payload = verifyAccessToken(token)

    // Fetch current user from database to get latest plan and role
    // This ensures plan changes take effect immediately
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, plan')
      .eq('id', payload.userId)
      .single()

    if (error || !user) {
      res.status(401).json({ success: false, error: 'User not found' })
      return
    }

    // Attach user to request for use in controllers
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    }

    next()
  } catch (error) {
    const message =
      error instanceof Error && error.message === 'TOKEN_EXPIRED'
        ? 'Token expired'
        : 'Invalid token'

    res.status(401).json({ success: false, error: message })
  }
}