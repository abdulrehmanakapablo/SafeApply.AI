// ============================================================
// FILE: apps/backend/src/middleware/rateLimiter.ts
// PURPOSE: Rate limiting to prevent DDoS and brute force attacks
// Different limits for different route sensitivities
// Returns 429 Too Many Requests when limit is exceeded
// ============================================================

import rateLimit from 'express-rate-limit'

// Global limiter — applied to ALL routes
// 100 requests per 15 minutes per IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
})

// Auth limiter — applied to login and signup only
// 5 attempts per 15 minutes per IP — prevents brute force
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many attempts. Please try again in 15 minutes.',
  },
})

// Forgot password limiter — 3 requests per hour per IP
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset requests. Please try again in an hour.',
  },
})

// Report limiter — 10 reports per hour per IP
// Pro limit enforced separately in planGate middleware
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Report limit reached. Please try again in an hour.',
  },
})