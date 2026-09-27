// ============================================================
// FILE: apps/backend/src/services/news.service.ts
// PURPOSE: Fetches company news via NewsAPI
// Returns last 30 days of news articles for a company
// Results cached for 6 hours to preserve free tier quota
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

// NewsAPI free tier only allows a rolling 30-day window.
// Anything older returns 426 Upgrade Required.
// https://newsapi.org/pricing
const MAX_LOOKBACK_DAYS = 30

export async function fetchCompanyNews(companyName: string): Promise<NewsResult> {
  // Return empty result if NewsAPI not configured
  if (!env.newsApiKey) {
    return { articles: [], source_url: 'https://newsapi.org' }
  }

  // Check cache first
  const cached = await getCached<NewsResult>('news', companyName)
  if (cached) return cached

  try {
    // Clamp to 30 days — NewsAPI free tier hard limit
    const from = new Date(
      Date.now() - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split('T')[0]

    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `"${companyName}"`,
        from,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 10,
        apiKey: env.newsApiKey,
      },
      timeout: 8000,
    })

    const articles: NewsArticle[] = (response.data.articles || [])
      .filter((a: Record<string, unknown>) => a.title && a.url)
      .map((a: Record<string, unknown>) => ({
        title: a.title as string,
        source: (a.source as Record<string, string>)?.name || 'Unknown',
        published_at: a.publishedAt as string,
        url: a.url as string,
      }))

    const result: NewsResult = {
      articles,
      source_url: `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}`,
    }

    // Cache the result
    await setCached('news', companyName, result, CACHE_TTL.NEWS)

    return result
  } catch (error) {
    console.error('NewsAPI error:', error)
    return { articles: [], source_url: 'https://newsapi.org' }
  }
}