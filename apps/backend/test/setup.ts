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
