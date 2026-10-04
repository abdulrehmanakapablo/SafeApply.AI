// ============================================================
// FILE: apps/backend/src/utils/sanitize.ts
// PURPOSE: Defence-in-depth input cleaning. React already escapes output,
//          so this strips markup and control characters before anything is
//          stored, and blocks prototype-pollution keys.
// ============================================================

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
// C0 control chars except tab/newline/carriage return, plus bidi overrides
// used to disguise text (e.g. "‮" tricks in names).
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g

export function stripHtml(input: string): string {
  return input
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(CONTROL_RE, '')
    .trim()
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T, depth = 0): T {
  if (depth > 8 || !obj || typeof obj !== 'object') return obj
  const out: Record<string, unknown> = Array.isArray(obj) ? ([] as unknown as Record<string, unknown>) : {}
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) continue
    const value = (obj as Record<string, unknown>)[key]
    if (typeof value === 'string') out[key] = stripHtml(value)
    else if (value && typeof value === 'object') out[key] = sanitizeObject(value as Record<string, unknown>, depth + 1)
    else out[key] = value
  }
  return out as T
}

export function truncate(input: string, maxLength: number): string {
  return input.length <= maxLength ? input : input.slice(0, maxLength)
}

/** Text safe to drop inside a PostgREST filter string (.or / .ilike). */
export function safeSearchTerm(raw: unknown, max = 80): string {
  return String(raw ?? '')
    .replace(/[,()*%_\\:"'.]/g, ' ')
    .replace(CONTROL_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** Positive page number with a hard ceiling. */
export function pageParam(raw: unknown, max = 1000): number {
  const n = parseInt(String(raw ?? '1'), 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 1
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function uuidParam(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}
