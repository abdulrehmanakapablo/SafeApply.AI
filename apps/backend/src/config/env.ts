// ============================================================
// FILE: apps/backend/src/config/env.ts
// PURPOSE: Load + validate environment at boot. The app refuses to start
//          with missing or weak secrets rather than run insecurely.
// ============================================================

import * as dotenv from 'dotenv'
dotenv.config()

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PORT',
  'FRONTEND_URL',
  'NODE_ENV',
]

const missingVars = REQUIRED_VARS.filter((key) => !process.env[key])
if (missingVars.length > 0) {
  console.error('Missing required environment variables:')
  missingVars.forEach((key) => console.error(`   - ${key}`))
  process.exit(1)
}

const jwtSecret = process.env.JWT_SECRET as string
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET as string

// HS256 secrets shorter than 32 bytes can be brute-forced offline from any
// captured token. Two different secrets so an access token can never be
// replayed as a refresh token (or the reverse).
if (jwtSecret.length < 32 || jwtRefreshSecret.length < 32) {
  console.error('JWT_SECRET and JWT_REFRESH_SECRET must each be at least 32 characters.')
  process.exit(1)
}
if (jwtSecret === jwtRefreshSecret) {
  console.error('JWT_SECRET and JWT_REFRESH_SECRET must be different.')
  process.exit(1)
}

const nodeEnv = process.env.NODE_ENV as string

// Number of reverse proxies in front of the app (Render/Railway/Fly/Heroku = 1,
// Cloudflare + host = 2). Required so req.ip is the real client and not the
// proxy, and so X-Forwarded-For can't be spoofed to dodge rate limits.
const trustProxy = Math.max(0, Math.min(5, parseInt(process.env.TRUST_PROXY || (nodeEnv === 'production' ? '1' : '0'), 10) || 0))

// One or more allowed browser origins, comma separated.
const frontendOrigins = (process.env.FRONTEND_URL as string)
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean)

export const env = {
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY as string,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  jwtSecret,
  jwtRefreshSecret,
  groqApiKey: process.env.GROQ_API_KEY || '',
  newsApiKey: process.env.NEWS_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  serpApiKey: process.env.SERP_API_KEY || '',
  glassdoorApiKey: process.env.GLASSDOOR_API_KEY || '',
  redisUrl: process.env.REDIS_URL || '',
  redisToken: process.env.REDIS_TOKEN || '',
  sentryDsn: process.env.SENTRY_DSN || '',
  // Used to hash client IPs before they are stored anywhere (Redis keys).
  ipHashSecret: process.env.IP_HASH_SECRET || jwtRefreshSecret,
  trustProxy,
  // Email (Resend). Without a key, emails are skipped and logged.
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'SafeApply <no-reply@safeapply.ai>',
  // Where local customers send money. Shown on the manual payment page.
  payAccounts: {
    jazzcash: { number: process.env.PAY_JAZZCASH_NUMBER || '', name: process.env.PAY_JAZZCASH_NAME || '' },
    easypaisa: { number: process.env.PAY_EASYPAISA_NUMBER || '', name: process.env.PAY_EASYPAISA_NAME || '' },
    bank: { bank: process.env.PAY_BANK_NAME || '', title: process.env.PAY_BANK_TITLE || '', iban: process.env.PAY_BANK_IBAN || '' },
  },
  // Background jobs (renewal reminders, scores). Off for extra instances.
  runScheduler: process.env.RUN_SCHEDULER !== 'false',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: frontendOrigins[0],
  frontendOrigins,
  nodeEnv,
  isDev: nodeEnv === 'development',
  isProd: nodeEnv === 'production',
}
