// FILE: src/pages/dashboard/SubmitReview.tsx
// ROUTE: /dashboard/review (auth required)
// BACKEND: POST /api/reviews
// PURPOSE: Anonymous employer review submission — 5 sections, live preview,
//          success screen. Maps to the review schema validated on the backend.
// SECURITY:
//   - No dangerouslySetInnerHTML — all fields auto-escaped by React.
//   - No inline event handlers — all handlers are typed functions.
//   - Reviewer identity never displayed; stored only for admin moderation.
//   - No file upload in this version (visual dropzone only).

import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { submitReview } from '../../api/reviews'

// ─── Types ──────────────────────────────────────────────
type Relationship =
  | 'current_employee'
  | 'former_employee'
  | 'applicant'
  | 'knows_someone'

type WouldRecommend = 'yes' | 'no' | 'maybe'

interface FormState {
  company_name: string
  role_title: string
  seniority: string
  relationship: Relationship | null
  work_model: 'remote' | 'hybrid' | 'onsite'
  location: string
  stages_count: number
  stages: string[]
  overall_rating: number
  culture_rating: number
  interview_rating: number
  process_sentiment: 'positive' | 'neutral' | 'challenging'
  would_recommend: WouldRecommend | null
  response_latency: string
  feedback_given: boolean
  include_comp: boolean
  comp_base: string
  comp_equity: string
  comp_bonus: string
  review_text: string
  interview_process: string
  terms_attested: boolean
}

// ─── Config ─────────────────────────────────────────────
const COMPANY_CHIPS = ['Stripe', 'Anthropic', 'Linear', 'Datadog', 'Supabase']

const SENIORITY_OPTIONS = [
  'Intern',
  'Junior / L3',
  'Mid / L4',
  'Senior / L5',
  'Staff / L6+',
  'Director',
]

const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'applicant', label: 'Applicant' },
  { value: 'current_employee', label: 'Current Employee' },
  { value: 'former_employee', label: 'Former Employee' },
  { value: 'knows_someone', label: 'Knows Someone There' },
]

const STAGE_OPTIONS = [
  { id: 'recruiter', label: 'Recruiter Initial Sync', meta: '30 mins • Low Friction' },
  { id: 'coding', label: 'Live Coding Screen', meta: '60 mins • CoderPad' },
  { id: 'take_home', label: 'Async Take-Home / Paid Trial', meta: 'Linear-Style Work Trial' },
  { id: 'system_design', label: 'Distributed Architecture Deep-Dive', meta: '90 mins • High Rigor' },
  { id: 'leadership', label: 'Engineering Leadership & Principles', meta: '45 mins • Cross-functional' },
]

const LATENCY_OPTIONS = [
  'Sub-48 hours (Rapid)',
  '3-5 business days (Standard)',
  '1-2 weeks (Delayed)',
  'Over 3 weeks (Slow)',
]

const INITIAL_FORM: FormState = {
  company_name: '',
  role_title: '',
  seniority: 'Senior / L5',
  relationship: null,
  work_model: 'remote',
  location: '',
  stages_count: 4,
  stages: ['recruiter', 'coding', 'system_design', 'leadership'],
  overall_rating: 0,
  culture_rating: 0,
  interview_rating: 0,
  process_sentiment: 'neutral',
  would_recommend: null,
  response_latency: '3-5 business days (Standard)',
  feedback_given: false,
  include_comp: false,
  comp_base: '',
  comp_equity: '',
  comp_bonus: '',
  review_text: '',
  interview_process: '',
  terms_attested: false,
}

// ─── Helpers ────────────────────────────────────────────
const MIN_REVIEW_CHARS = 100
const MAX_REVIEW_CHARS = 2000

function parseCurrency(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9]/g, '')
  if (!cleaned) return null
  const n = parseInt(cleaned, 10)
  return Number.isNaN(n) ? null : n
}

// ─── Star rating sub-component ──────────────────────────
function StarRating({
  value,
  onChange,
  label,
  required,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white">
          {label}
          {required && <span className="text-[#22c55e] ml-1">*</span>}
        </span>
        <span className="font-mono text-xs text-[#737373]">
          {value > 0 ? `${value}.0 / 5.0` : 'Not rated'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            aria-label={`${label} — ${i} out of 5`}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <span
              className="material-symbols-outlined text-[28px]"
              style={{
                fontVariationSettings: i <= value ? "'FILL' 1" : "'FILL' 0",
                color: i <= value ? '#22c55e' : '#737373',
              }}
            >
              star
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Section header sub-component ───────────────────────
function SectionHeader({
  code,
  title,
  right,
}: {
  code: string
  title: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] mb-4 gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-2 py-0.5 rounded bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] font-mono text-[11px] whitespace-nowrap">
          {code}
        </span>
        <h2 className="text-base font-semibold text-white truncate">{title}</h2>
      </div>
      {right}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────
export default function SubmitReview() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string>('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // ── Update helper ──────────────────────────────────────
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError('')
  }

  function toggleStage(id: string) {
    setForm((prev) => {
      const stages = prev.stages.includes(id)
        ? prev.stages.filter((s) => s !== id)
        : [...prev.stages, id]
      return { ...prev, stages }
    })
  }

  // ── Derived: computed total comp ───────────────────────
  const computedTC = useMemo(() => {
    const base = parseCurrency(form.comp_base) || 0
    const eq = parseCurrency(form.comp_equity) || 0
    const bo = parseCurrency(form.comp_bonus) || 0
    return base + eq + bo
  }, [form.comp_base, form.comp_equity, form.comp_bonus])

  const reviewChars = form.review_text.length
  const reviewTooShort = reviewChars > 0 && reviewChars < MIN_REVIEW_CHARS

  // ── Validation ─────────────────────────────────────────
  function validate(): string | null {
    if (!form.company_name.trim()) return 'Company name is required.'
    if (!form.role_title.trim()) return 'Role title is required.'
    if (!form.relationship) return 'Please select your relationship to this company.'
    if (form.overall_rating < 1) return 'Overall rating is required.'
    if (form.culture_rating < 1) return 'Culture rating is required.'
    if (form.interview_rating < 1) return 'Interview experience rating is required.'
    if (!form.would_recommend) return 'Please indicate whether you would recommend.'
    if (form.review_text.trim().length < MIN_REVIEW_CHARS)
      return `Review must be at least ${MIN_REVIEW_CHARS} characters.`
    if (form.review_text.length > MAX_REVIEW_CHARS)
      return `Review must be less than ${MAX_REVIEW_CHARS} characters.`
    if (!form.terms_attested)
      return 'Please attest that this is your firsthand experience.'
    return null
  }

  // ── Submit ─────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting) return
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setToast({ kind: 'err', text: validationError })
      return
    }

    setSubmitting(true)
    setError('')

    // Compute salary min / max from base only (conservative, matches backend schema)
    const base = parseCurrency(form.comp_base)
    const equity = parseCurrency(form.comp_equity) || 0
    const bonus = parseCurrency(form.comp_bonus) || 0

    let salaryMin: number | undefined
    let salaryMax: number | undefined

    if (form.include_comp && base) {
      salaryMin = base + equity + bonus
      salaryMax = base + equity + bonus
    }

    // Fold seniority + work model into role_type so the backend stores them
    const roleTypeParts = [form.seniority, form.role_title.trim()]
    const roleType = roleTypeParts.filter(Boolean).join(' — ')

    try {
      const res = await submitReview({
        company_name: form.company_name.trim(),
        relationship: form.relationship!,
        role_type: roleType,
        overall_rating: form.overall_rating,
        culture_rating: form.culture_rating,
        interview_rating: form.interview_rating,
        would_recommend: form.would_recommend!,
        review_text: form.review_text.trim(),
        interview_process: form.interview_process.trim() || undefined,
        salary_min: salaryMin,
        salary_max: salaryMax,
      })

      if (res.success) {
        setSubmitted(true)
      } else {
        setError(res.error || 'Failed to submit review.')
        setToast({ kind: 'err', text: res.error || 'Failed to submit.' })
      }
    } catch {
      setError('Network error — please try again.')
      setToast({ kind: 'err', text: 'Network error — try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleSaveDraft() {
    setToast({ kind: 'ok', text: 'Draft saved locally.' })
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setSubmitted(false)
    setError('')
  }

  // ═══════════════════════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════════════════════
  if (submitted) {
    return (
      <>
        <SEO
          title="Review Submitted | SafeApply.AI"
          description="Your review has been submitted for moderation."
          path="/dashboard/review"
          noindex
        />

        <div className="w-full px-4 sm:px-6 py-4 sm:py-6 pb-16">
          <div className="max-w-2xl mx-auto">
            <div className="bg-[#0D0D0D] border border-[#22c55e]/40 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-[#22c55e]/10 border-2 border-[#22c55e]/40 flex items-center justify-center text-[#22c55e]">
                <span
                  className="material-symbols-outlined text-[48px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Review Submitted
                </h1>
                <p className="text-sm text-[#737373] leading-relaxed max-w-md">
                  Your review of{' '}
                  <span className="text-white font-medium">
                    {form.company_name}
                  </span>{' '}
                  has been received. It will appear on the public company page
                  after a moderator reviews it for authenticity.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-2">
                <div className="bg-black border border-[#1A1A1A] rounded-lg p-3 flex flex-col items-center">
                  <span className="material-symbols-outlined text-[#22c55e] text-[20px] mb-1">
                    verified
                  </span>
                  <span className="text-[11px] text-[#737373] uppercase tracking-wider">
                    Anonymous
                  </span>
                </div>
                <div className="bg-black border border-[#1A1A1A] rounded-lg p-3 flex flex-col items-center">
                  <span className="material-symbols-outlined text-[#22c55e] text-[20px] mb-1">
                    shield
                  </span>
                  <span className="text-[11px] text-[#737373] uppercase tracking-wider">
                    Moderated
                  </span>
                </div>
                <div className="bg-black border border-[#1A1A1A] rounded-lg p-3 flex flex-col items-center">
                  <span className="material-symbols-outlined text-[#22c55e] text-[20px] mb-1">
                    group
                  </span>
                  <span className="text-[11px] text-[#737373] uppercase tracking-wider">
                    Helps Others
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full mt-2">
                <Link
                  to="/companies"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    visibility
                  </span>
                  Browse Reviews
                </Link>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1c1b1b] border border-[#1A1A1A] hover:border-[#22c55e]/40 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                  Submit Another
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ═══════════════════════════════════════════════════════
  // MAIN FORM
  // ═══════════════════════════════════════════════════════
  return (
    <>
      <SEO
        title="Submit Review | SafeApply.AI"
        description="Submit an anonymous employer review — interview process, culture, compensation, and recruiter responsiveness."
        path="/dashboard/review"
        noindex
      />

      <div className="w-full pb-16">

        {/* ── Telemetry ribbon ────────────────────────── */}
        <div className="w-full border-b border-[#1A1A1A] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="font-mono text-[11px] text-[#22c55e] tracking-wider uppercase">
              Community Telemetry
            </span>
            <span className="text-[#353534] font-mono text-[11px] hidden sm:inline">|</span>
            <span className="font-mono text-[11px] text-[#737373] truncate">
              Anonymous submission — identity never public
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-[#22c55e]">
              <span className="material-symbols-outlined text-[14px]">
                verified_user
              </span>
              Anonymous
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-[#737373]">
              <span className="material-symbols-outlined text-[14px]">
                schedule
              </span>
              ~5 minutes
            </span>
          </div>
        </div>

        {/* ── Page header ─────────────────────────────── */}
        <div className="px-4 sm:px-6 pt-6 pb-5 border-b border-[#1A1A1A]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[#22c55e] font-mono text-[11px] uppercase tracking-wider mb-2">
                <span className="material-symbols-outlined text-[16px]">
                  terminal
                </span>
                Secure submission
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
                Submit Employer Review
              </h1>
              <p className="text-sm text-[#737373] leading-relaxed">
                Share your interview experience, recruiter responsiveness, culture
                signals, and compensation telemetry. Reviews are anonymous and
                moderated for authenticity.
              </p>
            </div>

            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-3 flex items-center gap-3 self-start md:self-auto shrink-0">
              <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e]">
                <span className="material-symbols-outlined text-[22px]">
                  rewards
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#22c55e]">
                  Community Impact
                </span>
                <span className="text-sm text-white font-semibold">
                  Helps thousands decide
                </span>
                <span className="text-[11px] text-[#737373]">
                  Moderated anonymously
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main grid ───────────────────────────────── */}
        <div className="px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ══════════ LEFT COLUMN (8/12) ══════════ */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* SECTION 1 — Company & Role */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <SectionHeader
                code="SEC-01"
                title="Target Organization & Role"
                right={
                  <span className="text-[11px] text-[#737373] whitespace-nowrap">
                    Required
                  </span>
                }
              />

              <div className="flex flex-col gap-5">
                {/* Company input */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="company-name"
                    className="text-sm font-medium text-white"
                  >
                    Company Name <span className="text-[#22c55e]">*</span>
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    value={form.company_name}
                    onChange={(e) => update('company_name', e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Stripe, Linear, Datadog…"
                    className="w-full h-10 px-3 rounded-lg bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                  />
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[11px] text-[#737373]">
                      Quick select:
                    </span>
                    {COMPANY_CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => update('company_name', c)}
                        className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                          form.company_name === c
                            ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/40'
                            : 'bg-[#1c1b1b] hover:bg-[#2a2a2a] text-[#737373] hover:text-white border-[#1A1A1A]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Role title */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="role-title"
                    className="text-sm font-medium text-white"
                  >
                    Role Title <span className="text-[#22c55e]">*</span>
                  </label>
                  <input
                    id="role-title"
                    type="text"
                    value={form.role_title}
                    onChange={(e) => update('role_title', e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full h-10 px-3 rounded-lg bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                  />
                </div>

                {/* Relationship */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">
                    Your relationship to this company{' '}
                    <span className="text-[#22c55e]">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {RELATIONSHIP_OPTIONS.map((r) => {
                      const active = form.relationship === r.value
                      return (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => update('relationship', r.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e]'
                              : 'bg-black border-[#1A1A1A] text-[#737373] hover:text-white hover:border-[#22c55e]/40'
                          }`}
                        >
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Seniority */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">
                    Seniority Level
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {SENIORITY_OPTIONS.map((s) => {
                      const active = form.seniority === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => update('seniority', s)}
                          className={`py-1.5 px-1 rounded text-center text-[11px] font-medium border transition-colors ${
                            active
                              ? 'bg-[#22c55e] text-black border-[#22c55e] font-semibold'
                              : 'bg-[#1c1b1b] border-[#1A1A1A] text-[#737373] hover:text-white hover:border-[#22c55e]/40'
                          }`}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Work model + location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-white">
                      Work Model
                    </label>
                    <div className="flex gap-2">
                      {(
                        [
                          { k: 'remote', l: 'Remote' },
                          { k: 'hybrid', l: 'Hybrid' },
                          { k: 'onsite', l: 'On-Site' },
                        ] as const
                      ).map((o) => {
                        const active = form.work_model === o.k
                        return (
                          <button
                            key={o.k}
                            type="button"
                            onClick={() => update('work_model', o.k)}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                              active
                                ? 'bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e]'
                                : 'bg-black border-[#1A1A1A] text-[#737373] hover:text-white'
                            }`}
                          >
                            {o.l}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="location"
                      className="text-sm font-medium text-white"
                    >
                      Your Location
                    </label>
                    <input
                      id="location"
                      type="text"
                      value={form.location}
                      onChange={(e) => update('location', e.target.value)}
                      maxLength={100}
                      placeholder="e.g. San Francisco, CA"
                      className="w-full h-10 px-3 rounded-lg bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2 — Ratings & Loop */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <SectionHeader
                code="SEC-02"
                title="Ratings & Interview Loop"
                right={
                  <span className="text-[11px] text-[#737373] whitespace-nowrap">
                    Ratings required
                  </span>
                }
              />

              <div className="flex flex-col gap-5">
                {/* Ratings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <StarRating
                    label="Overall Rating"
                    value={form.overall_rating}
                    onChange={(v) => update('overall_rating', v)}
                    required
                  />
                  <StarRating
                    label="Culture Rating"
                    value={form.culture_rating}
                    onChange={(v) => update('culture_rating', v)}
                    required
                  />
                  <StarRating
                    label="Interview Experience"
                    value={form.interview_rating}
                    onChange={(v) => update('interview_rating', v)}
                    required
                  />
                </div>

                {/* Stage count */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">
                    Total Number of Stages
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => {
                      const active = form.stages_count === n
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => update('stages_count', n)}
                          className={`w-10 h-10 rounded-lg text-sm font-bold border transition-colors ${
                            active
                              ? 'bg-[#22c55e] text-black border-[#22c55e]'
                              : 'bg-[#1c1b1b] border-[#1A1A1A] text-[#737373] hover:text-white hover:border-[#22c55e]/40'
                          }`}
                        >
                          {n === 6 ? '6+' : n}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Stage checklist */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">
                    Encountered Stages{' '}
                    <span className="text-[#737373] font-normal text-xs">
                      (select all that apply)
                    </span>
                  </label>
                  <div className="flex flex-col gap-2">
                    {STAGE_OPTIONS.map((s) => {
                      const checked = form.stages.includes(s.id)
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-[#22c55e]/5 border-[#22c55e]/40'
                              : 'bg-black border-[#1A1A1A] hover:border-[#22c55e]/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStage(s.id)}
                              className="w-4 h-4 accent-[#22c55e] shrink-0"
                            />
                            <span className="text-sm text-white truncate">
                              {s.label}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[#737373] whitespace-nowrap shrink-0 hidden sm:block">
                            {s.meta}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Process sentiment */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">
                    Overall Process Experience
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { k: 'positive', l: 'Positive' },
                        { k: 'neutral', l: 'Neutral' },
                        { k: 'challenging', l: 'Challenging' },
                      ] as const
                    ).map((o) => {
                      const active = form.process_sentiment === o.k
                      return (
                        <button
                          key={o.k}
                          type="button"
                          onClick={() => update('process_sentiment', o.k)}
                          className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-[#22c55e] text-black border-[#22c55e]'
                              : 'bg-[#1c1b1b] border-[#1A1A1A] text-[#737373] hover:text-white'
                          }`}
                        >
                          {o.l}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3 — Recruiter & Recommendation */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <SectionHeader
                code="SEC-03"
                title="Recruiter & Recommendation"
              />

              <div className="flex flex-col gap-5">
                {/* Would recommend */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">
                    Would you recommend this company?{' '}
                    <span className="text-[#22c55e]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { k: 'yes', l: 'Yes', color: '#22c55e' },
                        { k: 'maybe', l: 'Maybe', color: '#EAB308' },
                        { k: 'no', l: 'No', color: '#EF4444' },
                      ] as const
                    ).map((o) => {
                      const active = form.would_recommend === o.k
                      return (
                        <button
                          key={o.k}
                          type="button"
                          onClick={() => update('would_recommend', o.k)}
                          className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                            active
                              ? 'text-black'
                              : 'bg-[#1c1b1b] border-[#1A1A1A] text-[#737373] hover:text-white'
                          }`}
                          style={
                            active
                              ? { backgroundColor: o.color, borderColor: o.color }
                              : undefined
                          }
                        >
                          {o.l}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Response latency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="latency"
                      className="text-sm font-medium text-white"
                    >
                      Recruiter Response Speed
                    </label>
                    <select
                      id="latency"
                      value={form.response_latency}
                      onChange={(e) => update('response_latency', e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors"
                    >
                      {LATENCY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-white">
                      Technical Feedback Provided?
                    </label>
                    <div className="flex gap-2 h-10">
                      <button
                        type="button"
                        onClick={() => update('feedback_given', true)}
                        className={`flex-1 rounded-lg text-xs font-semibold border transition-colors ${
                          form.feedback_given
                            ? 'bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e]'
                            : 'bg-black border-[#1A1A1A] text-[#737373] hover:text-white'
                        }`}
                      >
                        Yes, specific
                      </button>
                      <button
                        type="button"
                        onClick={() => update('feedback_given', false)}
                        className={`flex-1 rounded-lg text-xs font-semibold border transition-colors ${
                          !form.feedback_given
                            ? 'bg-[#22c55e]/15 border-[#22c55e] text-[#22c55e]'
                            : 'bg-black border-[#1A1A1A] text-[#737373] hover:text-white'
                        }`}
                      >
                        No / Template
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 4 — Compensation */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <SectionHeader
                code="SEC-04"
                title="Compensation (Optional)"
                right={
                  <span className="text-[11px] text-[#EAB308] font-mono whitespace-nowrap">
                    OPTIONAL
                  </span>
                }
              />

              <div className="flex flex-col gap-5">
                <label className="flex items-center gap-2 cursor-pointer select-none p-3 bg-black rounded-lg border border-[#1A1A1A]">
                  <input
                    type="checkbox"
                    checked={form.include_comp}
                    onChange={(e) => update('include_comp', e.target.checked)}
                    className="w-4 h-4 accent-[#22c55e] shrink-0"
                  />
                  <span className="text-sm text-white">
                    Include anonymized compensation data to help calibrate community pay parity.
                  </span>
                </label>

                {form.include_comp && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="comp-base"
                          className="text-[11px] font-mono uppercase tracking-wide text-[#737373]"
                        >
                          Base Salary
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] font-mono text-sm">
                            $
                          </span>
                          <input
                            id="comp-base"
                            type="text"
                            inputMode="numeric"
                            value={form.comp_base}
                            onChange={(e) =>
                              update('comp_base', e.target.value.replace(/[^\d,]/g, ''))
                            }
                            placeholder="150,000"
                            className="w-full h-10 pl-7 pr-12 rounded-lg bg-black border border-[#1A1A1A] text-white font-mono text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#353534]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#737373] font-mono">
                            USD
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="comp-equity"
                          className="text-[11px] font-mono uppercase tracking-wide text-[#737373]"
                        >
                          Equity / RSU / yr
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] font-mono text-sm">
                            $
                          </span>
                          <input
                            id="comp-equity"
                            type="text"
                            inputMode="numeric"
                            value={form.comp_equity}
                            onChange={(e) =>
                              update('comp_equity', e.target.value.replace(/[^\d,]/g, ''))
                            }
                            placeholder="0"
                            className="w-full h-10 pl-7 pr-12 rounded-lg bg-black border border-[#1A1A1A] text-white font-mono text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#353534]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#737373] font-mono">
                            /yr
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="comp-bonus"
                          className="text-[11px] font-mono uppercase tracking-wide text-[#737373]"
                        >
                          Sign-on / Bonus
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373] font-mono text-sm">
                            $
                          </span>
                          <input
                            id="comp-bonus"
                            type="text"
                            inputMode="numeric"
                            value={form.comp_bonus}
                            onChange={(e) =>
                              update('comp_bonus', e.target.value.replace(/[^\d,]/g, ''))
                            }
                            placeholder="0"
                            className="w-full h-10 pl-7 pr-12 rounded-lg bg-black border border-[#1A1A1A] text-white font-mono text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#353534]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#737373] font-mono">
                            USD
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Computed total */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-black border border-[#1A1A1A]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#22c55e] text-[20px]">
                          calculate
                        </span>
                        <span className="text-sm text-white">
                          Year-1 Total Compensation
                        </span>
                      </div>
                      <span className="font-mono text-lg font-bold text-[#22c55e]">
                        ${computedTC.toLocaleString('en-US')}{' '}
                        <span className="text-xs text-[#737373] font-normal">
                          USD/yr
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* SECTION 5 — Written Review */}
            <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6">
              <SectionHeader
                code="SEC-05"
                title="Written Review"
                right={
                  <span
                    className={`font-mono text-[11px] whitespace-nowrap ${
                      reviewTooShort ? 'text-[#EAB308]' : 'text-[#737373]'
                    }`}
                  >
                    {reviewChars} / {MAX_REVIEW_CHARS}
                  </span>
                }
              />

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="review-text"
                    className="text-sm font-medium text-white"
                  >
                    Your Review <span className="text-[#22c55e]">*</span>
                  </label>
                  <p className="text-xs text-[#737373]">
                    Be honest but fair. Minimum {MIN_REVIEW_CHARS} characters.
                  </p>
                  <textarea
                    id="review-text"
                    rows={8}
                    value={form.review_text}
                    onChange={(e) => update('review_text', e.target.value)}
                    maxLength={MAX_REVIEW_CHARS}
                    placeholder="Describe your experience — the interview process, team culture, work environment, management, and what stood out (good or bad)."
                    className="w-full p-3 rounded-lg bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors resize-y leading-relaxed placeholder-[#737373]"
                  />
                  {reviewTooShort && (
                    <span className="text-[11px] text-[#EAB308]">
                      {MIN_REVIEW_CHARS - reviewChars} more characters needed
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="interview-process"
                    className="text-sm font-medium text-white"
                  >
                    Interview Process Details{' '}
                    <span className="text-[#737373] font-normal text-xs">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="interview-process"
                    rows={4}
                    value={form.interview_process}
                    onChange={(e) => update('interview_process', e.target.value)}
                    maxLength={2000}
                    placeholder="What rounds did you go through? What topics were covered? Any tips for future candidates?"
                    className="w-full p-3 rounded-lg bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors resize-y leading-relaxed placeholder-[#737373]"
                  />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-black border border-[#1A1A1A] text-xs text-[#737373]">
                  <span className="material-symbols-outlined text-[16px] text-[#22c55e] shrink-0 mt-0.5">
                    privacy_tip
                  </span>
                  <span>
                    Your identity is never shown publicly. Only platform
                    administrators can verify reviews for moderation.
                  </span>
                </div>
              </div>
            </section>

            {/* ACTION DOCK */}
            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.terms_attested}
                  onChange={(e) => update('terms_attested', e.target.checked)}
                  className="w-4 h-4 accent-[#22c55e] mt-0.5 shrink-0"
                />
                <span className="text-sm text-[#737373] leading-relaxed">
                  I attest this review reflects my firsthand experience and
                  contains no confidential information, trade secrets, or
                  personal attacks.
                </span>
              </label>

              {error && (
                <div className="p-3 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 text-sm text-[#EF4444] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    error
                  </span>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2 border-t border-[#1A1A1A]">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-5 py-2.5 rounded-lg bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#1A1A1A] text-white text-sm font-medium transition-colors"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      submitting ? 'animate-spin' : ''
                    }`}
                  >
                    {submitting ? 'sync' : 'send'}
                  </span>
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>

          {/* ══════════ RIGHT COLUMN (4/12) ══════════ */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-20">

            {/* Anonymity card */}
            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e]">
                  <span className="material-symbols-outlined text-[20px]">
                    shield
                  </span>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#22c55e] block">
                    Privacy
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    Anonymous Submission
                  </h3>
                </div>
              </div>
              <p className="text-xs text-[#737373] leading-relaxed mb-3">
                Your identity, email, and browser fingerprint are never
                displayed publicly. Reviews are stored against your user ID
                for moderation only.
              </p>
              <div className="space-y-1.5 font-mono text-[11px] bg-black p-3 rounded-lg border border-[#1A1A1A]">
                <div className="flex justify-between gap-3">
                  <span className="text-[#737373]">Public identity:</span>
                  <span className="text-[#22c55e] font-semibold">
                    ANONYMOUS
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#737373]">Moderation:</span>
                  <span className="text-white">Enabled</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#737373]">Status on submit:</span>
                  <span className="text-[#EAB308]">PENDING</span>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A] mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  Live Preview
                </span>
                <span className="font-mono text-[11px] text-[#22c55e]">
                  PREVIEW
                </span>
              </div>

              <div className="bg-black rounded-lg border border-[#1A1A1A] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white truncate block">
                      {form.company_name.trim() || 'Company Name'}
                    </span>
                    <span className="text-[11px] text-[#737373] block truncate">
                      {form.role_title.trim() || 'Role Title'}
                    </span>
                  </div>
                  {form.seniority && (
                    <span className="px-2 py-0.5 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-semibold whitespace-nowrap">
                      {form.seniority}
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-[#1A1A1A] space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#737373]">Overall:</span>
                    <span className="text-white font-mono">
                      {form.overall_rating > 0
                        ? `${form.overall_rating} / 5`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#737373]">Culture:</span>
                    <span className="text-white font-mono">
                      {form.culture_rating > 0
                        ? `${form.culture_rating} / 5`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#737373]">Interview:</span>
                    <span className="text-white font-mono">
                      {form.interview_rating > 0
                        ? `${form.interview_rating} / 5`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#737373]">Recommend:</span>
                    <span
                      className={`font-mono font-semibold ${
                        form.would_recommend === 'yes'
                          ? 'text-[#22c55e]'
                          : form.would_recommend === 'no'
                          ? 'text-[#EF4444]'
                          : form.would_recommend === 'maybe'
                          ? 'text-[#EAB308]'
                          : 'text-[#737373]'
                      }`}
                    >
                      {form.would_recommend
                        ? form.would_recommend.charAt(0).toUpperCase() +
                          form.would_recommend.slice(1)
                        : '—'}
                    </span>
                  </div>
                  {form.include_comp && computedTC > 0 && (
                    <div className="flex justify-between gap-2 pt-1.5 border-t border-[#1A1A1A]">
                      <span className="text-[#737373]">Total comp:</span>
                      <span className="text-[#22c55e] font-mono font-semibold">
                        ${computedTC.toLocaleString('en-US')}/yr
                      </span>
                    </div>
                  )}
                  {form.stages.length > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[#737373]">Stages:</span>
                      <span className="text-white font-mono">
                        {form.stages_count}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#1A1A1A] text-[10px] font-mono text-[#353534]">
                  Anonymous • Pending moderation
                </div>
              </div>
            </div>

            {/* Rewards card */}
            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373] block mb-3">
                Community Impact
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="material-symbols-outlined text-[#22c55e] text-[16px]">
                      group
                    </span>
                    Help other candidates
                  </span>
                  <span className="font-mono text-[#22c55e] font-semibold">
                    CONFIRMED
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="material-symbols-outlined text-[#22c55e] text-[16px]">
                      verified
                    </span>
                    Moderation review
                  </span>
                  <span className="font-mono text-[#22c55e] font-semibold">
                    24-48 HRS
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-white">
                    <span className="material-symbols-outlined text-[#22c55e] text-[16px]">
                      public
                    </span>
                    Public visibility
                  </span>
                  <span className="font-mono text-[#22c55e] font-semibold">
                    AFTER APPROVAL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-100 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg border shadow-xl bg-[#0D0D0D] text-sm flex items-center gap-2 ${
            toast.kind === 'ok'
              ? 'border-l-4 border-l-[#22c55e] border-[#1A1A1A]'
              : 'border-l-4 border-l-[#EF4444] border-[#1A1A1A]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              toast.kind === 'ok' ? 'text-[#22c55e]' : 'text-[#EF4444]'
            }`}
          >
            {toast.kind === 'ok' ? 'check_circle' : 'error'}
          </span>
          <span className="text-white break-words">{toast.text}</span>
        </div>
      )}
    </>
  )
}