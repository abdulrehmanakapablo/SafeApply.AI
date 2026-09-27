// ============================================================
// FILE: apps/backend/src/services/serpapi.service.ts
// PURPOSE: Ghost posting detection via Google Search
// Searches for how many times a role appeared publicly
// Uses SerpAPI free tier — 100 searches/month
// ============================================================

import axios from 'axios'
import { env } from '../config/env'
import { getCached, setCached, CACHE_TTL } from './cache.service'

interface GhostPosting {
  date: string
  platform: string
  url: string
}

interface GhostPostingResult {
  postings: GhostPosting[]
  source_url: string
}

export async function detectGhostPosting(
  companyName: string,
  jobTitle: string
): Promise<GhostPostingResult> {
  const cacheKey = `${companyName}-${jobTitle}`
  const sourceUrl = `https://www.google.com/search?q="${encodeURIComponent(companyName)}"+"${encodeURIComponent(jobTitle)}"`

  const defaultResult: GhostPostingResult = {
    postings: [],
    source_url: sourceUrl,
  }

  if (!env.serpApiKey) return defaultResult

  // Check cache first
  const cached = await getCached<GhostPostingResult>('serpapi', cacheKey)
  if (cached) return cached

  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: `"${companyName}" "${jobTitle}" job`,
        api_key: env.serpApiKey,
        num: 10,
        tbs: 'qdr:y', // Last year results only
      },
      timeout: 10000,
    })

    const organicResults = response.data.organic_results || []

    // Extract job posting results with dates
    const postings: GhostPosting[] = organicResults
      .filter((r: Record<string, unknown>) => r.link && r.date)
      .map((r: Record<string, unknown>) => {
        // Determine platform from URL
        const url = r.link as string
        let platform = 'Unknown'
        if (url.includes('linkedin.com')) platform = 'LinkedIn'
        else if (url.includes('indeed.com')) platform = 'Indeed'
        else if (url.includes('glassdoor.com')) platform = 'Glassdoor'
        else if (url.includes('greenhouse.io')) platform = 'Greenhouse'
        else if (url.includes('lever.co')) platform = 'Lever'
        else if (url.includes('workday.com')) platform = 'Workday'

        return {
          date: r.date as string,
          platform,
          url,
        }
      })

    const result: GhostPostingResult = { postings, source_url: sourceUrl }
    await setCached('serpapi', cacheKey, result, CACHE_TTL.SERPAPI)
    return result
  } catch (error) {
    console.error('SerpAPI error:', error)
    return defaultResult
  }
}