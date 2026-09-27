// ============================================================
// FILE: apps/backend/src/services/github.service.ts
// PURPOSE: Checks company GitHub presence and tech stack
// Compares technologies in public repos vs JD claims
// Uses GitHub API — 5000 requests/hour authenticated
// ============================================================

import axios from 'axios'
import { env } from '../config/env'
import { getCached, setCached, CACHE_TTL } from './cache.service'

interface GitHubResult {
  org_found: boolean
  public_repos: number
  last_commit: string | null
  languages: string[]
  source_url: string
}

export async function fetchGitHubData(companyName: string): Promise<GitHubResult> {
  const defaultResult: GitHubResult = {
    org_found: false,
    public_repos: 0,
    last_commit: null,
    languages: [],
    source_url: `https://github.com/${encodeURIComponent(companyName)}`,
  }

  if (!env.githubToken) return defaultResult

  // Check cache first
  const cached = await getCached<GitHubResult>('github', companyName)
  if (cached) return cached

  const headers = {
    Authorization: `Bearer ${env.githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  }

  try {
    // Search for organization matching company name
    const searchResponse = await axios.get(
      'https://api.github.com/search/users',
      {
        params: { q: `${companyName} type:org`, per_page: 1 },
        headers,
        timeout: 8000,
      }
    )

    const org = searchResponse.data.items?.[0]
    if (!org) {
      await setCached('github', companyName, defaultResult, CACHE_TTL.GITHUB)
      return defaultResult
    }

    // Fetch org repos to get languages and last commit
    const reposResponse = await axios.get(
      `https://api.github.com/orgs/${org.login}/repos`,
      {
        params: { sort: 'pushed', per_page: 10 },
        headers,
        timeout: 8000,
      }
    )

    const repos = reposResponse.data || []

    // Collect all languages used across repos
    const languageSet = new Set<string>()
    let lastCommit: string | null = null

    for (const repo of repos) {
      if (repo.language) languageSet.add(repo.language)
      if (repo.pushed_at && (!lastCommit || repo.pushed_at > lastCommit)) {
        lastCommit = repo.pushed_at
      }
    }

    const result: GitHubResult = {
      org_found: true,
      public_repos: org.public_repos || repos.length,
      last_commit: lastCommit,
      languages: Array.from(languageSet),
      source_url: `https://github.com/${org.login}`,
    }

    await setCached('github', companyName, result, CACHE_TTL.GITHUB)
    return result
  } catch (error) {
    console.error('GitHub API error:', error)
    return defaultResult
  }
}