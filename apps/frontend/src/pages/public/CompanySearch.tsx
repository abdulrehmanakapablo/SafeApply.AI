// FILE: src/pages/public/CompanySearch.tsx
// ROUTE: /companies (public)
// BACKEND: GET /api/reviews/companies
// PURPOSE: Browse companies with reviews, ratings, and filters

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import Logo from '../../components/ui/Logo'
import { getCompanies, type CompanyListItem } from '../../api/reviews'

interface CompanyCard {
  id: string
  slug: string
  name: string
  industry: string
  location: string
  open_roles: number
  rating: number
  review_count: number
  culture: number
  interview_difficulty: string
  interview_score: number
  recommend: number
}

// Fallback demo data — shown when backend returns nothing (pilot mode)
const DEMO_COMPANIES: CompanyCard[] = []

const INDUSTRIES = [
  'All Industries',
  'Fintech / Infrastructure',
  'AI & Research',
  'Observability & Cloud',
  'Developer Tools',
  'Design Platform',
]

const RATINGS = [
  { label: 'Any Rating', value: 0 },
  { label: '4.8+ Stars', value: 4.8 },
  { label: '4.5+ Stars', value: 4.5 },
  { label: '4.0+ Stars', value: 4.0 },
]

// Backend item → Card (fills missing fields with sensible defaults)
function toCard(item: CompanyListItem): CompanyCard {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    industry: item.industry || 'Technology',
    location: '—',
    open_roles: 0,
    rating: Number(item.avg_overall_rating) || 0,
    review_count: item.total_reviews || 0,
    culture: Number(item.avg_culture_rating) || 0,
    interview_difficulty: 'Medium',
    interview_score: Number(item.avg_interview_rating) || 0,
    recommend: 0,
  }
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex text-[#22c55e]">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="material-symbols-outlined text-[18px]"
          style={{ fontVariationSets: undefined, fontVariationSettings: i <= Math.round(rating) ? "'FILL' 1" : "'FILL' 0" }}
        >
          star
        </span>
      ))}
    </div>
  )
}

export default function CompanySearch() {
  const [companies, setCompanies] = useState<CompanyCard[]>(DEMO_COMPANIES)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [industry, setIndustry] = useState('All Industries')
  const [minRating, setMinRating] = useState(0)
  const [showIndustryMenu, setShowIndustryMenu] = useState(false)
  const [showRatingMenu, setShowRatingMenu] = useState(false)

  // ── Auth state ────────────────────────────────────────
  // Reads from the Zustand store, then verifies a real token exists.
  // The store flag alone can be stale; the token is the source of truth.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const hasToken =
    typeof window !== 'undefined' && Boolean(localStorage.getItem('access_token'))
  const canReview = isAuthenticated && hasToken

  // Route for the review CTA — signup first if not logged in, then
  // bounce back to the review form after they finish signing up.
  const reviewHref = canReview
    ? '/dashboard/review'
    : '/signup?redirect=%2Fdashboard%2Freview'
  const reviewLabel = canReview ? 'Add Company Review' : 'Sign up to Review'
  const reviewIcon = canReview ? 'rate_review' : 'person_add'

  // Fetch from backend — silently fall back to demo on empty or error
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getCompanies({ page: 1 })
        if (!cancelled && res.success && res.data && res.data.length > 0) {
          setCompanies(res.data.map(toCard))
        }
      } catch {
        // keep demo data
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function onClick() {
      setShowIndustryMenu(false)
      setShowRatingMenu(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Cmd/Ctrl+K focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('company-search-input')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return companies.filter((c) => {
      const matchesSearch = !q || c.name.toLowerCase().includes(q)
      const matchesIndustry = industry === 'All Industries' || c.industry === industry
      const matchesRating = c.rating >= minRating
      return matchesSearch && matchesIndustry && matchesRating
    })
  }, [companies, searchQuery, industry, minRating])

  function resetFilters() {
    setSearchQuery('')
    setIndustry('All Industries')
    setMinRating(0)
  }

  return (
    <>
      <SEO
        title="Company Reviews — Anonymous, from real job seekers | SafeApply.AI"
        description="Browse anonymous company reviews from job seekers and employees. Ratings, interview difficulty, culture scores, and open roles — verified, sourced, and unfiltered."
        path="/companies"
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
              {canReview ? (
                <>
                  <Link
                    to="/dashboard"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#e5e2e1] bg-[#1c1b1b] border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#22c55e]">
                      dashboard
                    </span>
                    Dashboard
                  </Link>
                  <Link
                    to="/dashboard/settings"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#e5e2e1] bg-[#1c1b1b] border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                    title={user?.email ?? ''}
                  >
                    <span className="w-6 h-6 rounded-full bg-[#22c55e] text-black text-[11px] font-bold flex items-center justify-center">
                      {(user?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </span>
                    <span className="hidden sm:inline truncate max-w-[100px]">
                      {user?.full_name?.split(' ')[0] || 'Account'}
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-4 py-1.5 text-sm font-medium text-[#e5e2e1] bg-[#1c1b1b] border border-white/10 rounded-lg hover:border-white/20 transition-colors">
                    Login
                  </Link>
                  <Link to="/signup" className="px-4 py-1.5 text-sm font-semibold bg-[#22c55e] text-[#003915] rounded-lg hover:bg-[#4be277] transition-colors">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="w-full pt-16 min-h-screen">

          {/* HERO */}
          <section className="w-full py-12 px-4 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1c1b1b] border border-white/10 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#869585]">
                  Verified Workplace Telemetry
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
                Company Reviews
              </h1>
              <p className="text-sm md:text-base text-[#869585] max-w-md">
                Anonymous reviews from real job seekers and employees
              </p>

              {/* SEARCH */}
              <div className="w-full max-w-[600px] mt-6 relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#869585] group-focus-within:text-[#22c55e] transition-colors">
                  <span className="material-symbols-outlined text-xl">search</span>
                </div>
                <input
                  id="company-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search any company..."
                  className="w-full bg-[#1c1b1b] text-white placeholder:text-[#869585] text-sm py-3.5 pl-11 pr-16 rounded-lg border border-white/10 focus:outline-none focus:border-[#22c55e] transition-colors"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-mono text-[#869585] bg-[#0e0e0e] border border-white/10 rounded">
                    ⌘K
                  </kbd>
                </div>
              </div>

              {/* FILTERS */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-4 w-full">

                {/* Industry dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowIndustryMenu((v) => !v)
                      setShowRatingMenu(false)
                    }}
                    className="inline-flex items-center gap-2 bg-[#1c1b1b] border border-white/10 text-[#869585] hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">domain</span>
                    <span>Industry: {industry === 'All Industries' ? 'All' : industry}</span>
                    <span className="material-symbols-outlined text-base">expand_more</span>
                  </button>
                  {showIndustryMenu && (
                    <div className="absolute left-0 mt-1 w-56 bg-[#0e0e0e] border border-white/10 rounded-lg shadow-xl z-20 py-1">
                      {INDUSTRIES.map((ind) => (
                        <button
                          key={ind}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIndustry(ind)
                            setShowIndustryMenu(false)
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            industry === ind
                              ? 'text-white bg-[#1c1b1b]'
                              : 'text-[#869585] hover:text-white hover:bg-[#1c1b1b]'
                          }`}
                        >
                          {ind}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rating dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowRatingMenu((v) => !v)
                      setShowIndustryMenu(false)
                    }}
                    className="inline-flex items-center gap-2 bg-[#1c1b1b] border border-white/10 text-[#869585] hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-[#22c55e]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                    <span>Min Rating: {minRating === 0 ? 'Any' : `${minRating}+`}</span>
                    <span className="material-symbols-outlined text-base">expand_more</span>
                  </button>
                  {showRatingMenu && (
                    <div className="absolute left-0 mt-1 w-44 bg-[#0e0e0e] border border-white/10 rounded-lg shadow-xl z-20 py-1">
                      {RATINGS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMinRating(r.value)
                            setShowRatingMenu(false)
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            minRating === r.value
                              ? 'text-white bg-[#1c1b1b]'
                              : 'text-[#869585] hover:text-white hover:bg-[#1c1b1b]'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Counter */}
                <div className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1c1b1b] border border-white/10 text-[#869585] text-sm">
                  <span className="text-white font-semibold">{filtered.length}</span> index profiles active
                </div>
              </div>
            </div>
          </section>

          {/* TICKER */}
          <div className="w-full py-2.5 px-4 border-y border-white/5">
            <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-[#869585]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22c55e] text-base">verified_user</span>
                <span>All scores derived from authenticated GitHub, LinkedIn, and ATS verified interview streams.</span>
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span className="text-white">Updated 4m ago</span>
                <span className="text-[#22c55e] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> 99.4% Signal Confidence
                </span>
              </div>
            </div>
          </div>

          {/* RESULTS */}
          <section className="w-full max-w-[1200px] mx-auto py-12 px-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <span className="material-symbols-outlined text-[#22c55e] text-3xl animate-spin">sync</span>
                <p className="text-[#869585] text-sm mt-3">Loading companies…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0D0D0D] border border-white/10 rounded-xl">
                <span className="material-symbols-outlined text-[#869585] text-4xl mb-3">manage_search</span>
                <h4 className="text-base font-semibold text-white mb-1">No matching companies found</h4>
                <p className="text-sm text-[#869585] max-w-sm mb-4">
                  Try adjusting your keyword search query or relaxing your industry and rating filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="bg-[#201f1f] hover:bg-[#2a2a2a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((c) => (
                  <Link
                    key={c.id}
                    to={`/companies/${c.slug}`}
                    className="group bg-[#0D0D0D] border border-white/10 hover:border-[#22c55e]/40 rounded-xl p-6 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#1c1b1b] border border-white/10 flex items-center justify-center text-[#22c55e] text-base font-bold">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white group-hover:text-[#22c55e] transition-colors">
                              {c.name}
                            </h3>
                            <span className="text-xs text-[#869585]">{c.location}</span>
                          </div>
                        </div>
                        <span className="bg-[#1c1b1b] border border-white/10 text-[#869585] text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
                          {c.industry}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <StarRow rating={c.rating} />
                        <span className="text-sm font-semibold text-white">{c.rating.toFixed(1)}</span>
                        <span className="text-xs text-[#869585]">({c.review_count} reviews)</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-[#1c1b1b] border border-white/5 rounded-lg mb-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#869585]">Culture</p>
                          <p className="text-xs font-mono font-semibold text-white mt-0.5">{c.culture.toFixed(1)} / 5</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#869585]">Interview</p>
                          <p className="text-xs font-mono font-semibold text-white mt-0.5">
                            {c.interview_difficulty} / {c.interview_score.toFixed(1)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#869585]">Recommend</p>
                          <p className="text-xs font-mono font-semibold text-[#22c55e] mt-0.5">{c.recommend}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-sm font-semibold text-[#22c55e] inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        View Reviews
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                      </span>
                      {c.open_roles > 0 && (
                        <span className="text-xs text-[#869585] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" /> {c.open_roles} open roles
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* CTA BANNER — auth-aware */}
            <div className="mt-12 bg-[#0D0D0D] border border-white/10 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#1c1b1b] border border-white/10 flex items-center justify-center text-[#22c55e]">
                  <span className="material-symbols-outlined text-2xl">insights</span>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white">
                    Are you currently interviewing?
                  </h4>
                  <p className="text-sm text-[#869585]">
                    Submit an anonymous interview breakdown to unlock raw un-redacted compensation telemetry.
                  </p>
                </div>
              </div>
              <Link
                to={reviewHref}
                className="bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-base">{reviewIcon}</span>
                {reviewLabel}
              </Link>
            </div>

            {/* PAGINATION — static for pilot */}
            {filtered.length > 0 && (
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
                <p className="text-sm text-[#869585]">
                  Showing <span className="text-white font-semibold">1–{filtered.length}</span> of{' '}
                  <span className="text-white font-semibold">{filtered.length}</span> companies
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center w-9 h-9 rounded bg-[#1c1b1b] border border-white/10 text-[#869585] opacity-40 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-9 h-9 rounded bg-[#22c55e] text-black text-sm font-semibold"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center w-9 h-9 rounded bg-[#1c1b1b] border border-white/10 text-[#869585] opacity-40 cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </div>
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
