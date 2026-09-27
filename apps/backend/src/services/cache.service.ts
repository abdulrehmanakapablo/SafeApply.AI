// ============================================================
// FILE: apps/backend/src/services/cache.service.ts
// PURPOSE: Redis caching layer for external API responses
// Prevents hitting rate limits by caching results
// All cache misses fall through to the actual API call
// ============================================================

import { redis } from '../config/redis'

// Cache key prefix — keeps all safeapply keys organized
const PREFIX = 'safeapply'

// Cache durations in seconds
export const CACHE_TTL = {
  REPORT: 60 * 60 * 24,      // 24 hours — company data changes slowly
  NEWS: 60 * 60 * 6,          // 6 hours — news updates more frequently
  GITHUB: 60 * 60 * 12,       // 12 hours
  SERPAPI: 60 * 60 * 12,      // 12 hours
  CV_MATCH: 60 * 60,          // 1 hour
  ANALYTICS: 60 * 60,         // 1 hour
}

// Build a consistent cache key
function buildKey(resource: string, identifier: string): string {
  // Normalize identifier — lowercase, replace spaces with dashes
  const normalized = identifier.toLowerCase().replace(/\s+/g, '-')
  return `${PREFIX}:${resource}:${normalized}`
}

// Get cached JSON data — returns null if not found or Redis unavailable
export async function getCached<T>(
  resource: string,
  identifier: string
): Promise<T | null> {
  try {
    const key = buildKey(resource, identifier)
    const cached = await redis.get(key)
    if (!cached) return null
    return JSON.parse(decodeURIComponent(cached)) as T
  } catch {
    return null
  }
}

// Store JSON data in cache with TTL
export async function setCached<T>(
  resource: string,
  identifier: string,
  data: T,
  ttl: number
): Promise<void> {
  try {
    const key = buildKey(resource, identifier)
    await redis.set(key, encodeURIComponent(JSON.stringify(data)), ttl)
  } catch {
    // Silently fail — caching is best effort
  }
}

// Delete a cached entry — used when data needs to be refreshed
export async function deleteCached(
  resource: string,
  identifier: string
): Promise<void> {
  try {
    const key = buildKey(resource, identifier)
    await redis.del(key)
  } catch {
    // Silently fail
  }
}