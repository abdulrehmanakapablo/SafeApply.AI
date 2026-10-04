// ============================================================
// FILE: apps/backend/src/queues/reportQueue.ts
// PURPOSE: Run all external data source calls in parallel, merge into
//          a single report payload. Every source is best-effort —
//          any failure produces an empty fallback, never a 500.
// ============================================================

import { fetchCompanyNews } from '../services/news.service'
import { fetchGitHubData } from '../services/github.service'
import { detectGhostPosting } from '../services/serpapi.service'
import { extractJDData } from '../services/groq.service'

interface ReportJob {
  companyName: string
  jobTitle?: string
  jdText?: string
}

// `object` accepts the services' own interfaces (NewsResult, GitHubData,
// GhostPostingData) and the empty fallbacks, without index-signature errors.
interface ReportResult {
  extracted_jd: object | null
  news: object
  github: object
  ghost_posting: object
}

export async function processReport(job: ReportJob): Promise<ReportResult> {
  const { companyName, jobTitle, jdText } = job

  const [extractedJD, newsResult, githubResult, ghostResult] =
    await Promise.allSettled([
      jdText ? extractJDData(jdText) : Promise.resolve(null),
      fetchCompanyNews(companyName),
      fetchGitHubData(companyName),
      jobTitle
        ? detectGhostPosting(companyName, jobTitle)
        : Promise.resolve({ postings: [], source_url: '' }),
    ])

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
        : { org_found: false, public_repos: 0, languages: [], last_commit: null, source_url: '' },
    ghost_posting:
      ghostResult.status === 'fulfilled'
        ? ghostResult.value
        : { postings: [], source_url: '' },
  }
}
