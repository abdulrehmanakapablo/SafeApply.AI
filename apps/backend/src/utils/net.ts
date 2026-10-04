// ============================================================
// FILE: apps/backend/src/utils/net.ts
// PURPOSE: Client IP helpers. Raw IPs are never stored or logged; anything
//          that must remember an IP (guest demo limit) stores an HMAC of it.
// ============================================================

import crypto from 'crypto'
import type { Request } from 'express'
import { env } from '../config/env'

export function clientIp(req: Request): string {
  // With `trust proxy` set correctly, req.ip is the real client address.
  return req.ip || req.socket.remoteAddress || 'unknown'
}

/** Stable, non-reversible identifier for an IP. Safe to use as a cache key. */
export function hashedIp(req: Request): string {
  return crypto.createHmac('sha256', env.ipHashSecret).update(clientIp(req)).digest('hex').slice(0, 32)
}

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}
