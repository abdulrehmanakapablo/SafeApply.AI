// ============================================================
// FILE: apps/backend/src/utils/sanitize.ts
// PURPOSE: Input sanitization to prevent XSS attacks
// Strip all HTML tags from user provided strings
// Called before storing or processing any user input
// ============================================================

// Remove all HTML tags from a string
// Prevents XSS when content is rendered in the browser
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

// Sanitize an object's string values recursively
// Pass any request body through this before using
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj }

  for (const key in sanitized) {
    const value = sanitized[key]
    if (typeof value === 'string') {
      sanitized[key] = stripHtml(value) as T[typeof key]
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(
        value as Record<string, unknown>
      ) as T[typeof key]
    }
  }

  return sanitized
}

// Truncate string to max length — prevents oversized payloads
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input
  return input.slice(0, maxLength)
}