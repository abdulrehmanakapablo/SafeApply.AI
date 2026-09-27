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

// Derive result types from the actual service functions.
// If a service changes its return shape, these update automatically.
type ExtractJDResult = Awaited<ReturnType<typeof extractJDData>>
type NewsResult = Awaited<ReturnType<typeof fetchCompanyNews>>
type GitHubResult = Awaited<ReturnType<typeof fetchGitHubData>>
type GhostPostingResult = Awaited<ReturnType<typeof detectGhostPosting>>
type GlassdoorResult = Awaited<ReturnType<typeof fetchGlassdoorData>>

interface ReportJob {
  companyName: string
  jobTitle?: string
  jdText?: string
}

interface ReportResult {
  extracted_jd: ExtractJDResult
  news: NewsResult
  github: GitHubResult
  ghost_posting: GhostPostingResult
  glassdoor: GlassdoorResult
}

// ─── Safe empty results ───────────────────────────────────
// Used when a service call rejects. Each matches the full shape
// of the corresponding service's success return value.

const EMPTY_NEWS: NewsResult = {
  articles: [],
  source_url: '',
}

const EMPTY_GITHUB: GitHubResult = {
  org_found: false,
  public_repos: 0,
  languages: [],
  last_commit: null,
  source_url: '',
}

const EMPTY_GHOST_POSTING: GhostPostingResult = {
  postings: [],
  source_url: '',
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
      : Promise.resolve(EMPTY_GHOST_POSTING),
    fetchGlassdoorData(companyName),
  ])

  // Extract values from settled promises — safe fallback if any failed
  return {
    extracted_jd:
      extractedJD.status === 'fulfilled' ? extractedJD.value : null,
    news: newsResult.status === 'fulfilled' ? newsResult.value : EMPTY_NEWS,
    github:
      githubResult.status === 'fulfilled' ? githubResult.value : EMPTY_GITHUB,
    ghost_posting:
      ghostPostingResult.status === 'fulfilled'
        ? ghostPostingResult.value
        : EMPTY_GHOST_POSTING,
    glassdoor:
      glassdoorResult.status === 'fulfilled' ? glassdoorResult.value : null,
  }
}