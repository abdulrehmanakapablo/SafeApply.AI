// ============================================================
// FILE: apps/backend/src/routes/cron.ts
// PURPOSE: Runs scheduled jobs on hosts without a long-running process.
//   GET /api/cron        → tasks due in the current beat (cron-job.org, every 15 min)
//   GET /api/cron?all=1  → every task (Vercel Cron, once a day, as a safety net)
// SECURITY: requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends
//   this header automatically when CRON_SECRET is set. Without CRON_SECRET
//   the endpoint is disabled (404), so it can never run unauthenticated.
// ============================================================

import { createHash, timingSafeEqual } from 'crypto'
import { Router, type Router as RouterType } from 'express'
import { env } from '../config/env'
import { runDueTasks } from '../jobs/scheduler'

const router: RouterType = Router()
const digest = (s: string) => createHash('sha256').update(s).digest()
let running = false

router.get('/', async (req, res) => {
  if (!env.cronSecret) {
    res.status(404).json({ success: false, error: 'Route not found' })
    return
  }
  const auth = req.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || !timingSafeEqual(digest(token), digest(env.cronSecret))) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  // One run at a time per instance; tasks are idempotent across instances.
  if (running) {
    res.status(202).json({ success: true, data: { skipped: 'already running' } })
    return
  }
  running = true
  try {
    const results = await runDueTasks(env.cronBeatMinutes * 60_000, req.query.all === '1')
    const failed = results.filter((r) => !r.ok).length
    res.status(failed ? 500 : 200).json({ success: failed === 0, data: { ran: results.length, failed, results } })
  } finally {
    running = false
  }
})

export default router
