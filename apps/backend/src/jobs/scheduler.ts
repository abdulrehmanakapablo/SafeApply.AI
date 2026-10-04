// ============================================================
// FILE: apps/backend/src/jobs/scheduler.ts
// PURPOSE: In-process background jobs. Every task is idempotent (safe to
//          run twice or on two instances), so a missed or doubled tick
//          never corrupts data. Disable with RUN_SCHEDULER=false.
// ============================================================

import { env } from '../config/env'
import { billingTasks } from './billing.jobs'
import { accountabilityTasks } from './accountability.jobs'
import { interviewTasks } from './interviews.jobs'
import { trustTasks } from './trust.jobs'

export interface Task {
  name: string
  everyMs: number
  run: () => Promise<void>
}

const tasks: Task[] = [...billingTasks, ...accountabilityTasks, ...interviewTasks, ...trustTasks]

/** Later phases add their tasks here. */
export function registerTasks(more: Task[]): void {
  tasks.push(...more)
}

export function startScheduler(): void {
  if (!env.runScheduler) return
  for (const t of tasks) {
    let running = false
    const tick = async () => {
      if (running) return
      running = true
      try {
        await t.run()
      } catch (e) {
        console.error(`[job:${t.name}]`, e instanceof Error ? e.message : e)
      } finally {
        running = false
      }
    }
    // Stagger the first run so a cold start isn't a burst of queries.
    setTimeout(tick, 15_000 + Math.floor(Math.random() * 30_000)).unref()
    setInterval(tick, t.everyMs).unref()
  }
}
