// FILE: src/pages/public/Landing.tsx
//
// Live demo behaviour (permanent):
//   • Backend caps input at 8,000 chars — enforced here too
//   • Live character counter turns yellow at 6,000, red at 8,000
//   • Button disables when over the cap
//   • In production, backend enforces 1 try per IP per 24h
//   • Frontend tracks usage in localStorage as a UX shortcut
//   • In dev, the backend bypasses the IP limit so testing is free;
//     clear localStorage to reset the frontend flag

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../../components/ui/Logo'
import SEO from '../../components/SEO'

interface ExtractedJD {
  role: string | null
  seniority: string | null
  experience_years: number | null
  required_skills: string[]
  nice_to_have_skills: string[]
  salary_mentioned: boolean
  salary_text: string | null
  location: string | null
  remote: boolean | null
  employment_type: string | null
  company_name: string | null
}

const FEATURES = [
  { icon: 'corporate_fare', title: 'Company Intelligence', desc: 'News, funding data, GitHub activity, and posting history aggregated from public sources with full citations.' },
  { icon: 'terminal', title: 'Tech Stack Verification', desc: 'Cross-reference claimed tech stacks in job posts against actual GitHub commits and infrastructure signals.' },
  { icon: 'visibility_off', title: 'Ghost Posting Detection', desc: 'Identify fake openings kept open for PR metrics, investor signaling, or talent pipeline harvesting.' },
  { icon: 'dynamic_feed', title: 'News and Sentiment', desc: 'Real-time indexing of funding announcements, tech blog mentions, layoff news, and company coverage.' },
  { icon: 'document_scanner', title: 'CV Intelligence', desc: 'Match your CV against any JD — see exactly which skills are missing and get AI-powered bullet rewrites.' },
  { icon: 'fact_check', title: 'ATS CV Builder', desc: 'Build clean, machine-readable CVs structured for Workday, Greenhouse, and Lever ATS systems.' },
]

const FREE_FEATURES = [
  { label: '3 company reports per month', included: true },
  { label: '1 free JD extraction per month', included: true },
  { label: '1 CV match per month', included: true },
  { label: 'Track up to 5 applications', included: true },
  { label: 'Read company reviews', included: true },
  { label: 'Ghost posting detection', included: false },
  { label: 'Full company intel report', included: false },
  { label: 'Unlimited CV matches and rewrites', included: false },
  { label: 'ATS CV builder and export', included: false },
  { label: 'Analytics dashboard', included: false },
]

const PRO_FEATURES = [
  { label: 'Unlimited company reports' },
  { label: 'Unlimited JD extraction' },
  { label: 'Unlimited CV matches and rewrites' },
  { label: 'Ghost posting detection and timeline' },
  { label: 'Full company intel — news, GitHub, funding' },
  { label: 'ATS CV builder — PDF, DOCX, TXT export' },
  { label: 'Unlimited application tracking' },
  { label: 'Analytics dashboard with AI insights' },
  { label: 'Submit anonymous company reviews' },
  { label: 'AI bullet point and summary generator' },
]

const REVIEWS = [
  {
    company: 'Datavane Systems',
    rating: 4,
    role: 'Staff SRE',
    badge: 'Verified Employee',
    badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20',
    review: '"On-call rotations are actually well protected. SafeApply accurately flagged the high bonus equity component before my initial counter-offer."',
    source: 'Glassdoor / Cross-check',
    date: '3 days ago',
  },
  {
    company: 'AeroLogic AI',
    rating: 2,
    role: 'Frontend Lead',
    badge: 'Ghost Post Alert',
    badgeClass: 'bg-red-500/10 text-red-400 border border-red-500/20',
    review: '"Interviewed through 4 technical stages only to discover posting was kept open purely for H1B prevailing wage proofing. Beware."',
    source: 'Glassdoor / Reddit',
    date: '1 week ago',
  },
  {
    company: 'HyperScale Cloud',
    rating: 5,
    role: 'Backend Architect',
    badge: 'Verified Employee',
    badgeClass: 'bg-green-500/10 text-green-400 border border-green-500/20',
    review: '"Extremely high technical bar. Compensation matches Top-5% tier. The stack overview provided here reflected our repo precisely."',
    source: 'GitHub / Internal',
    date: '2 weeks ago',
  },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex text-green-400">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= rating
        return (
          <span
            key={i}
            className="material-symbols-outlined text-[16px]"
            style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
          >
            star
          </span>
        )
      })}
    </div>
  )
}

const DEFAULT_JD =
  'We are seeking a Staff Infrastructure Engineer to design our Kubernetes orchestration fleet. Requirements: Go, Rust, eBPF, Distributed Consensus (Raft), AWS, Prometheus. Nice to have: Terraform, Linux Kernel tuning. Base salary range: $195k - $240k. Location: San Francisco, CA (Hybrid).'

// Matches the backend cap. Kept in sync manually — update both
// together if you change one.
const DEMO_MAX_CHARS = 8000
const DEMO_WARN_CHARS = 6000

// localStorage key — tracks that this visitor already used their free
// try. The backend enforces the real IP limit in production; this is a
// UX shortcut so the button flips to "Sign up" on the second visit
// without needing a network round-trip.
const DEMO_USED_KEY = 'safeapply_demo_jd_used'

export default function Landing() {
  const navigate = useNavigate()
  const [jdText, setJdText] = useState(DEFAULT_JD)
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedJD | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [demoUsed, setDemoUsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DEMO_USED_KEY) === '1'
  })

  const charCount = jdText.length
  const overLimit = charCount > DEMO_MAX_CHARS
  const nearLimit = charCount > DEMO_WARN_CHARS && !overLimit
  const tooShort = jdText.trim().length < 50

  const counterClass = overLimit
    ? 'text-[#EF4444]'
    : nearLimit
    ? 'text-[#EAB308]'
    : 'text-[#869585]'

  const canSubmit = !loading && !demoUsed && !overLimit && !tooShort

  async function handleExtract() {
    if (!canSubmit) return

    // Second click → straight to signup, no wasted API call
    if (demoUsed) {
      navigate('/signup?reason=demo_used')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/reports/demo-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jdText }),
      })

      const data = await res.json().catch(() => null)

      // Backend IP rate-limit hit — visitor cleared localStorage but
      // their IP is still blocked (production only).
      if (res.status === 429 || data?.code === 'DEMO_EXHAUSTED') {
        localStorage.setItem(DEMO_USED_KEY, '1')
        setDemoUsed(true)
        navigate('/signup?reason=demo_used')
        return
      }

      if (!res.ok || !data?.success) {
        setError(data?.error || 'Extraction failed. Please try again.')
        return
      }

      const jd = data.data?.extracted_jd as ExtractedJD | undefined
      if (!jd) {
        setError('Extraction returned no data. Please try again.')
        return
      }

      setExtracted(jd)
      localStorage.setItem(DEMO_USED_KEY, '1')
      setDemoUsed(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Know the Company Before You Apply | SafeApply.AI"
        description="Run a cited company intelligence report in 30 seconds. SafeApply.AI aggregates GitHub, NewsAPI, SerpAPI and Glassdoor data into one source-linked report — so you walk into every application with full information."
        path="/"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'SafeApply.AI',
          url: 'https://safeapply.ai/',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://safeapply.ai/companies?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      <div className="flex flex-col w-full min-h-screen bg-[#0e0e0e] text-[#e5e2e1]">

        {/* NAVBAR */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e]/80 backdrop-blur-md border-b border-white/10">
          <div className="h-16 max-w-[80rem] mx-auto px-4 flex items-center justify-between">
            <Logo className="h-8 w-auto" />
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-[#e5e2e1] hover:text-[#22c55e] transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-[#869585] hover:text-[#e5e2e1] transition-colors">Pricing</a>
              <Link to="/companies" className="text-sm text-[#869585] hover:text-[#e5e2e1] transition-colors">Companies</Link>
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

        {/* HERO */}
        <section className="relative w-full overflow-hidden pt-32 pb-24 flex flex-col items-center justify-center text-center px-4">
          <div className="absolute inset-0 pointer-events-none opacity-20 [background-image:linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              AI-POWERED JOB INTELLIGENCE
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight max-w-3xl">
              Know the Company Before You Apply
            </h1>
            <p className="text-base md:text-lg text-[#869585] max-w-2xl leading-relaxed">
              SafeApply.AI aggregates public data from GitHub, NewsAPI, Glassdoor, and more into one cited report — so you walk into every application with full information.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              <a
                href="#demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#22c55e] text-[#003915] text-sm font-semibold transition-colors hover:bg-[#4be277] shadow-sm"
              >
                <span>Analyze a Company Free</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#201f1f] border border-white/10 hover:border-white/20 text-[#e5e2e1] text-sm font-medium transition-colors"
              >
                See How It Works
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 mt-6 pt-4 border-t border-white/10 text-[#869585] text-xs">
              <div className="flex text-[#22c55e]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                ))}
              </div>
              <span className="text-[#e5e2e1] font-medium">4.9/5 Rating</span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span>Trusted by job seekers worldwide</span>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="w-full py-16 px-4 max-w-[80rem] mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest block mb-2">HOW IT WORKS</span>
            <h2 className="text-3xl font-bold text-white">Three steps to full company intelligence</h2>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            <div className="hidden md:block absolute top-5 left-[16%] right-[16%] h-px border-t border-dashed border-white/10 pointer-events-none" />
            {[
              { num: '01', title: 'Paste the Job Description', desc: 'Drop any raw posting or JD text. Our AI engine isolates tech requirements, seniority signals, and salary data.' },
              { num: '02', title: 'We Pull Public Data', desc: 'We query GitHub, NewsAPI, SerpAPI, and Glassdoor to build a cited intelligence report around the company.' },
              { num: '03', title: 'You Decide With Full Info', desc: 'Every data point is cited with source and link. No black box verdicts — you see the evidence and decide.' },
            ].map((step) => (
              <div key={step.num} className="relative z-10 flex flex-col items-center text-center gap-3 group">
                <div className="w-10 h-10 rounded-full border border-[#22c55e] text-[#22c55e] bg-[#131313] flex items-center justify-center text-sm font-bold mb-2 group-hover:bg-[#22c55e] group-hover:text-[#003915] transition-colors">
                  {step.num}
                </div>
                <h3 className="text-base font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-[#869585]">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="w-full py-16 px-4 max-w-[80rem] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest block mb-1">CORE CAPABILITIES</span>
              <h2 className="text-3xl font-bold text-white">Everything in one report</h2>
            </div>
            <p className="text-sm text-[#869585] max-w-md">Built for job seekers who want real intelligence before investing time in any application.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#201f1f] border border-white/10 hover:border-white/20 rounded-lg p-6 flex flex-col gap-3 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">
                  <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-[#869585]">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE DEMO */}
        <section id="demo" className="w-full bg-[#1c1b1b] border-y border-white/10 py-16 my-4">
          <div className="max-w-[80rem] mx-auto px-4 flex flex-col items-center">
            <div className="text-center max-w-xl mb-10">
              <span className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest block mb-2">INTERACTIVE DEMO</span>
              <h2 className="text-3xl font-bold text-white">Try it right now — no account needed</h2>
              <p className="text-sm text-[#869585] mt-1">
                One free extraction per visitor. Sign up to unlock full reports.
              </p>
            </div>
            <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Input */}
              <div className="bg-[#0e0e0e] border border-white/10 rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs text-[#869585] uppercase font-mono">INPUT JD</span>
                  <span className="flex items-center gap-3 font-mono text-xs">
                    <span className={counterClass}>
                      {charCount.toLocaleString()} / {DEMO_MAX_CHARS.toLocaleString()}
                    </span>
                    <span className="text-[#22c55e] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
                      READY
                    </span>
                  </span>
                </div>

                <textarea
                  aria-label="Job description to extract data from"
                  className="w-full bg-[#1c1b1b] border border-white/10 rounded p-3 text-sm text-[#e5e2e1] placeholder:text-[#869585] focus:border-[#22c55e] focus:outline-none transition-colors resize-none font-mono"
                  rows={8}
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste any job description here..."
                  disabled={demoUsed || loading}
                />

                {error && (
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded p-2 flex items-start gap-2">
                    <span className="material-symbols-outlined text-[#EF4444] text-[16px] shrink-0 mt-0.5">
                      error
                    </span>
                    <p className="text-xs text-[#EF4444]">{error}</p>
                  </div>
                )}

                {demoUsed ? (
                  <button
                    type="button"
                    onClick={() => navigate('/signup?reason=demo_used')}
                    className="w-full py-3 bg-[#22c55e] hover:bg-[#4be277] text-[#003915] text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                    <span>Sign up to continue</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={!canSubmit}
                    className="w-full py-3 bg-[#22c55e] hover:bg-[#4be277] text-[#003915] text-sm font-semibold rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                        <span>Extracting...</span>
                      </>
                    ) : overLimit ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">block</span>
                        <span>Too long — shorten to 8,000 chars</span>
                      </>
                    ) : tooShort ? (
                      <>
                        <span className="material-symbols-outlined text-[18px]">info</span>
                        <span>Paste at least 50 characters</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                        <span>Extract JD Data Free</span>
                      </>
                    )}
                  </button>
                )}

                {!demoUsed && (
                  <p className="text-[10px] text-[#869585] text-center uppercase tracking-wider font-mono">
                    1 free extraction per visitor · no signup required
                  </p>
                )}
              </div>

              {/* Output */}
              <div className="bg-[#0e0e0e] border border-white/10 rounded-lg p-4 flex flex-col gap-4 min-h-[300px]">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs text-[#869585] uppercase font-mono">PARSED OUTPUT</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 uppercase font-semibold">
                    JSON
                  </span>
                </div>
                {extracted ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#869585] uppercase font-mono">ROLE AND SENIORITY</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-white font-mono truncate">
                          {extracted.role || '—'}
                        </span>
                        {extracted.seniority && (
                          <span className="px-2 py-0.5 rounded bg-[#201f1f] border border-white/10 text-[#bccbb9] text-[11px] font-mono whitespace-nowrap">
                            {extracted.seniority.charAt(0).toUpperCase() + extracted.seniority.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 py-2 border-y border-white/10">
                      <div>
                        <span className="text-xs text-[#869585] uppercase font-mono block mb-1">LOCATION</span>
                        <span className="text-sm text-white flex items-center gap-1">
                          <span className="material-symbols-outlined text-[#22c55e] text-[16px]">location_on</span>
                          {extracted.location || 'Not specified'}
                          {extracted.remote ? ' (Remote)' : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-[#869585] uppercase font-mono block mb-1">SALARY</span>
                        <span className="text-sm text-white font-mono">
                          {extracted.salary_text || 'Not mentioned'}
                        </span>
                      </div>
                    </div>
                    {extracted.required_skills.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-[#869585] uppercase font-mono">REQUIRED SKILLS</span>
                        <div className="flex flex-wrap gap-1.5">
                          {extracted.required_skills.map((skill) => (
                            <span key={skill} className="px-2 py-1 rounded text-[11px] font-mono bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {extracted.nice_to_have_skills.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-[#869585] uppercase font-mono">NICE TO HAVE</span>
                        <div className="flex flex-wrap gap-1.5">
                          {extracted.nice_to_have_skills.map((skill) => (
                            <span key={skill} className="px-2 py-1 rounded text-[11px] font-mono bg-[#201f1f] text-[#869585] border border-white/10">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 opacity-30">
                    <div className="h-4 bg-white/10 rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-white/10 rounded w-1/2 animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-white/10 rounded w-16 animate-pulse" />
                      <div className="h-6 bg-white/10 rounded w-16 animate-pulse" />
                      <div className="h-6 bg-white/10 rounded w-20 animate-pulse" />
                    </div>
                    <p className="text-xs text-[#869585] text-center mt-4">
                      Paste a JD and click Extract to see results
                    </p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-[#869585] mt-4">
              Sign up free to unlock full company intelligence reports with sources and citations.
            </p>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="w-full py-16 px-4 max-w-[80rem] mx-auto">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest block mb-2">PRICING</span>
            <h2 className="text-3xl font-bold text-white">Simple, transparent pricing</h2>
            <p className="text-sm text-[#869585] mt-1">Start free. Upgrade when you need the full picture.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Free */}
            <div className="bg-[#1c1b1b] border border-white/10 rounded-lg p-6 flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <div>
                  <span className="text-xs text-[#869585] uppercase font-mono">FREE TIER</span>
                  <h3 className="text-lg font-semibold text-white mt-1">Free</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-5xl font-extrabold text-white">$0</span>
                    <span className="text-sm text-[#869585]">/ forever</span>
                  </div>
                  <p className="text-xs text-[#869585] mt-2">Essential features to get started with no commitment.</p>
                </div>
                <ul className="flex flex-col gap-2 pt-4 border-t border-white/10 text-sm">
                  {FREE_FEATURES.map((f) => (
                    <li key={f.label} className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${f.included ? 'text-[#22c55e]' : 'text-white/20'}`}>
                        {f.included ? 'check_circle' : 'cancel'}
                      </span>
                      <span className={f.included ? 'text-[#e5e2e1]' : 'text-[#869585] line-through'}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/signup"
                className="mt-6 w-full py-2.5 rounded bg-[#201f1f] border border-white/10 hover:border-white/20 text-center text-sm font-medium text-[#e5e2e1] transition-colors block"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-[#1c1b1b] border-2 border-[#22c55e] rounded-lg p-6 flex flex-col justify-between shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#22c55e] text-[#003915] text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <span className="text-xs text-[#22c55e] uppercase font-mono">PRO PLAN</span>
                  <h3 className="text-lg font-semibold text-white mt-1">Pro</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-5xl font-extrabold text-white">$10</span>
                    <span className="text-sm text-[#869585]">/ month</span>
                  </div>
                  <p className="text-xs text-[#869585] mt-2">Full company intelligence and unlimited access to all features.</p>
                </div>
                <ul className="flex flex-col gap-2 pt-4 border-t border-white/10 text-sm">
                  {PRO_FEATURES.map((f) => (
                    <li key={f.label} className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#22c55e]">check_circle</span>
                      <span className="text-[#e5e2e1]">{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/signup"
                className="mt-6 w-full py-2.5 rounded bg-[#22c55e] text-[#003915] hover:bg-[#4be277] text-center text-sm font-semibold transition-colors block"
              >
                Get Pro
              </Link>
            </div>
          </div>
        </section>

        {/* REVIEWS */}
        <section className="w-full py-16 px-4 max-w-[80rem] mx-auto mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <span className="text-xs font-semibold text-[#22c55e] uppercase tracking-widest block mb-1">COMMUNITY REVIEWS</span>
              <h2 className="text-3xl font-bold text-white">Recent Company Reviews</h2>
            </div>
            <Link to="/companies" className="inline-flex items-center gap-2 text-[#22c55e] hover:text-[#4be277] text-sm font-semibold transition-colors">
              <span>Browse All Reviews</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REVIEWS.map((r) => (
              <div key={r.company} className="bg-[#201f1f] border border-white/10 hover:border-white/20 rounded-lg p-4 flex flex-col justify-between transition-colors">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-white">{r.company}</span>
                    <StarRating rating={r.rating} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[#bccbb9] text-[11px] font-mono">{r.role}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${r.badgeClass}`}>{r.badge}</span>
                  </div>
                  <p className="text-xs text-[#869585] italic mt-1">{r.review}</p>
                </div>
                <div className="pt-3 border-t border-white/10 mt-3 flex items-center justify-between text-[#869585] text-xs">
                  <span className="font-mono">{r.source}</span>
                  <span>{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="w-full bg-[#0e0e0e] border-t border-white/10 py-12">
          <div className="max-w-[80rem] mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="flex flex-col gap-3">
              <Logo className="h-7 w-auto" />
              <p className="text-xs text-[#869585]">Job intelligence platform aggregating public data to help you apply smarter.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[#869585] uppercase tracking-wider mb-1">Product</span>
              <a href="#features" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">CV Intelligence</a>
              <Link to="/companies" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Company Reports</Link>
              <a href="#pricing" className="text-sm text-[#bccbb9] hover:text-[#e5e2e1] transition-colors">Pricing</a>
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
                <button
                  type="button"
                  className="bg-[#22c55e] text-[#003915] px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-[#4be277] transition-colors"
                >
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