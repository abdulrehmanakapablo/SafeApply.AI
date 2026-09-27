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

export const env = {
  supabaseUrl: process.env.SUPABASE_URL as string,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY as string,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,
  groqApiKey: process.env.GROQ_API_KEY || '',
  newsApiKey: process.env.NEWS_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  serpApiKey: process.env.SERP_API_KEY || '',
  glassdoorApiKey: process.env.GLASSDOOR_API_KEY || '',
  redisUrl: process.env.REDIS_URL || '',
  redisToken: process.env.REDIS_TOKEN || '',
  sentryDsn: process.env.SENTRY_DSN || '',
  // lemonSqueezyApiKey: process.env.LEMONSQUEEZY_API_KEY || '',
  // lemonSqueezyWebhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || '',
  // safepayApiKey: process.env.SAFEPAY_API_KEY || '',
  // safepayWebhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET || '',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL as string,
  nodeEnv: process.env.NODE_ENV as string,
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
}