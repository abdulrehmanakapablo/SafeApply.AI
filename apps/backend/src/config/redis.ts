// ============================================================
// FILE: apps/backend/src/config/redis.ts
// PURPOSE: Initializes Upstash Redis client for caching
// Upstash uses REST API not traditional Redis connection
// If Redis is not configured app works without caching
// ============================================================

import { env } from './env'

// Simple Redis client using Upstash REST API
// Works without installing ioredis — uses fetch under the hood
class RedisClient {
  private url: string
  private token: string
  private available: boolean

  constructor() {
    this.url = env.redisUrl
    this.token = env.redisToken
    // Redis is optional — mark as unavailable if not configured
    this.available = !!(this.url && this.token)

    if (!this.available) {
      console.warn('Redis not configured: caching and the guest demo limit are disabled')
    }
  }

  // Get a cached value by key
  // Returns null if not found or Redis unavailable
  async get(key: string): Promise<string | null> {
    if (!this.available) return null

    try {
      const response = await fetch(`${this.url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      const data = (await response.json()) as { result?: string | null }
      return data.result ?? null
    } catch {
      // Never crash the app because Redis failed
      return null
    }
  }

  // Set a value with optional expiry in seconds
  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (!this.available) return

    try {
      // Value goes in the POST body, not the URL: URLs end up in proxy and
      // provider logs, and long values break URL length limits.
      const url = exSeconds
        ? `${this.url}/set/${encodeURIComponent(key)}?EX=${Math.max(1, Math.floor(exSeconds))}`
        : `${this.url}/set/${encodeURIComponent(key)}`

      await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
        body: value,
      })
    } catch {
      // Silently fail — caching is best effort
    }
  }

  // Delete a cached value
  async del(key: string): Promise<void> {
    if (!this.available) return

    try {
      await fetch(`${this.url}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch {
      // Silently fail
    }
  }
}

// Export single instance — reused across all services
export const redis = new RedisClient()
