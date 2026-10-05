// ============================================================
// FILE: apps/backend/src/middleware/rateLimitStore.ts
// PURPOSE: Shared rate-limit counters in Upstash Redis (REST), so limits
//          hold across serverless instances (Vercel runs many copies).
//   • One atomic EVAL per check (INCR + first-hit PEXPIRE + PTTL), so each
//     request costs a single Upstash command.
//   • Keys are HMAC-hashed: no emails or IPs are stored in Redis.
//   • If Redis is unset or unreachable, counting falls back to this
//     instance's memory, so limits weaken instead of failing open entirely
//     or blocking everyone.
// ============================================================

import { createHmac } from 'crypto'
import { MemoryStore, type IncrementResponse, type Options, type Store } from 'express-rate-limit'
import { env } from '../config/env'

const SCRIPT =
  "local c = redis.call('INCR', KEYS[1]) " +
  "if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end " +
  "return {c, redis.call('PTTL', KEYS[1])}"

async function upstash(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(env.redisUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(1500),
  })
  const data = (await res.json()) as { result?: unknown; error?: string }
  if (!res.ok || data.error) throw new Error(data.error || `upstash ${res.status}`)
  return data.result
}

export const sharedStoreAvailable = (): boolean => Boolean(env.redisUrl && env.redisToken)

export class UpstashStore implements Store {
  private windowMs = 60_000
  private readonly fallback = new MemoryStore()
  private warned = false

  constructor(private readonly prefix: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs
    this.fallback.init(options)
  }

  private key(k: string): string {
    return `rl:${this.prefix}:${createHmac('sha256', env.ipHashSecret).update(k).digest('hex').slice(0, 32)}`
  }

  private warn(e: unknown): void {
    if (this.warned) return
    this.warned = true
    console.warn('[rate-limit] Redis unavailable, using per-instance memory:', e instanceof Error ? e.message : e)
  }

  async increment(key: string): Promise<IncrementResponse> {
    try {
      const [hits, ttl] = (await upstash(['EVAL', SCRIPT, 1, this.key(key), this.windowMs])) as [number, number]
      return { totalHits: Number(hits), resetTime: new Date(Date.now() + (Number(ttl) > 0 ? Number(ttl) : this.windowMs)) }
    } catch (e) {
      this.warn(e)
      return this.fallback.increment(key)
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await upstash(['DECR', this.key(key)])
    } catch {
      await this.fallback.decrement(key)
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await upstash(['DEL', this.key(key)])
    } catch {
      await this.fallback.resetKey(key)
    }
  }
}
