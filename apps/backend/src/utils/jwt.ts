// ============================================================
// FILE: apps/backend/src/utils/jwt.ts
// PURPOSE: JWT helpers. Algorithm pinned to HS256 (blocks "alg: none" and
//          algorithm-confusion tricks), issuer + audience checked, and the
//          two token types can't be swapped for each other.
// Access token: 15 minutes. Refresh token: 7 days, rotated on every use.
// ============================================================

import jwt from 'jsonwebtoken'
import { env } from '../config/env'

interface TokenPayload {
  userId: string
  email: string
  role: string
}

interface JwtPayload extends TokenPayload {
  iat: number
  exp: number
  typ?: 'access' | 'refresh'
}

const ISSUER = 'safeapply-api'
const AUDIENCE = 'safeapply-app'
const ALG = 'HS256' as const

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, typ: 'access' }, env.jwtSecret, { algorithm: ALG, expiresIn: '15m', issuer: ISSUER, audience: AUDIENCE })
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, typ: 'refresh' }, env.jwtRefreshSecret, { algorithm: ALG, expiresIn: '7d', issuer: ISSUER, audience: AUDIENCE })
}

function verify(token: string, secret: string, typ: 'access' | 'refresh'): JwtPayload {
  try {
    const p = jwt.verify(token, secret, { algorithms: [ALG], issuer: ISSUER, audience: AUDIENCE }) as JwtPayload
    if (p.typ !== typ || typeof p.userId !== 'string') throw new Error('TOKEN_INVALID')
    return p
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw new Error('TOKEN_EXPIRED')
    throw new Error('TOKEN_INVALID')
  }
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, env.jwtSecret, 'access')
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, env.jwtRefreshSecret, 'refresh')
}
