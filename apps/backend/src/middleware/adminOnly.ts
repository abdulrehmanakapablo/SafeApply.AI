// ============================================================
// FILE: apps/backend/src/middleware/adminOnly.ts
// PURPOSE: Restricts route access to admin users only
// Must be used AFTER authMiddleware — needs req.user to exist
// Returns 403 Forbidden if user is not an admin
// ============================================================

import { Request, Response, NextFunction } from 'express'

export function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // authMiddleware must run before this
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' })
    return
  }

  next()
}