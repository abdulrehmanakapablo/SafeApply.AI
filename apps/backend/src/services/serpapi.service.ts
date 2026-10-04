// ============================================================
// FILE: apps/backend/src/services/serpapi.service.ts
// PURPOSE: Detect ghost job postings by searching Google Jobs for
//          the same company+title across platforms.
// Returns { postings, source_url } where postings are dated occurrences.
// ============================================================

import { SEARCH_USD, budgetState, recordSpend } from '../utils/budget'
import axios from 'axios'
import { env } from '../config/env'

export interface GhostPosting {
  date: string
  platform: string
  url: string
}

export interface GhostPostingData {
  postings: GhostPosting[]
  source_url: string
}

const EMPTY: GhostPostingData = {
  postings: [],
  source_url: 'https://www.google.com/search?q=jobs',
}

interface SerpJobResult {
  title?: string
  company_name?: string
  location?: string
  detected_extensions?: {
    posted_at?: string
    schedule_type?: string
    work_from_home?: boolean
  }
  share_link?: string
  apply_options?: Array<{ title?: string; link?: string }>
  via?: string
}

export async function detectGhostPosting(
  companyName: string,
  jobTitle: string,
): Promise<GhostPostingData> {
  if (!env.serpApiKey || !companyName || !jobTitle) return EMPTY
  if ((await budgetState()).hardStopped) return EMPTY

  try {
    const query = `${jobTitle} ${companyName}`
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_jobs',
        q: query,
        hl: 'en',
        api_key: env.serpApiKey,
      },
      timeout: 12000,
    })
    void recordSpend('search', SEARCH_USD)

    const jobs: SerpJobResult[] = res.data?.jobs_results || []

    // Filter to jobs whose company_name roughly matches what we searched for
    const companyLower = companyName.toLowerCase().trim()
    const matched = jobs.filter((j) => {
      const c = (j.company_name || '').toLowerCase().trim()
      return c.includes(companyLower) || companyLower.includes(c)
    })

    const postings: GhostPosting[] = matched.slice(0, 8).map((j) => {
      const applyUrl =
        j.apply_options?.[0]?.link ||
        j.share_link ||
        `https://www.google.com/search?q=${encodeURIComponent(
          `${j.title || jobTitle} ${j.company_name || companyName}`,
        )}+jobs`

      return {
        date: j.detected_extensions?.posted_at || 'Recently',
        platform: j.via || j.apply_options?.[0]?.title || 'Google Jobs',
        url: applyUrl,
      }
    })

    return {
      postings,
      source_url: `https://www.google.com/search?q=${encodeURIComponent(
        `${jobTitle} ${companyName} jobs`,
      )}`,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 401 || status === 403) {
        console.warn('[serpapi] auth failed — check SERP_API_KEY')
      } else if (status === 429) {
        console.warn('[serpapi] rate limit hit (100 searches/month free tier)')
      } else {
        console.warn('[serpapi] request failed:', status)
      }
    } else {
      console.warn('[serpapi] unexpected error:', error)
    }
    return EMPTY
  }
}