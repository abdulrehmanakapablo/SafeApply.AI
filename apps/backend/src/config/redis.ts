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
      console.warn('⚠️  Redis not configured — caching disabled')
    }
  }

  // Get a cached value by key
  // Returns null if not found or Redis unavailable
  async get(key: string): Promise<string | null> {
    if (!this.available) return null

    try {
      const response = await fetch(`${this.url}/get/${key}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      const data = await response.json()
      return data.result
    } catch {
      // Never crash the app because Redis failed
      return null
    }
  }

  // Set a value with optional expiry in seconds
  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (!this.available) return

    try {
      const url = exSeconds
        ? `${this.url}/set/${key}/${encodeURIComponent(value)}/ex/${exSeconds}`
        : `${this.url}/set/${key}/${encodeURIComponent(value)}`

      await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch {
      // Silently fail — caching is best effort
    }
  }

  // Delete a cached value
  async del(key: string): Promise<void> {
    if (!this.available) return

    try {
      await fetch(`${this.url}/del/${key}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch {
      // Silently fail
    }
  }
}

// Export single instance — reused across all services
export const redis = new RedisClient()