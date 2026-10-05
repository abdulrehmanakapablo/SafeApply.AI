// ============================================================
// FILE: apps/backend/src/utils/passwordCheck.ts
// PURPOSE: Check a password against Supabase Auth without touching the
//          shared clients.
// SECURITY: Never call signInWithPassword on supabaseAdmin. A sign-in saves
//           the user's session on that client, and supabase-js then sends
//           the user's JWT instead of the service key on every later query
//           from every request. With RLS on and grants revoked, that breaks
//           the whole backend until restart. Each check gets its own
//           short-lived anon client instead.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env'

export async function verifySupabasePassword(email: string, password: string): Promise<boolean> {
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  return !error && !!data.user
}
