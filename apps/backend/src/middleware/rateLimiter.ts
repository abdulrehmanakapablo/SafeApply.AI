// ============================================================
// FILE: apps/backend/src/middleware/rateLimiter.ts
// PURPOSE: Rate limits by sensitivity. Public routes key on client IP
//          (real IP via `trust proxy`, IPv6 grouped by /56 so one machine
//          can't rotate addresses). Logged-in routes key on the user id, so
//          people behind one office/university IP don't block each other.
//
// NOTE: The default store is in-memory (per server process). If you run
// more than one instance, switch to a shared store (Redis) so limits add up.
// ============================================================

import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import type { Request } from 'express'

const MIN = 60 * 1000
const HOUR = 60 * MIN

const byIp = (req: Request) => ipKeyGenerator(req.ip || '', 56)
const byUser = (req: Request) => (req.user?.userId ? `u:${req.user.userId}` : `ip:${byIp(req)}`)

function limiter(windowMs: number, limit: number, error: string, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: byIp,
    message: { success: false, error, code: 'RATE_LIMITED' },
    ...extra,
  })
}

// Every request. Generous enough for a busy SPA session, stops floods.
export const globalLimiter = limiter(15 * MIN, 600, 'Too many requests. Slow down and try again shortly.')

// Login: per IP+email (stops password guessing on one account) …
export const loginAccountLimiter = limiter(15 * MIN, 5, 'Too many login attempts for this account. Try again in 15 minutes.', {
  keyGenerator: (req) => `${byIp(req)}:${String(req.body?.email || '').toLowerCase().trim().slice(0, 254)}`,
  skipSuccessfulRequests: true,
})
// … and per IP overall (stops spraying many accounts from one machine).
export const authLimiter = limiter(15 * MIN, 20, 'Too many attempts. Try again in 15 minutes.')

export const signupLimiter = limiter(HOUR, 5, 'Too many sign-ups from this network. Try again later.')
export const forgotPasswordLimiter = limiter(HOUR, 3, 'Too many password reset requests. Try again in an hour.')
export const resetPasswordLimiter = limiter(HOUR, 10, 'Too many attempts. Try again in an hour.')
export const refreshLimiter = limiter(15 * MIN, 60, 'Too many session refreshes. Log in again.')

// Anonymous job-post demo. Backstop to the 1-per-30-days Redis rule, and the
// only guard when Redis isn't configured.
export const demoLimiter = limiter(24 * HOUR, 3, 'You have used your free check. Sign up to continue.', { message: { success: false, error: 'You have used your free check. Sign up to continue.', code: 'DEMO_EXHAUSTED' } })

// ── Logged-in (must come after authMiddleware) ──
// Anything that calls the AI model or third-party APIs.
export const aiLimiter = limiter(HOUR, 60, 'You’re going fast. Wait a few minutes and try again.', { keyGenerator: byUser })
// File uploads.
export const uploadLimiter = limiter(HOUR, 15, 'Too many uploads. Try again in an hour.', { keyGenerator: byUser })
// Writes (tracker, saved CVs, profile).
export const writeLimiter = limiter(15 * MIN, 120, 'Too many changes in a short time. Try again shortly.', { keyGenerator: byUser })
// Reviews: unlimited in total, but not a spam cannon.
export const reviewLimiter = limiter(HOUR, 5, 'You can post up to 5 reviews an hour.', { keyGenerator: byUser })
export const helpfulLimiter = limiter(HOUR, 60, 'Too many votes. Try again later.', { keyGenerator: byUser })
// Dashboard/analytics reads (analytics also asks the AI for insights).
export const analyticsLimiter = limiter(15 * MIN, 60, 'Too many requests. Try again shortly.', { keyGenerator: byUser })
// Job applications and messages (logged in).
export const applyLimiter = limiter(24 * HOUR, 30, 'You’ve sent a lot of applications today. Try again tomorrow.', { keyGenerator: byUser })
export const messageLimiter = limiter(15 * MIN, 60, 'You’re sending messages too fast. Wait a moment.', { keyGenerator: byUser })
export const adminLimiter = limiter(15 * MIN, 300, 'Too many admin requests.', { keyGenerator: byUser })

// Kept for backwards compatibility with any import of the old name.
export const reportLimiter = aiLimiter

// Freelance: proposals per freelancer per day.
export const proposalLimiter = limiter(24 * HOUR, 25, 'You’ve sent a lot of proposals today. Try again tomorrow.', { keyGenerator: byUser })

// Billing: manual payment submissions per user per day.
export const paymentLimiter = limiter(24 * HOUR, 6, 'Too many payment submissions today. We’ll review the ones you sent.', { keyGenerator: byUser })
