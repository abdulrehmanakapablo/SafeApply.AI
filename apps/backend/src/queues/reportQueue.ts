// ============================================================
// FILE: apps/backend/src/queues/reportQueue.ts
// PURPOSE: BullMQ queue for processing company reports
// Runs all external API calls in parallel
// Prevents slow API calls from blocking the HTTP response
// ============================================================

// NOTE: BullMQ requires a real Redis connection (not Upstash REST)
// For simplicity we process reports synchronously for now
// TODO: Switch to BullMQ when Redis connection is available

import { fetchCompanyNews } from '../services/news.service'
import { fetchGitHubData } from '../services/github.service'
import { detectGhostPosting } from '../services/serpapi.service'
import { fetchGlassdoorData } from '../services/glassdoor.service'
import { extractJDData } from '../services/groq.service'

interface ReportJob {
  companyName: string
  jobTitle?: string
  jdText?: string
}

interface ReportResult {
  extracted_jd: Record<string, unknown> | null
  news: Record<string, unknown>
  github: Record<string, unknown>
  ghost_posting: Record<string, unknown>
  glassdoor: Record<string, unknown> | null
}

// Process a company report — runs all API calls in parallel
// Promise.allSettled ensures one failure never blocks others
export async function processReport(job: ReportJob): Promise<ReportResult> {
  const { companyName, jobTitle, jdText } = job

  // Run all API calls simultaneously — much faster than sequential
  const [
    extractedJD,
    newsResult,
    githubResult,
    ghostPostingResult,
    glassdoorResult,
  ] = await Promise.allSettled([
    jdText ? extractJDData(jdText) : Promise.resolve(null),
    fetchCompanyNews(companyName),
    fetchGitHubData(companyName),
    jobTitle
      ? detectGhostPosting(companyName, jobTitle)
      : Promise.resolve({ postings: [], source_url: '' }),
    fetchGlassdoorData(companyName),
  ])

  // Extract values from settled promises — null if any failed
  return {
    extracted_jd:
      extractedJD.status === 'fulfilled' ? extractedJD.value : null,
    news:
      newsResult.status === 'fulfilled'
        ? newsResult.value
        : { articles: [], source_url: '' },
    github:
      githubResult.status === 'fulfilled'
        ? githubResult.value
        : { org_found: false, languages: [] },
    ghost_posting:
      ghostPostingResult.status === 'fulfilled'
        ? ghostPostingResult.value
        : { postings: [], source_url: '' },
    glassdoor:
      glassdoorResult.status === 'fulfilled' ? glassdoorResult.value : null,
  }
}