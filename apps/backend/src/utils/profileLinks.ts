// ============================================================
// FILE: apps/backend/src/utils/profileLinks.ts
// PURPOSE: Normalise and validate contact details collected at signup.
//   phone      → E.164 ("+923001234567"): a plus and 8–15 digits.
//   github     → canonical "https://github.com/<user>" from a username,
//                "github.com/user" or a full URL. Nothing else on GitHub.
//   portfolio  → https only, no login details in the URL, no localhost
//                or raw IP hosts, no fragment. Stored, never fetched.
// Each returns the clean value, or null when the input is invalid.
// ============================================================

const GH_USER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
// Paths that look like usernames but are GitHub pages, not profiles.
const GH_RESERVED = new Set(['about', 'apps', 'collections', 'contact', 'enterprise', 'explore', 'features', 'issues', 'join', 'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs', 'organizations', 'pricing', 'pulls', 'search', 'security', 'settings', 'sponsors', 'topics', 'trending'])

export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!/^\+[\d\s-]+$/.test(s)) return null
  const digits = s.slice(1).replace(/[\s-]/g, '')
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null
  return `+${digits}`
}

export function normalizeGithub(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let s = raw.trim()
  if (!s || s.length > 200) return null
  s = s.replace(/^@/, '')
  if (!s.includes('/')) return GH_USER.test(s) && !GH_RESERVED.has(s.toLowerCase()) ? `https://github.com/${s}` : null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  if (host !== 'github.com' && host !== 'www.github.com') return null
  if (u.username || u.password || u.port) return null
  const parts = u.pathname.split('/').filter(Boolean)
  if (parts.length !== 1) return null
  const user = parts[0]
  return GH_USER.test(user) && !GH_RESERVED.has(user.toLowerCase()) ? `https://github.com/${user}` : null
}

export function normalizePortfolio(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.length > 300) return null
  let u: URL
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const host = u.hostname.toLowerCase()
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost') return null
  // Raw IPv4 or IPv6 literals are not portfolio sites.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return null
  if (!/^[a-z0-9.-]+$/.test(host)) return null
  u.hash = ''
  const out = u.toString()
  return out.length <= 300 ? out : null
}
