// ============================================================
// FILE: apps/backend/src/jobs/trust.jobs.ts
// Levels + badges hourly; freeze last month's leaderboards (idempotent).
// ============================================================

import { supabaseAdmin } from '../config/supabase'
import type { Task } from './scheduler'

const HOUR = 3_600_000
const rpc = (fn: string) => async () => {
  const { error } = await supabaseAdmin.rpc(fn)
  if (error) throw new Error(error.message)
}

export const trustTasks: Task[] = [
  { name: 'trust.refresh', everyMs: HOUR, run: rpc('refresh_trust') },
  { name: 'trust.leaderboards', everyMs: 6 * HOUR, run: rpc('snapshot_leaderboards') },
]
