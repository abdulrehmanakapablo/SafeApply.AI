// ============================================================
// FILE: apps/backend/src/utils/jwt.ts
// PURPOSE: JWT token generation and verification helpers
// Access token: 15 minutes — short lived for security
// Refresh token: 7 days — rotated on every use
// Payload contains only non-sensitive user identifiers
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
}

// Generate a short-lived access token — 15 minutes
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '15m' })
}

// Generate a long-lived refresh token — 7 days
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: '7d' })
}

// Verify an access token — throws specific errors on failure
export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error('TOKEN_INVALID')
  }
}

// Verify a refresh token — throws specific errors on failure
export function verifyRefreshToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.jwtRefreshSecret) as JwtPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error('TOKEN_INVALID')
  }
}