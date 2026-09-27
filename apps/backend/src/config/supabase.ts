// ============================================================
// FILE: apps/backend/src/config/supabase.ts
// PURPOSE: Initializes two Supabase clients
// 1. anonClient — respects RLS, used for user-scoped queries
// 2. adminClient — bypasses RLS, used only for admin operations
// NEVER send adminClient to frontend or expose service role key
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Standard client — respects Row Level Security
// Use this for all regular user operations
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Admin client — bypasses Row Level Security
// ONLY use this in admin routes and server-side operations
// NEVER expose this client or the service role key to frontend
export const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)