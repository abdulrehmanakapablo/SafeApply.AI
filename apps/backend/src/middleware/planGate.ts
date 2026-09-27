// ============================================================
// FILE: apps/backend/src/middleware/planGate.ts
// PURPOSE: Feature gating — currently disabled, all features free
// TODO: Uncomment the limit logic below when adding paywall
// ============================================================

import { Request, Response, NextFunction } from 'express'

// Currently passes everyone through — no limits enforced
// When ready to add paywall, replace this with the full implementation
export function planGate(_feature: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next()
  }
}