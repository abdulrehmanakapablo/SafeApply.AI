// ============================================================
// FILE: apps/backend/src/jobs/scheduler.ts
// PURPOSE: Background jobs. Every task is idempotent (safe to run twice or
//          on two instances), so a missed or doubled tick never corrupts data.
//   • Long-running server: startScheduler() runs them on timers.
//     Disable with RUN_SCHEDULER=false.
//   • Serverless (Vercel): runDueTasks() is called by /api/cron on a fixed
//     beat and runs whichever tasks are due in the current time slot.
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

export interface TaskResult {
  name: string
  ok: boolean
  ms: number
  error?: string
}

/**
 * Runs the tasks due in the current window. A task is due when the current
 * time falls in the first `beatMs` of one of its periods, so a cron beat of
 * 15 minutes runs a 30-minute task twice an hour and a 6-hour task four
 * times a day. `all` runs everything (the daily safety-net call).
 */
export async function runDueTasks(beatMs: number, all = false, now = Date.now()): Promise<TaskResult[]> {
  const due = tasks.filter((t) => all || now % t.everyMs < beatMs)
  const out: TaskResult[] = []
  for (const t of due) {
    const start = Date.now()
    try {
      await t.run()
      out.push({ name: t.name, ok: true, ms: Date.now() - start })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error(`[job:${t.name}]`, error)
      out.push({ name: t.name, ok: false, ms: Date.now() - start, error: error.slice(0, 200) })
    }
  }
  return out
}
