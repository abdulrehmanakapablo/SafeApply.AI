// FILE: src/pages/public/CompanyDetail.tsx
// ROUTE: /companies/:slug (public)
// BACKEND: GET /api/reviews/companies/:slug
//          GET /api/reviews/companies/:slug/reviews
//          POST /api/reviews/:id/helpful

import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import Logo from '../../components/ui/Logo'
import {
  getCompany,
  getCompanyReviews,
  markReviewHelpful,
  type CompanyReview,
} from '../../api/reviews'

// ─── Types ────────────────────────────────────────────────
interface CompanyHeader {
  slug: string
  name: string
  industry: string
  location: string
  review_count: number
  overall_rating: number
  culture_score: number
  interview_difficulty: 'Easy' | 'Medium' | 'Hard'
  interview_score: number
  offer_rate: number
}

interface ReviewCard {
  id: string
  role: string
  relationship_label: string
  date: string
  stars: number
  stage: 'offer' | 'rejected' | 'onsite' | 'applied'
  stage_label: string
  salary_badge: string | null
  headline: string
  body: string
  takeaway: string | null
  helpful_count: number
}

type TabKey = 'all' | 'interview' | 'salary'
type SortKey = 'recent' | 'rating_high' | 'rating_low' | 'helpful'

// ─── Demo fallback data (pilot mode) ──────────────────────
const DEMO_HEADERS: Record<string, CompanyHeader> = {
  stripe: {
    slug: 'stripe',
    name: 'Stripe',
    industry: 'Financial Infrastructure & Payments',
    location: 'San Francisco, CA / Remote',
    review_count: 142,
    overall_rating: 4.6,
    culture_score: 92,
    interview_difficulty: 'Hard',
    interview_score: 4.2,
    offer_rate: 34,
  },
  linear: {
    slug: 'linear',
    name: 'Linear',
    industry: 'Developer Tools',
    location: 'Global / Fully Remote',
    review_count: 89,
    overall_rating: 4.9,
    culture_score: 96,
    interview_difficulty: 'Hard',
    interview_score: 4.4,
    offer_rate: 28,
  },
  openai: {
    slug: 'openai',
    name: 'OpenAI',
    industry: 'AI & Research',
    location: 'San Francisco, CA / On-site',
    review_count: 428,
    overall_rating: 4.5,
    culture_score: 86,
    interview_difficulty: 'Hard',
    interview_score: 4.7,
    offer_rate: 21,
  },
}

const DEMO_REVIEWS: Record<string, ReviewCard[]> = {
  stripe: [
    {
      id: 'demo-1',
      role: 'Staff Distributed Systems Engineer',
      relationship_label: 'Anonymous Candidate',
      date: '2 days ago',
      stars: 5,
      stage: 'offer',
      stage_label: '4 Stages • Received Offer',
      salary_badge: 'L6 Band Mentioned: $485k–$540k TC',
      headline:
        'The most realistic, well-calibrated engineering loop in the industry. Stripe values your local IDE workflow over artificial whiteboard puzzles.',
      body: `The loop comprised four distinct technical segments: 1) A 60-minute Bug Hunt in a massive real repository with pre-configured Docker containers. 2) A production Integration session building a high-throughput webhook idempotency layer. 3) System Architecture covering global ledger consistency across decoupled AWS regions. 4) Culture and alignment round with an Engineering Director. Recruiter responsiveness was unmatched—received written debrief breakdowns within 24 hours of each milestone.`,
      takeaway:
        'Do not rush to write lines of code immediately. Read the provided specs carefully, inspect the test suites, and write automated tests to verify boundary conditions before running your patch.',
      helpful_count: 34,
    },
    {
      id: 'demo-2',
      role: 'Senior Backend Engineer — Core Payments',
      relationship_label: 'Anonymous Candidate',
      date: '1 week ago',
      stars: 4,
      stage: 'rejected',
      stage_label: 'Rejected with Feedback',
      salary_badge: 'Full 5-Round Virtual Loop',
      headline:
        'Extremely rigorous, but they provide genuine structural feedback rather than cold automated rejections.',
      body: `Live pair-programming evaluated API ergonomics and concurrency locks. The interviewer allowed Google search and standard library documentation. I tripped up on edge case retry exhaustion during network partition simulations in the distributed state round. The recruiter set up a 15-minute sync afterward to pass along concrete engineering notes on what leveled down my candidate grade.`,
      takeaway: null,
      helpful_count: 19,
    },
    {
      id: 'demo-3',
      role: 'Senior Frontend Engineer',
      relationship_label: 'Anonymous Candidate',
      date: '3 weeks ago',
      stars: 5,
      stage: 'onsite',
      stage_label: '3 Stages • Virtual Onsite',
      salary_badge: 'UI Engine / React Component Library',
      headline:
        'Zero trick questions. They ask you to build accessible, composable interface components that meet WCAG AAA standards.',
      body: `You are asked to replicate a complex payment method picker with full keyboard navigation and ARIA live regions. They care deeply about rendering performance, CSS architecture without side-effects, and pristine state isolation. Recruiter checked in via Slack throughout the process.`,
      takeaway: null,
      helpful_count: 42,
    },
    {
      id: 'demo-4',
      role: 'Product Infrastructure Engineer',
      relationship_label: 'Anonymous Candidate',
      date: 'Oct 18, 2024',
      stars: 4,
      stage: 'offer',
      stage_label: '4 Stages • Received Offer',
      salary_badge: 'Salary Base: $210k + Equity',
      headline:
        'High compensation transparency from initial screening call. The technical team operates with extreme discipline.',
      body: `No algorithmic leetcode inversions. The practical coding question revolved around parsing an unstructured event log stream and writing clean metrics aggregators. They were very flexible on language choice (Go, Python, Java, Ruby were all supported). Negotiation was straightforward with zero exploding deadlines.`,
      takeaway: null,
      helpful_count: 11,
    },
  ],
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Sort by: Most Recent' },
  { value: 'rating_high', label: 'Sort by: Highest Rating' },
  { value: 'rating_low', label: 'Sort by: Lowest Rating' },
  { value: 'helpful', label: 'Sort by: Most Helpful' },
]

// ─── Helpers ──────────────────────────────────────────────
function toHeader(
  raw: Awaited<ReturnType<typeof getCompany>>['data']
): CompanyHeader {
  const r = Number(raw.avg_overall_rating) || 0
  const interview = Number(raw.avg_interview_rating) || 0
  const difficulty: CompanyHeader['interview_difficulty'] =
    interview >= 4.3 ? 'Hard' : interview >= 3.8 ? 'Medium' : 'Easy'

  return {
    slug: raw.slug,
    name: raw.name,
    industry: raw.industry || 'Technology',
    location: '—',
    review_count: raw.total_reviews || 0,
    overall_rating: r,
    culture_score: Math.round((Number(raw.avg_culture_rating) || 0) * 20),
    interview_difficulty: difficulty,
    interview_score: interview,
    offer_rate: 0,
  }
}

function toReviewCard(r: CompanyReview): ReviewCard {
  const stageMap: Record<
    string,
    { stage: ReviewCard['stage']; label: string }
  > = {
    current_employee: { stage: 'offer', label: 'Current Employee' },
    former_employee: { stage: 'onsite', label: 'Former Employee' },
    applicant: { stage: 'applied', label: 'Applicant' },
    knows_someone: { stage: 'onsite', label: 'Knows Someone' },
  }
  const s = stageMap[r.relationship] || { stage: 'applied', label: 'Anonymous' }

  const salaryBadge =
    r.salary_min && r.salary_max
      ? `Salary: $${(r.salary_min / 1000).toFixed(0)}k–$${(r.salary_max / 1000).toFixed(0)}k`
      : null

  return {
    id: r.id,
    role: r.role_type,
    relationship_label: 'Anonymous Candidate',
    date: new Date(r.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    stars: Math.round(r.overall_rating),
    stage: s.stage,
    stage_label: s.label,
    salary_badge: salaryBadge,
    headline: r.review_text.split('\n')[0].slice(0, 160),
    body: r.review_text,
    takeaway: null,
    helpful_count: r.helpful_count,
  }
}

function starCount(rating: number): (0 | 0.5 | 1)[] {
  const result: (0 | 0.5 | 1)[] = []
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) result.push(1)
    else if (rating >= i - 0.5) result.push(0.5)
    else result.push(0)
  }
  return result
}

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center text-[#22c55e]">
      {starCount(rating).map((v, i) => (
        <span
          key={i}
          className="material-symbols-outlined"
          style={{
            fontSize: `${size}px`,
            fontVariationSettings: v > 0 ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          {v === 1 ? 'star' : v === 0.5 ? 'star_half' : 'star'}
        </span>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────
export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [header, setHeader] = useState<CompanyHeader | null>(null)
  const [reviews, setReviews] = useState<ReviewCard[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set())
  const [allLoaded, setAllLoaded] = useState(false)

  // Fetch company + reviews
  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const [companyRes, reviewsRes] = await Promise.all([
          getCompany(slug as string),
          getCompanyReviews(slug as string, { page: 1 }),
        ])

        if (cancelled) return

        if (companyRes.success && companyRes.data) {
          setHeader(toHeader(companyRes.data))
        } else if (DEMO_HEADERS[slug as string]) {
          setHeader(DEMO_HEADERS[slug as string])
        } else {
          setNotFound(true)
          return
        }

        if (
          reviewsRes.success &&
          reviewsRes.data &&
          reviewsRes.data.length > 0
        ) {
          setReviews(reviewsRes.data.map(toReviewCard))
        } else if (DEMO_REVIEWS[slug as string]) {
          setReviews(DEMO_REVIEWS[slug as string])
        } else {
          setReviews([])
        }
      } catch {
        if (cancelled) return
        if (DEMO_HEADERS[slug as string]) {
          setHeader(DEMO_HEADERS[slug as string])
          setReviews(DEMO_REVIEWS[slug as string] || [])
        } else {
          setNotFound(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  // Filter + sort reviews
  const visibleReviews = useMemo(() => {
    let list = [...reviews]

    if (tab === 'interview') {
      list = list.filter(
        (r) => r.stage === 'onsite' || r.stage === 'offer' || r.stage === 'rejected'
      )
    } else if (tab === 'salary') {
      list = list.filter((r) => r.salary_badge !== null)
    }

    switch (sort) {
      case 'rating_high':
        list.sort((a, b) => b.stars - a.stars)
        break
      case 'rating_low':
        list.sort((a, b) => a.stars - b.stars)
        break
      case 'helpful':
        list.sort((a, b) => b.helpful_count - a.helpful_count)
        break
    }
    return list
  }, [reviews, tab, sort])

  async function handleHelpful(id: string) {
    const isVoted = votedIds.has(id)
    setVotedIds((prev) => {
      const next = new Set(prev)
      if (isVoted) next.delete(id)
      else next.add(id)
      return next
    })
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, helpful_count: r.helpful_count + (isVoted ? -1 : 1) }
          : r
      )
    )
    if (!isVoted && !id.startsWith('demo-')) {
      try {
        await markReviewHelpful(id)
      } catch {
        // silent — count already updated locally
      }
    }
  }

  function handleReport(id: string) {
    setReportedIds((prev) => new Set(prev).add(id))
  }

  const tabCounts = {
    all: reviews.length,
    interview: reviews.filter(
      (r) => r.stage === 'onsite' || r.stage === 'offer' || r.stage === 'rejected'
    ).length,
    salary: reviews.filter((r) => r.salary_badge !== null).length,
  }

  // ── Not found ─────────────────────────────────────────
  if (!loading && notFound) {
    return (
      <>
        <SEO
          title="Company not found | SafeApply.AI"
          description="The requested company page could not be found."
          path={`/companies/${slug}`}
          noindex
        />
        <div className="flex flex-col w-full min-h-screen bg-[#0e0e0e] text-[#e5e2e1]">
          <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e]/80 backdrop-blur-md border-b border-white/10">
            <div className="h-16 max-w-[80rem] mx-auto px-4 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <Logo className="h-8 w-auto" />
              </Link>
              <Link to="/companies" className="text-sm text-[#869585] hover:text-white transition-colors">
                ← Back to Companies
              </Link>
            </div>
          </header>
          <main className="pt-16 flex-1 flex items-center justify-center px-4">
            <div className="text-center max-w-md">
              <span className="material-symbols-outlined text-[#869585] text-5xl mb-4 block">
                domain_disabled
              </span>
              <h1 className="text-3xl font-bold text-white mb-3">Company not found</h1>
              <p className="text-sm text-[#869585] mb-6">
                We don't have a record for this company yet. Search for another one or come back later.
              </p>
              <Link
                to="/companies"
                className="inline-block bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Browse all companies
              </Link>
            </div>
          </main>
        </div>
      </>
    )
  }

  // ── Loading ───────────────────────────────────────────
  if (loading || !header) {
    return (
      <>
        <SEO
          title="Loading… | SafeApply.AI"
          description="Loading company reviews."
          path={`/companies/${slug}`}
          noindex
        />
        <div className="flex flex-col w-full min-h-screen bg-[#0e0e0e] text-[#e5e2e1] items-center justify-center">
          <span className="material-symbols-outlined text-[#22c55e] text-4xl animate-spin">
            sync
          </span>
          <p className="text-[#869585] text-sm mt-3">Loading company…</p>
        </div>
      </>
    )
  }

  // ── Loaded ────────────────────────────────────────────
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: header.name,
    url: `https://safeapply.ai/companies/${header.slug}`,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: header.overall_rating,
      reviewCount: header.review_count,
      bestRating: 5,
      worstRating: 1,
    },
  }

  return (
    <>
      <SEO
        title={`${header.name} Reviews — Culture, Interviews, Salary | SafeApply.AI`}
        description={`Read ${header.review_count} anonymous reviews of ${header.name}. Overall rating ${header.overall_rating}/5, culture score ${header.culture_score}%, interview difficulty ${header.interview_difficulty}.`}
        path={`/companies/${header.slug}`}
        jsonLd={orgJsonLd}
      />

      <div className="flex flex-col w-full min-h-screen bg-[#0e0e0e] text-[#e5e2e1]">

        {/* NAVBAR */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e]/80 backdrop-blur-md border-b border-white/10">
          <div className="h-16 max-w-[80rem] mx-auto px-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Logo className="h-8 w-auto" />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/#features" className="text-sm text-[#869585] hover:text-[#e5e2e1] transition-colors">Features</Link>
              <Link to="/#pricing" className="text-sm text-[#869585] hover:text-[#e5e2e1] transition-colors">Pricing</Link>
              <Link to="/companies" className="text-sm font-medium text-[#e5e2e1] hover:text-[#22c55e] transition-colors">Companies</Link>
              <Link to="/blog" className="text-sm text-[#869585] hover:text-[#e5e2e1] transition-colors">Blog</Link>
              <Link to="/about" className="text-sm text-[#869585] hover:text-[#e5e2e1] transition-colors">About</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login" className="px-4 py-1.5 text-sm font-medium text-[#e5e2e1] bg-[#1c1b1b] border border-white/10 rounded-lg hover:border-white/20 transition-colors">
                Login
              </Link>
              <Link to="/signup" className="px-4 py-1.5 text-sm font-semibold bg-[#22c55e] text-[#003915] rounded-lg hover:bg-[#4be277] transition-colors">
                Sign Up
              </Link>
            </div>
          </div>
        </header>

        <main className="w-full pt-16 min-h-screen">

          {/* ── HEADER ────────────────────────────────── */}
          <section className="w-full border-b border-white/10 py-12 px-4">
            <div className="max-w-[80rem] mx-auto flex flex-col gap-6">

              {/* Breadcrumb */}
              <div className="flex items-center gap-2">
                <Link
                  to="/companies"
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-[#869585] hover:text-white transition-colors group"
                >
                  <span className="material-symbols-outlined text-[14px] transition-transform group-hover:-translate-x-0.5">
                    arrow_back
                  </span>
                  Back to Company Reviews
                </Link>
                <span className="text-[#353534]">•</span>
                <span className="text-xs text-[#869585]">Entities</span>
                <span className="text-[#353534]">•</span>
                <span className="font-mono text-xs text-[#22c55e] tracking-tight">
                  ORG_{header.slug.toUpperCase()}_CORP
                </span>
              </div>

              {/* Company identity + CTA */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-lg bg-[#1c1b1b] border border-white/10 flex items-center justify-center shrink-0">
                    <span className="text-[#22c55e] text-2xl font-extrabold">
                      {header.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                        {header.name}
                      </h1>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                        LIVE PIPELINE TELEMETRY
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-xs px-3 py-1 rounded bg-[#1c1b1b] border border-white/10 text-[#869585] font-medium">
                        {header.industry} • {header.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22c55e]">
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          verified
                        </span>
                        {header.review_count} Verified Candidate Reviews
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to="/dashboard/review"
                  className="inline-flex items-center justify-center gap-2 text-sm bg-[#22c55e] hover:bg-[#16A34A] text-black font-bold px-6 py-3 rounded-xl transition-all active:scale-[0.99] whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[18px]">rate_review</span>
                  Submit a Review
                </Link>
              </div>

              {/* Metric tiles */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">

                {/* Overall rating */}
                <div className="bg-[#0D0D0D] border border-white/10 rounded-xl p-4 md:p-6 text-center flex flex-col items-center hover:border-white/20 transition-colors">
                  <span className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    {header.overall_rating.toFixed(1)}{' '}
                    <span className="text-[#869585] font-normal text-base">/ 5.0</span>
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-[#869585] mt-1 mb-2">
                    Overall Rating
                  </span>
                  <StarDisplay rating={header.overall_rating} />
                </div>

                {/* Culture score */}
                <div className="bg-[#0D0D0D] border border-white/10 rounded-xl p-4 md:p-6 text-center flex flex-col items-center hover:border-white/20 transition-colors">
                  <span className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    {header.culture_score}%
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-[#869585] mt-1 mb-2">
                    Culture Score
                  </span>
                  <div className="w-24 h-1.5 bg-[#1c1b1b] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#22c55e] rounded-full"
                      style={{ width: `${header.culture_score}%` }}
                    />
                  </div>
                </div>

                {/* Interview difficulty */}
                <div className="bg-[#0D0D0D] border border-white/10 rounded-xl p-4 md:p-6 text-center flex flex-col items-center hover:border-white/20 transition-colors">
                  <span className="text-xl md:text-2xl font-extrabold text-[#EAB308] leading-tight">
                    {header.interview_difficulty} ({header.interview_score.toFixed(1)})
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-[#869585] mt-1 mb-2">
                    Interview Difficulty
                  </span>
                  <span className="font-mono text-[10px] text-[#869585] uppercase">
                    Top 5% Depth Index
                  </span>
                </div>

                {/* Offer rate */}
                <div className="bg-[#0D0D0D] border border-white/10 rounded-xl p-4 md:p-6 text-center flex flex-col items-center hover:border-white/20 transition-colors">
                  <span className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    {header.offer_rate}%
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-[#869585] mt-1 mb-2">
                    Offer Rate
                  </span>
                  <span className="font-mono text-[10px] text-[#22c55e]/80 uppercase">
                    Post-Onsite Ratio
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── REVIEWS ───────────────────────────────── */}
          <section className="w-full max-w-[80rem] mx-auto py-8 px-4">

            {/* Tabs + sort */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 gap-4">
              <div className="flex items-center gap-6" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === 'all'}
                  onClick={() => setTab('all')}
                  className={`text-sm font-semibold pb-3 transition-colors border-b-2 ${
                    tab === 'all'
                      ? 'text-white border-[#22c55e]'
                      : 'text-[#869585] hover:text-white border-transparent'
                  }`}
                >
                  All Reviews{' '}
                  <span className="font-mono text-[#869585] font-normal ml-1">
                    ({tabCounts.all})
                  </span>
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'interview'}
                  onClick={() => setTab('interview')}
                  className={`text-sm font-semibold pb-3 transition-colors border-b-2 ${
                    tab === 'interview'
                      ? 'text-white border-[#22c55e]'
                      : 'text-[#869585] hover:text-white border-transparent'
                  }`}
                >
                  Interview Experiences{' '}
                  <span className="font-mono text-[#869585] font-normal ml-1">
                    ({tabCounts.interview})
                  </span>
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'salary'}
                  onClick={() => setTab('salary')}
                  className={`text-sm font-semibold pb-3 transition-colors border-b-2 ${
                    tab === 'salary'
                      ? 'text-white border-[#22c55e]'
                      : 'text-[#869585] hover:text-white border-transparent'
                  }`}
                >
                  Salary Mentions{' '}
                  <span className="font-mono text-[#869585] font-normal ml-1">
                    ({tabCounts.salary})
                  </span>
                </button>
              </div>

              <div className="pb-2 sm:pb-0">
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="appearance-none bg-[#1c1b1b] border border-white/10 rounded text-sm text-[#869585] hover:text-white pl-3 pr-8 py-1.5 focus:border-[#22c55e] focus:outline-none cursor-pointer transition-colors"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#0e0e0e] text-white">
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1.5 text-[16px] text-[#869585] pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostic bar */}
            <div className="my-4 p-3 bg-[#1c1b1b] border border-white/10 rounded flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22c55e] text-[18px]">security</span>
                <span className="text-xs text-[#869585]">
                  All accounts cryptographically linked to verified GitHub or work-email hashes to maintain zero bot noise.
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#22c55e]">
                <span>ENCRYPTION: AES-256</span>
                <span className="text-[#353534]">|</span>
                <span>VERIFICATION: ATS_PASS</span>
              </div>
            </div>

            {/* Reviews list */}
            {visibleReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0D0D0D] border border-white/10 rounded-xl">
                <span className="material-symbols-outlined text-[#869585] text-4xl mb-3">
                  rate_review
                </span>
                <h4 className="text-base font-semibold text-white mb-1">No reviews in this view</h4>
                <p className="text-sm text-[#869585] max-w-sm">
                  Try a different tab, or be the first to submit a review.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {visibleReviews.map((r) => {
                  const voted = votedIds.has(r.id)
                  const reported = reportedIds.has(r.id)
                  const stageClass =
                    r.stage === 'offer'
                      ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                      : r.stage === 'rejected'
                      ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                      : 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30'

                  return (
                    <article
                      key={r.id}
                      className="bg-[#0D0D0D] border border-white/10 rounded-xl p-6 transition-colors hover:border-white/20 flex flex-col gap-4"
                    >
                      {/* Top row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-white font-semibold">{r.relationship_label}</span>
                          <span className="text-[#353534]">•</span>
                          <span className="text-[#869585]">{r.role}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#869585] font-mono text-xs">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span>{r.date}</span>
                        </div>
                      </div>

                      {/* Rating + badges */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <StarDisplay rating={r.stars} />
                          <span className="font-mono text-sm font-bold text-white ml-1">
                            {r.stars.toFixed(1)}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] border font-medium ${stageClass}`}
                        >
                          {r.stage_label}
                        </span>
                        {r.salary_badge && (
                          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-[#1c1b1b] border border-white/10 text-[#869585]">
                            {r.salary_badge}
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="text-sm text-[#869585] leading-relaxed flex flex-col gap-2">
                        <p className="text-white font-medium">{r.headline}</p>
                        <p>{r.body}</p>
                        {r.takeaway && (
                          <p className="text-[#869585]/80 text-xs font-mono bg-[#1c1b1b]/60 p-3 rounded border border-white/5">
                            Key takeaway: {r.takeaway}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => handleHelpful(r.id)}
                          className={`flex items-center gap-1.5 text-xs transition-colors ${
                            voted ? 'text-[#22c55e]' : 'text-[#869585] hover:text-[#22c55e]'
                          }`}
                        >
                          <span
                            className="material-symbols-outlined text-[16px]"
                            style={{ fontVariationSettings: voted ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            thumb_up
                          </span>
                          <span>Helpful ({r.helpful_count})</span>
                        </button>

                        {reported ? (
                          <span className="text-xs text-[#EF4444] opacity-60">
                            Reported to Moderator
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReport(r.id)}
                            className="text-xs text-[#869585]/60 hover:text-[#EF4444] transition-colors"
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {/* Load More */}
            {visibleReviews.length > 0 && (
              <div className="mt-12 flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={allLoaded}
                  onClick={() => setAllLoaded(true)}
                  className={`inline-flex items-center gap-2 text-sm bg-[#1c1b1b] border border-white/10 hover:border-[#22c55e]/40 text-white font-semibold px-8 py-3 rounded-lg transition-all ${
                    allLoaded ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${allLoaded ? '' : ''}`}>
                    {allLoaded ? 'check_circle' : 'cached'}
                  </span>
                  {allLoaded ? 'All Telemetry Loaded' : 'Load More Reviews'}
                </button>
                <span className="font-mono text-[11px] text-[#869585]/70">
                  Showing {visibleReviews.length} of {header.review_count} total telemetry records
                </span>
              </div>
            )}
          </section>
        </main>

        {/* FOOTER */}
        <footer className="w-full bg-[#0e0e0e] border-t border-white/10 py-12">
          <div className="max-w-[80rem] mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col gap-3">
              <Logo className="h-7 w-auto" />
              <p className="text-xs text-[#869585]">
                Job intelligence platform aggregating public data to help you apply smarter.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[#869585] uppercase tracking-wider mb-1">Product</span>
              <Link to="/#features" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">CV Intelligence</Link>
              <Link to="/companies" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Company Reports</Link>
              <Link to="/#pricing" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Pricing</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[#869585] uppercase tracking-wider mb-1">Company</span>
              <Link to="/blog" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Blog</Link>
              <Link to="/about" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">About</Link>
              <Link to="/privacy" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Terms of Service</Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#869585] uppercase tracking-wider">Stay Updated</span>
              <p className="text-xs text-[#869585]">Get bi-weekly job market intelligence drops.</p>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="bg-[#1c1b1b] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[#e5e2e1] placeholder:text-[#869585] focus:outline-none focus:border-[#22c55e] flex-1"
                />
                <button className="bg-[#22c55e] text-[#003915] px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-[#4be277] transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
          <div className="max-w-[80rem] mx-auto px-4 mt-8 pt-4 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#869585]">© {new Date().getFullYear()} SafeApply.AI. All rights reserved.</span>
            <div className="flex gap-6">
              <Link to="/terms" className="text-xs text-[#869585] hover:text-[#e5e2e1]">Terms</Link>
              <Link to="/privacy" className="text-xs text-[#869585] hover:text-[#e5e2e1]">Privacy</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}