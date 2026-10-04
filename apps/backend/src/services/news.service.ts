// ============================================================
// FILE: apps/backend/src/services/news.service.ts
// PURPOSE: Fetch company news via NewsAPI. Free tier allows a rolling
//          30-day window only — older requests return 426.
// Results cached 6h to preserve the free quota.
// ============================================================

import axios from 'axios'
import { env } from '../config/env'
import { getCached, setCached, CACHE_TTL } from './cache.service'

interface NewsArticle {
  title: string
  source: string
  published_at: string
  url: string
}

interface NewsResult {
  articles: NewsArticle[]
  source_url: string
}

const MAX_LOOKBACK_DAYS = 30
const MAX_ARTICLES = 8

export async function fetchCompanyNews(companyName: string): Promise<NewsResult> {
  const empty: NewsResult = { articles: [], source_url: 'https://newsapi.org' }

  if (!env.newsApiKey || !companyName?.trim()) return empty

  const cacheKey = companyName.trim()
  const cached = await getCached<NewsResult>('news', cacheKey)
  if (cached) return cached

  try {
    const from = new Date(Date.now() - MAX_LOOKBACK_DAYS * 86_400_000)
      .toISOString()
      .split('T')[0]

    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `"${companyName}"`,
        from,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: MAX_ARTICLES,
        apiKey: env.newsApiKey,
      },
      timeout: 10000,
    })

    const articles: NewsArticle[] = (res.data?.articles || [])
      .filter((a: { title?: string; url?: string }) => a.title && a.url)
      .map((a: { title: string; source?: { name?: string }; publishedAt: string; url: string }) => ({
        title: a.title,
        source: a.source?.name || 'Unknown',
        published_at: new Date(a.publishedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        url: a.url,
      }))

    const result: NewsResult = {
      articles,
      source_url: `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}`,
    }

    await setCached('news', cacheKey, result, CACHE_TTL.NEWS)
    return result
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      if (status === 426) {
        console.warn('[news] free-tier window exceeded for', companyName)
      } else if (status === 429) {
        console.warn('[news] rate limited')
      }
    }
    return empty
  }
}