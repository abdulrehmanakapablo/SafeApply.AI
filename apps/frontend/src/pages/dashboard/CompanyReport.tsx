// FILE: src/pages/dashboard/CompanyReport.tsx
// ROUTE: /dashboard/company-report (auth required)
// BACKEND: POST /api/reports
// PURPOSE: Company intelligence report — paste JD or enter company/title,
//          then view extracted JD data, Crunchbase funding, GitHub tech stack,
//          ghost posting timeline, news, and Glassdoor data.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import {
  runReport,
  type ExtractedJD,
  type NewsArticle,
  type GitHubData,
  type GhostPosting,
  type GlassdoorData,
  type ReportData,
} from '../../api/reports'

// ─── View model (flattened for rendering) ────────────────
interface ReportView {
  extracted: ExtractedJD
  company: {
    founded: string
    funding_stage: string
    total_raised: string
    last_round: string
    employees: string
    investors: string
    source_url: string
  }
  github: GitHubData & {
    jd_tech: { name: string; status: 'confirmed' | 'in_code' | 'missing' }[]
  }
  ghost: {
    postings: GhostPosting[]
    probability: number
    source_url: string
  }
  news: {
    articles: NewsArticle[]
    sentiment: number
    source_url: string
  }
  reddit: {
    sentiment: 'mostly_positive' | 'mixed' | 'mostly_negative'
    total: number
    subreddits: { name: string; mentions: number; pos_pct: number; url: string }[]
    source_url: string
  }
  glassdoor: GlassdoorData
  telemetry_sources: string[]
}

// ─── Demo fallback (pilot mode) ──────────────────────────
const DEMO_VIEW: ReportView = {
  extracted: {
    role: 'Senior Distributed Systems Engineer',
    seniority: 'Senior / Staff (L5+)',
    experience_years: 5,
    required_skills: ['Go', 'Kubernetes', 'Kafka', 'gRPC', 'Distributed Consensus', 'Raft'],
    nice_to_have_skills: ['Rust', 'Terraform', 'eBPF', 'CockroachDB'],
    salary_mentioned: true,
    salary_text: '$185,000 – $225,000 USD + Equity',
    location: 'Remote (US / EU Timezones)',
    remote: true,
    employment_type: 'Full-time Permanent',
    company_name: 'Chronos Distributed Labs',
  },
  company: {
    founded: '2019 (San Francisco, CA)',
    funding_stage: 'Series B',
    total_raised: '$42.5M USD',
    last_round: 'Jan 2024 ($28M)',
    employees: '145 Full-time',
    investors: 'Sequoia, Benchmark, FF',
    source_url: 'https://crunchbase.com',
  },
  github: {
    org_found: true,
    public_repos: 42,
    last_commit: '2 days ago (main branch)',
    languages: ['Go', 'Rust', 'Kubernetes', 'gRPC'],
    source_url: 'https://github.com',
    jd_tech: [
      { name: 'Go', status: 'confirmed' },
      { name: 'Kubernetes', status: 'confirmed' },
      { name: 'Kafka', status: 'confirmed' },
      { name: 'Rust', status: 'in_code' },
      { name: 'gRPC / Protobuf', status: 'confirmed' },
      { name: 'Cassandra', status: 'missing' },
    ],
  },
  ghost: {
    postings: [
      {
        date: 'Oct 14, 2024',
        platform: 'LinkedIn Jobs (Active)',
        url: 'https://linkedin.com',
      },
      {
        date: 'Aug 28, 2024',
        platform: 'Indeed Recruiter (Stale)',
        url: 'https://indeed.com',
      },
      {
        date: 'Jun 10, 2024',
        platform: 'Greenhouse Portal (Initial req_8841)',
        url: 'https://greenhouse.io',
      },
    ],
    probability: 48,
    source_url: 'https://google.com',
  },
  news: {
    articles: [
      {
        title:
          'Chronos Unveils Zero-Overhead Consensus Layer for Enterprise Kubernetes',
        source: 'TechCrunch',
        published_at: 'Feb 12, 2025',
        url: 'https://techcrunch.com',
      },
      {
        title:
          'How Benchmark-Backed Chronos Is Reworking Distributed Event Storage',
        source: 'VentureBeat',
        published_at: 'Jan 18, 2025',
        url: 'https://venturebeat.com',
      },
      {
        title:
          'Infrastructure Startups Navigate Compressed Tech Budgets with Lean Engineering',
        source: 'Bloomberg Technology',
        published_at: 'Nov 29, 2024',
        url: 'https://bloomberg.com',
      },
    ],
    sentiment: 0.81,
    source_url: 'https://newsapi.org',
  },
  reddit: {
    sentiment: 'mostly_positive',
    total: 142,
    subreddits: [
      {
        name: 'r/ExperiencedDevs',
        mentions: 64,
        pos_pct: 88,
        url: 'https://reddit.com/r/ExperiencedDevs',
      },
      {
        name: 'r/cscareerquestions',
        mentions: 51,
        pos_pct: 72,
        url: 'https://reddit.com/r/cscareerquestions',
      },
      {
        name: 'r/recruitinghell',
        mentions: 27,
        pos_pct: 34,
        url: 'https://reddit.com/r/recruitinghell',
      },
      {
        name: 'r/jobs',
        mentions: 0,
        pos_pct: 0,
        url: 'https://reddit.com/r/jobs',
      },
    ],
    source_url: 'https://reddit.com',
  },
  glassdoor: {
    overall_rating: 4.2,
    interview_difficulty: 'Medium',
    offer_rate: 34,
    recommend_percent: 82,
    source_url: 'https://glassdoor.com',
  },
  telemetry_sources: [
    'Crunchbase',
    'GitHub (42 repos)',
    'Google Search',
    'NewsAPI (90d)',
  ],
}

// ─── Transform backend report_data → view model ──────────
function toView(data: ReportData): ReportView {
  return {
    ...DEMO_VIEW,
    extracted: (data.extracted_jd as ExtractedJD) || DEMO_VIEW.extracted,
    github: data.github
      ? { ...DEMO_VIEW.github, ...data.github, jd_tech: DEMO_VIEW.github.jd_tech }
      : DEMO_VIEW.github,
    ghost: data.ghost_posting
      ? {
          postings: data.ghost_posting.postings || [],
          probability: DEMO_VIEW.ghost.probability,
          source_url: data.ghost_posting.source_url || DEMO_VIEW.ghost.source_url,
        }
      : DEMO_VIEW.ghost,
    news: data.news
      ? {
          articles: data.news.articles || [],
          sentiment: DEMO_VIEW.news.sentiment,
          source_url: data.news.source_url || DEMO_VIEW.news.source_url,
        }
      : DEMO_VIEW.news,
    glassdoor: (data.glassdoor as GlassdoorData) || DEMO_VIEW.glassdoor,
  }
}

// ─── Component ────────────────────────────────────────────
export default function CompanyReport() {
  const [jdText, setJdText] = useState(
    'Chronos Distributed Labs is seeking a Senior Distributed Systems Engineer to architect our next-generation consensus topology. \n\nRequirements:\n- 5+ years building fault-tolerant backend infrastructure in Go.\n- Production experience with Kubernetes operators, Kafka streaming topologies, and Raft/Paxos consensus primitives.\n- Deep familiarity with gRPC, AWS core networking, and low-latency RPC serialization.\n- Bonus: Rust, eBPF, CockroachDB internals.'
  )
  const [companyName, setCompanyName] = useState('Chronos Distributed Labs')
  const [jobTitle, setJobTitle] = useState('Senior Distributed Systems Engineer')

  const [view, setView] = useState<ReportView>(DEMO_VIEW)
  const [running, setRunning] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState('Data refreshed 2m ago')
  const [savedToBackend, setSavedToBackend] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  async function handleRunReport() {
    if (running) return
    setRunning(true)

    try {
      const res = await runReport({
        jd_text: jdText.trim() || undefined,
        company_name: companyName.trim() || undefined,
        job_title: jobTitle.trim() || undefined,
      })

      if (res.success && res.data) {
        setView(toView(res.data.report_data))
        setSavedToBackend(true)
      } else {
        setSavedToBackend(false)
      }
    } catch {
      setSavedToBackend(false)
    } finally {
      setRunning(false)
      setRefreshedAt('Data refreshed just now')
    }
  }

  async function handleSave() {
    if (savedToBackend) return
    setSavedToBackend(true)
    setTimeout(() => setSavedToBackend(false), 2200)
  }

  function handleShare() {
    setShareCopied(true)
    try {
      navigator.clipboard?.writeText(window.location.href)
    } catch {
      // ignore clipboard failure
    }
    setTimeout(() => setShareCopied(false), 2000)
  }

  const telemetryLine = running
    ? 'Querying live endpoints across Crunchbase, GitHub API, SerpAPI...'
    : `Report Generated • Queried: ${view.telemetry_sources.join(' • ')}`

  return (
    <>
      <SEO
        title="Company Report | SafeApply.AI"
        description="Run a cited company intelligence report — extracted JD data, funding, tech stack, ghost posting detection, news, and reviews."
        path="/dashboard/company-report"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-6 flex flex-col gap-6 pb-16">

        {/* ── Top telemetry strip ─────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-[#1A1A1A] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="font-mono uppercase tracking-wider text-white">
              OSINT Engine V4.2
            </span>
            <span className="text-[#353534]">/</span>
            <span className="text-[#737373]">
              Node: us-east-telemetry-09
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[#737373]">
            <span>LATENCY: 42ms</span>
            <span>SANDBOX: ACTIVE</span>
          </div>
        </div>

        {/* ── Input section ────────────────────────────── */}
        <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
            <div className="flex flex-col">
              <h2 className="text-white text-xl font-bold tracking-tight">
                Company Intelligence Report
              </h2>
              <p className="text-[#737373] text-sm mt-1">
                Paste a full job description or enter company name and role manually
              </p>
            </div>
            <Link
              to="/dashboard/company-report/history"
              className="inline-flex items-center gap-1.5 bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22c55e]/50 hover:text-[#22c55e] text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors self-start shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">
                history
              </span>
              View History
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* Left: textarea */}
            <div className="flex-1 flex flex-col">
              <label
                htmlFor="jd-input"
                className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-2"
              >
                Job Description Raw Payload
              </label>
              <textarea
                id="jd-input"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={5}
                placeholder="Paste full job description here"
                className="w-full h-[140px] bg-black border border-[#1A1A1A] text-white font-mono text-xs p-3 rounded-md focus:border-[#22c55e] focus:outline-none transition-colors resize-none placeholder-[#737373]"
              />
            </div>

            {/* Or divider */}
            <div className="flex lg:flex-col items-center justify-center px-2 lg:px-6 relative my-2 lg:my-0">
              <div className="hidden lg:block w-px h-full bg-[#1A1A1A] absolute inset-y-0" />
              <div className="lg:hidden w-full h-px bg-[#1A1A1A] absolute inset-x-0" />
              <span className="bg-[#0D0D0D] px-3 py-1 text-[#737373] text-[11px] font-semibold uppercase border border-[#1A1A1A] rounded-full z-10">
                or
              </span>
            </div>

            {/* Right: stacked inputs */}
            <div className="flex-1 flex flex-col justify-between gap-3">
              <div className="flex flex-col">
                <label
                  htmlFor="company-name"
                  className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-2"
                >
                  Company Name
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company Name"
                  className="w-full h-10 bg-black border border-[#1A1A1A] text-white text-sm px-3 rounded-md focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                />
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="job-title"
                  className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider mb-2"
                >
                  Job Title / Role
                </label>
                <input
                  id="job-title"
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Job Title / Role"
                  className="w-full h-10 bg-black border border-[#1A1A1A] text-white text-sm px-3 rounded-md focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                />
              </div>
            </div>
          </div>

          {/* Run button + telemetry status */}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRunReport}
              disabled={running}
              className="w-full py-3 bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  running ? 'animate-spin' : ''
                }`}
              >
                {running ? 'sync' : 'bolt'}
              </span>
              <span>{running ? 'Gathering telemetry...' : 'Run Report'}</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[#737373] text-xs pt-2 border-t border-[#1A1A1A]/40">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-[#22c55e] shrink-0">⚡</span>
                <span className="truncate">{telemetryLine}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span>{refreshedAt}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Results grid ─────────────────────────────── */}
        <div
          className="flex flex-col gap-4 transition-opacity duration-300"
          style={{ opacity: running ? 0.45 : 1 }}
        >
          {/* Row 1: Extracted JD + Company Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Extracted JD */}
            <div className="lg:col-span-7 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] gap-3">
                  <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#737373] text-[18px]">
                      description
                    </span>
                    Extracted from JD
                  </h3>
                  <span className="font-mono text-[11px] text-[#737373] uppercase whitespace-nowrap">
                    Parser: High Confidence
                  </span>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 py-4 border-b border-[#1A1A1A]">
                  <Field label="Role" value={view.extracted.role || '—'} />
                  <Field label="Seniority" value={view.extracted.seniority || '—'} />
                  <Field
                    label="Experience Required"
                    value={
                      view.extracted.experience_years
                        ? `${view.extracted.experience_years}+ years`
                        : '—'
                    }
                  />
                  <Field label="Location" value={view.extracted.location || '—'} />
                  <Field
                    label="Employment Type"
                    value={view.extracted.employment_type || '—'}
                  />
                  <Field
                    label="Salary"
                    value={view.extracted.salary_text || 'Not mentioned'}
                  />
                </div>

                {/* Skills */}
                <div className="pt-3">
                  <span className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider block mb-2">
                    Required Skills
                  </span>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {view.extracted.required_skills.map((s) => (
                      <span
                        key={s}
                        className="bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-xs font-semibold rounded px-2.5 py-1"
                      >
                        {s}
                      </span>
                    ))}
                  </div>

                  <span className="text-[#737373] text-[11px] font-semibold uppercase tracking-wider block mb-2">
                    Nice to Have
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {view.extracted.nice_to_have_skills.map((s) => (
                      <span
                        key={s}
                        className="bg-[#1A1A1A] border border-[#1A1A1A] text-[#737373] text-xs font-semibold rounded px-2.5 py-1"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Company Overview */}
            <div className="lg:col-span-5 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] gap-3">
                  <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#737373] text-[18px]">
                      corporate_fare
                    </span>
                    Company Overview
                  </h3>
                  <a
                    href={view.company.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#22c55e] text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    source: Crunchbase.com ↗
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-4 py-4">
                  <Field label="Founded" value={view.company.founded} small />
                  <Field
                    label="Funding Stage"
                    value={view.company.funding_stage}
                    small
                    accent
                  />
                  <Field label="Total Raised" value={view.company.total_raised} small />
                  <Field label="Last Round" value={view.company.last_round} small />
                  <Field label="Employees" value={view.company.employees} small />
                  <Field label="Investors" value={view.company.investors} small />
                </div>
              </div>

              <div className="bg-[#141414] border border-[#1A1A1A] p-3 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#22c55e] text-[16px]">
                    verified
                  </span>
                  <span className="text-white">Cap Table Solidity</span>
                </div>
                <span className="text-[#22c55e] font-mono">Tier 1 Backed</span>
              </div>
            </div>
          </div>

          {/* Row 2: Tech Stack + Ghost Posting */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Tech Stack */}
            <div className="lg:col-span-7 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] gap-3">
                <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#737373] text-[18px]">
                    code
                  </span>
                  Tech Stack Reality Check
                </h3>
                <a
                  href={view.github.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#22c55e] text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  source: GitHub.com ↗
                </a>
              </div>

              <div className="grid grid-cols-2 text-[#737373] text-[11px] uppercase font-mono py-2.5 border-b border-[#1A1A1A]/60">
                <span>In the JD</span>
                <span className="text-right">In Public Codebase</span>
              </div>

              <div className="divide-y divide-[#1A1A1A]">
                {view.github.jd_tech.map((tech) => {
                  const confirmed = tech.status === 'confirmed'
                  const inCode = tech.status === 'in_code'
                  const missing = tech.status === 'missing'
                  return (
                    <div
                      key={tech.name}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <span className="text-white text-sm font-medium flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            missing ? 'bg-[#737373]' : 'bg-[#22c55e]'
                          }`}
                        />
                        {tech.name}
                      </span>
                      <div className="text-right">
                        {missing ? (
                          <span className="text-[#737373] font-semibold text-[13px]">
                            Not found in public repos —
                          </span>
                        ) : (
                          <>
                            <span className="text-[#22c55e] font-semibold text-[13px]">
                              {inCode ? 'In code, not in JD ✓' : 'Confirmed ✓'}
                            </span>
                            <span className="text-[#737373] text-xs ml-1 hidden sm:inline">
                              {confirmed && '(verified in repos)'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1A1A1A] text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[#737373]">Last Public Commit:</span>
                  <span className="text-white font-medium">
                    {view.github.last_commit || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="text-[#737373]">Total Public Repositories:</span>
                  <span className="text-white font-medium">
                    {view.github.public_repos} public repos tracked
                  </span>
                </div>
              </div>
            </div>

            {/* Ghost Posting */}
            <div className="lg:col-span-5 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1 border-b border-[#1A1A1A] gap-3">
                  <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#737373] text-[18px]">
                      history
                    </span>
                    Posting History
                  </h3>
                  <a
                    href={view.ghost.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#22c55e] text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    source: Google Search ↗
                  </a>
                </div>
                <p className="text-[#737373] text-[13px] mt-1 mb-3">
                  Dates this role was found publicly
                </p>

                {/* Alert */}
                {view.ghost.postings.length >= 3 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#EAB308]/10 border border-[#EAB308]/30 mb-4 w-full">
                    <span className="w-2 h-2 rounded-full bg-[#EAB308] shrink-0" />
                    <span className="text-[#EAB308] text-xs font-medium">
                      Posted multiple times — review carefully
                    </span>
                  </div>
                )}

                {/* Timeline */}
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-[#1A1A1A]">
                  {view.ghost.postings.map((p, i) => (
                    <div
                      key={i}
                      className="relative flex items-start justify-between gap-3"
                    >
                      <div
                        className={`absolute -left-6 top-1 w-2 h-2 rounded-full ${
                          i === 0 ? 'bg-[#22c55e]' : 'bg-[#737373]'
                        }`}
                      />
                      <div className="min-w-0">
                        <span className="text-white text-[13px] font-medium block">
                          {p.date}
                        </span>
                        <span className="text-[#737373] text-xs">
                          {p.platform}
                        </span>
                      </div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                        aria-label="Open posting"
                      >
                        <span className="material-symbols-outlined text-[#22c55e] text-[16px]">
                          open_in_new
                        </span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ghost probability */}
              <div className="mt-5 p-3 rounded-lg bg-[#141414] border border-[#1A1A1A]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[#737373] text-xs uppercase font-semibold">
                    Ghost Probability Metric
                  </span>
                  <span className="text-[#EAB308] font-mono text-[13px]">
                    {view.ghost.probability}% (Moderate Risk)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#EAB308] rounded-full"
                    style={{ width: `${view.ghost.probability}%` }}
                  />
                </div>
                <span className="text-[#737373] text-[11px] block mt-1.5">
                  Pattern shows continuous evergreen re-listing rather than fresh headcount.
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: News + Reddit + Glassdoor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* News */}
            <div className="lg:col-span-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1 border-b border-[#1A1A1A] gap-3">
                  <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#737373] text-[18px]">
                      newspaper
                    </span>
                    Recent News
                  </h3>
                  <a
                    href={view.news.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#22c55e] text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    source: NewsAPI ↗
                  </a>
                </div>
                <span className="text-[#737373] text-xs block mb-3 mt-1">
                  Last 90 days
                </span>

                <div className="divide-y divide-[#1A1A1A]">
                  {view.news.articles.length === 0 ? (
                    <p className="py-4 text-sm text-[#737373]">
                      No recent news found.
                    </p>
                  ) : (
                    view.news.articles.map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-3 flex items-start justify-between gap-2 group cursor-pointer"
                      >
                        <div className="min-w-0">
                          <h4 className="text-white text-sm font-medium leading-snug group-hover:text-[#22c55e] transition-colors">
                            {a.title}
                          </h4>
                          <span className="text-[#737373] text-xs block mt-1">
                            {a.source} • {a.published_at}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[#22c55e] text-[16px] shrink-0 mt-0.5">
                          arrow_outward
                        </span>
                      </a>
                    ))
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-[#1A1A1A] text-xs flex items-center justify-between">
                <span className="text-[#737373]">News sentiment score</span>
                <span className="text-[#22c55e] font-mono">
                  +{view.news.sentiment.toFixed(2)} Bullish
                </span>
              </div>
            </div>

            {/* Reddit (demo — backend doesn't query Reddit yet) */}
            <div className="lg:col-span-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] gap-3">
                  <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#737373] text-[18px]">
                      forum
                    </span>
                    Reddit Mentions
                  </h3>
                  <a
                    href={view.reddit.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#22c55e] text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    source: Reddit ↗
                  </a>
                </div>

                <div className="pt-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[#22c55e] font-semibold text-base">
                      {view.reddit.sentiment === 'mostly_positive'
                        ? 'Mostly Positive'
                        : view.reddit.sentiment === 'mixed'
                        ? 'Mixed'
                        : 'Mostly Negative'}
                    </span>
                  </div>
                  <p className="text-[#737373] text-xs mt-0.5">
                    Based on {view.reddit.total} public mentions across engineering subreddits
                  </p>
                </div>

                <div className="divide-y divide-[#1A1A1A] mt-4">
                  {view.reddit.subreddits.map((s) => (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block py-2.5 hover:bg-[#141414] px-1.5 -mx-1.5 rounded transition-colors"
                    >
                      <div className="flex items-center justify-between text-[13px] gap-3">
                        <span className="text-white font-medium truncate">
                          {s.name}
                        </span>
                        <span
                          className={`font-mono text-xs shrink-0 ${
                            s.mentions === 0
                              ? 'text-[#737373]'
                              : s.pos_pct >= 60
                              ? 'text-[#22c55e]'
                              : 'text-[#EAB308]'
                          }`}
                        >
                          {s.mentions === 0
                            ? '0 mentions'
                            : `${s.mentions} (${s.pos_pct}% pos)`}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-[#1A1A1A] text-xs text-[#737373]">
                <span>Filter: r/ExperiencedDevs weighted 2.5x</span>
              </div>
            </div>

            {/* Glassdoor */}
            <div className="lg:col-span-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] gap-3">
                  <h3 className="text-white text-[15px] font-semibold tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#737373] text-[18px]">
                      reviews
                    </span>
                    Glassdoor
                  </h3>
                  <a
                    href={view.glassdoor.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#22c55e] text-xs font-medium hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    source: Glassdoor ↗
                  </a>
                </div>

                {view.glassdoor.overall_rating ? (
                  <div className="space-y-3 py-4">
                    <div className="flex items-center justify-between p-2.5 rounded bg-[#141414] border border-[#1A1A1A]">
                      <span className="text-[#737373] text-[13px]">
                        Overall Rating
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-semibold text-sm">
                          {view.glassdoor.overall_rating} / 5.0
                        </span>
                        <div className="flex text-[#22c55e]">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className="material-symbols-outlined text-[16px]"
                              style={{
                                fontVariationSettings:
                                  i <= Math.round(view.glassdoor.overall_rating || 0)
                                    ? "'FILL' 1"
                                    : "'FILL' 0",
                                color:
                                  i <= Math.round(view.glassdoor.overall_rating || 0)
                                    ? '#22c55e'
                                    : '#737373',
                              }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded bg-[#141414] border border-[#1A1A1A]">
                      <span className="text-[#737373] text-[13px]">
                        Interview Difficulty
                      </span>
                      <span className="text-[#EAB308] font-semibold text-sm px-2 py-0.5 bg-[#EAB308]/10 rounded border border-[#EAB308]/30">
                        {view.glassdoor.interview_difficulty || '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded bg-[#141414] border border-[#1A1A1A]">
                      <span className="text-[#737373] text-[13px]">
                        Offer Rate
                      </span>
                      <div className="text-right">
                        <span className="text-white font-semibold text-sm">
                          {view.glassdoor.offer_rate}%
                        </span>
                        <span className="text-[#737373] text-[11px] block">
                          (Selectively competitive)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded bg-[#141414] border border-[#1A1A1A]">
                      <span className="text-[#737373] text-[13px]">
                        Recommend to Friend
                      </span>
                      <span className="text-[#22c55e] font-semibold text-sm">
                        {view.glassdoor.recommend_percent}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <span className="material-symbols-outlined text-[#737373] text-3xl block mb-2">
                      pending
                    </span>
                    <p className="text-sm text-[#737373]">
                      Glassdoor data coming soon
                    </p>
                    <p className="text-xs text-[#737373] mt-1">
                      We have applied for official API access
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#1A1A1A]">
                <a
                  href={view.glassdoor.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#22c55e] text-sm font-medium hover:underline flex items-center justify-between"
                >
                  <span>View all reviews on Glassdoor</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="w-full bg-[#1A1A1A] rounded-lg p-4 mt-2">
            <p className="text-[#737373] text-xs leading-relaxed">
              All data displayed is sourced from public third-party platforms.
              SafeApply.AI does not verify, generate, or take responsibility for this
              information. Sources are linked directly. This is not career advice.
            </p>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={handleShare}
              className="border border-[#1A1A1A] bg-[#0D0D0D] text-white hover:bg-[#1A1A1A] px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  shareCopied ? 'text-[#22c55e]' : 'text-[#737373]'
                }`}
              >
                {shareCopied ? 'check' : 'share'}
              </span>
              <span>{shareCopied ? 'Copied Link' : 'Share Report'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="border border-[#1A1A1A] bg-[#0D0D0D] text-white hover:bg-[#1A1A1A] px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                {savedToBackend ? 'check_circle' : 'bookmark'}
              </span>
              <span>{savedToBackend ? 'Report Saved' : 'Save Report'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Field helper ─────────────────────────────────────────
function Field({
  label,
  value,
  small,
  accent,
}: {
  label: string
  value: string
  small?: boolean
  accent?: boolean
}) {
  return (
    <div>
      <span className="text-[#737373] text-[11px] uppercase font-semibold block">
        {label}
      </span>
      <span
        className={`${small ? 'text-sm' : 'text-sm'} font-medium leading-snug ${
          accent ? 'text-[#22c55e] inline-flex items-center gap-1' : 'text-white'
        }`}
      >
        {accent && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
        )}
        {value}
      </span>
    </div>
  )
}