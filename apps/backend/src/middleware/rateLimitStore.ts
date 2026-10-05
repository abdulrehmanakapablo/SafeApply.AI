// ============================================================
// FILE: apps/backend/src/middleware/rateLimitStore.ts
// PURPOSE: Shared rate-limit counters in Upstash Redis (REST), so limits
//          hold across serverless instances (Vercel runs many copies).
//   • One atomic EVAL per check (INCR + first-hit PEXPIRE + PTTL), so each
//     request costs a single Upstash command.
//   • Keys are HMAC-hashed: no emails or IPs are stored in Redis.
//   • If Redis is unset or unreachable, counting falls back to this
//     instance's memory, so limits weaken instead of failing open entirely
//     or blocking everyone. After a failure, Redis is skipped for 30 s so a
//     flaky connection can't split one counter between Redis and memory.
// ============================================================

import { createHmac } from 'crypto'
import { MemoryStore, type IncrementResponse, type Options, type Store } from 'express-rate-limit'
import { env } from '../config/env'

const SCRIPT =
  "local c = redis.call('INCR', KEYS[1]) " +
  "if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end " +
  "return {c, redis.call('PTTL', KEYS[1])}"

const RETRY_AFTER_MS = 30_000
let redisDownUntil = 0

async function upstash(command: (string | number)[]): Promise<unknown> {
  if (Date.now() < redisDownUntil) throw new Error('redis cooling down')
  const res = await fetch(env.redisUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(2500),
  })
  const data = (await res.json()) as { result?: unknown; error?: string }
  if (!res.ok || data.error) throw new Error(data.error || `upstash ${res.status}`)
  return data.result
}

/** Calls Upstash; on any failure, pauses Redis use so counting stays in one place. */
async function upstashOrCool(command: (string | number)[]): Promise<unknown> {
  try {
    return await upstash(command)
  } catch (e) {
    if (!(e instanceof Error && e.message === 'redis cooling down')) redisDownUntil = Date.now() + RETRY_AFTER_MS
    throw e
  }
}

/** Test helper: forget a previous outage. */
export function resetRedisCooldown(): void {
  redisDownUntil = 0
}

export const sharedStoreAvailable = (): boolean => Boolean(env.redisUrl && env.redisToken)

export class UpstashStore implements Store {
  private windowMs = 60_000
  private readonly fallback = new MemoryStore()
  private warned = false

  // Not named `prefix`: express-rate-limit's Store interface reserves that (public) name.
  constructor(private readonly namespace: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs
    this.fallback.init(options)
  }

  private key(k: string): string {
    return `rl:${this.namespace}:${createHmac('sha256', env.ipHashSecret).update(k).digest('hex').slice(0, 32)}`
  }

  private warn(e: unknown): void {
    if (this.warned) return
    this.warned = true
    console.warn('[rate-limit] Redis unavailable, using per-instance memory:', e instanceof Error ? e.message : e)
  }

  async increment(key: string): Promise<IncrementResponse> {
    try {
      const [hits, ttl] = (await upstashOrCool(['EVAL', SCRIPT, 1, this.key(key), this.windowMs])) as [number, number]
      return { totalHits: Number(hits), resetTime: new Date(Date.now() + (Number(ttl) > 0 ? Number(ttl) : this.windowMs)) }
    } catch (e) {
      this.warn(e)
      return this.fallback.increment(key)
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await upstashOrCool(['DECR', this.key(key)])
    } catch {
      await this.fallback.decrement(key)
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await upstashOrCool(['DEL', this.key(key)])
    } catch {
      await this.fallback.resetKey(key)
    }
  }
}
