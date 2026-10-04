// ============================================================
// FILE: apps/backend/src/services/github.service.ts
// PURPOSE: Verify a company's real tech stack by inspecting their
//          public GitHub org/user accounts.
// Returns { org_found, public_repos, last_commit, languages, source_url }
// ============================================================

import axios from 'axios'
import { env } from '../config/env'

interface GitHubData {
  org_found: boolean
  public_repos: number
  last_commit: string | null
  languages: string[]
  source_url: string
}

const EMPTY: GitHubData = {
  org_found: false,
  public_repos: 0,
  last_commit: null,
  languages: [],
  source_url: 'https://github.com',
}

const MAX_REPOS_TO_SCAN = 10
const MAX_LANGUAGES = 12

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SafeApply.AI',
  }
  if (env.githubToken) h.Authorization = `Bearer ${env.githubToken}`
  return h
}

function slugifyCompany(name: string): string {
  // "Stripe Inc." → "stripe", "Acme Corp" → "acme"
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function relativeTime(isoDate: string): string {
  const then = new Date(isoDate).getTime()
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? '' : 's'} ago`
}

/**
 * Resolve a company slug into a GitHub owner (org first, then user).
 * Returns { owner, type } or null if neither exists.
 */
async function resolveOwner(slug: string): Promise<{ owner: string; type: 'org' | 'user' } | null> {
  const headers = authHeaders()

  // Try org first
  try {
    const res = await axios.get(`https://api.github.com/orgs/${slug}`, {
      headers,
      timeout: 8000,
    })
    if (res.status === 200 && res.data?.login) {
      return { owner: res.data.login as string, type: 'org' }
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status !== 404) {
      console.warn('[github] org lookup error:', err.response?.status)
    }
  }

  // Fall back to user
  try {
    const res = await axios.get(`https://api.github.com/users/${slug}`, {
      headers,
      timeout: 8000,
    })
    if (res.status === 200 && res.data?.login) {
      return { owner: res.data.login as string, type: 'user' }
    }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status !== 404) {
      console.warn('[github] user lookup error:', err.response?.status)
    }
  }

  return null
}

/**
 * Fetch a single repo's language breakdown (bytes per language).
 * Returns {} on failure.
 */
async function fetchRepoLanguages(
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/languages`,
      { headers: authHeaders(), timeout: 8000 },
    )
    return (res.data || {}) as Record<string, number>
  } catch {
    return {}
  }
}

/**
 * Fetch the most recent commit date for a repo.
 * Returns ISO string or null.
 */
async function fetchLastCommit(owner: string, repo: string): Promise<string | null> {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        headers: authHeaders(),
        params: { per_page: 1 },
        timeout: 8000,
      },
    )
    const commit = res.data?.[0]
    return commit?.commit?.committer?.date || commit?.commit?.author?.date || null
  } catch {
    return null
  }
}

export async function fetchGitHubData(companyName: string): Promise<GitHubData> {
  if (!companyName || !companyName.trim()) return EMPTY

  const slug = slugifyCompany(companyName)
  if (slug.length < 2) return EMPTY

  const resolved = await resolveOwner(slug)
  if (!resolved) return EMPTY

  const { owner, type } = resolved
  const source_url = `https://github.com/${owner}`

  // Fetch repos, sorted by stars so we scan the important ones
  let repos: Array<{ name: string; stargazers_count: number; fork: boolean; archived: boolean }> = []
  try {
    const endpoint =
      type === 'org'
        ? `https://api.github.com/orgs/${owner}/repos`
        : `https://api.github.com/users/${owner}/repos`

    const res = await axios.get(endpoint, {
      headers: authHeaders(),
      params: { per_page: 30, sort: 'updated', type: 'public' },
      timeout: 10000,
    })

    repos = (res.data || [])
      .filter((r: { fork?: boolean; archived?: boolean }) => !r.fork && !r.archived)
      .sort(
        (a: { stargazers_count?: number }, b: { stargazers_count?: number }) =>
          (b.stargazers_count || 0) - (a.stargazers_count || 0),
      )
  } catch (err) {
    console.warn('[github] repos fetch failed:', err)
    return { ...EMPTY, org_found: true, source_url }
  }

  if (repos.length === 0) {
    return {
      org_found: true,
      public_repos: 0,
      last_commit: null,
      languages: [],
      source_url,
    }
  }

  // Scan top N repos in parallel — languages + last commit
  const topRepos = repos.slice(0, MAX_REPOS_TO_SCAN)
  const [langResults, commitDates] = await Promise.all([
    Promise.all(topRepos.map((r) => fetchRepoLanguages(owner, r.name))),
    Promise.all(topRepos.map((r) => fetchLastCommit(owner, r.name))),
  ])

  // Aggregate language bytes
  const langTotals: Record<string, number> = {}
  for (const breakdown of langResults) {
    for (const [lang, bytes] of Object.entries(breakdown)) {
      langTotals[lang] = (langTotals[lang] || 0) + (bytes as number)
    }
  }

  const languages = Object.entries(langTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_LANGUAGES)
    .map(([lang]) => lang)

  // Most recent commit across all scanned repos
  const validDates = commitDates.filter((d): d is string => Boolean(d))
  const latestISO = validDates.length
    ? validDates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
    : null

  return {
    org_found: true,
    public_repos: repos.length,
    last_commit: latestISO ? relativeTime(latestISO) : null,
    languages,
    source_url,
  }
}