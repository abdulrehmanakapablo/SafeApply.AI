// ============================================================
// FILE: apps/backend/src/config/sentry.ts
// PURPOSE: Initializes Sentry error monitoring
// Only active in production with a valid DSN
// Safe to leave DSN empty during development
// ============================================================

import { env } from './env'

export function initSentry(): void {
  // Only initialize if DSN is configured and we are in production
  if (!env.sentryDsn || env.isDev) {
    console.log('ℹ️  Sentry disabled in development')
    return
  }

  // Dynamically import Sentry to avoid errors if not installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node')
    Sentry.init({
      dsn: env.sentryDsn,
      environment: env.nodeEnv,
      tracesSampleRate: 0.1, // Sample 10% of transactions
    })
    console.log('✅ Sentry initialized')
  } catch {
    console.warn('⚠️  Sentry package not found — error monitoring disabled')
  }
}