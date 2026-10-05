// Runs before every test file. src/config/env.ts exits the process when these
// are missing or weak, so they must exist before any src import.
process.env.SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_ANON_KEY = 'anon-test-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key'
process.env.JWT_SECRET = 'a'.repeat(40)
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40)
process.env.PORT = '0'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.NODE_ENV = 'test'

// Never let tests reach real services. env.ts calls dotenv.config(), which
// only fills variables that are NOT already set, so blanking them here keeps
// the developer's real .env (Redis, AI, search, email keys) out of tests.
for (const key of [
  'REDIS_URL',
  'REDIS_TOKEN',
  'GROQ_API_KEY',
  'SERP_API_KEY',
  'NEWS_API_KEY',
  'GITHUB_TOKEN',
  'GLASSDOOR_API_KEY',
  'SENTRY_DSN',
  'RESEND_API_KEY',
  'RESEND_KEY',
  'EMAIL_ENABLED',
  'CRON_SECRET',
]) {
  process.env[key] = ''
}
