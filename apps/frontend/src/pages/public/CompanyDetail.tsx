// FILE: src/pages/public/CompanyDetail.tsx
// ROUTE: /companies/:slug
// BACKEND: GET /api/reviews/companies/:slug
//          GET /api/reviews/companies/:slug/reviews?page
//          POST /api/reviews/:id/helpful
// Everything shown comes from the API. Reviewer identity is never shown.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CompanyTabs from '../../components/companies/CompanyTabs'
import SEO, { SITE_URL } from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { Reveal } from '../../components/motion/Reveal'
import { Alert, Badge, Button, ButtonLink, EmptyState, Icon, Pagination, Select, Skeleton, Tabs, cn, formatDate } from '../../components/ui'
import { Stars } from '../../components/ui/Stars'
import {
  RELATIONSHIP_LABEL,
  getCompany,
  getCompanyReviews,
  markReviewHelpful,
  type CompanyListItem,
  type CompanyReview,
} from '../../api/reviews'
import { useIsAuthed } from '../../store/authStore'
import { ResponseRate } from '../../components/jobs/JobBits'
import { RecordGrid } from '../../components/jobs/HiringRecord'
import { BadgeList, LevelChip } from '../../components/trust/TrustBits'
import { WORK_MODE_LABEL } from '../../api/recruiter'
import { apiError } from '../../lib/axios'

type Filter = 'all' | 'interview' | 'salary'
type Sort = 'recent' | 'helpful' | 'high' | 'low'

const HELPFUL_KEY = 'sa_helpful_reviews'

function readHelpful(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HELPFUL_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function money(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export default function CompanyDetail() {
  const { slug = '' } = useParams<{ slug: string }>()
  const authed = useIsAuthed()
  const navigate = useNavigate()
  const [company, setCompany] = useState<CompanyListItem | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [helpful, setHelpful] = useState<string[]>(readHelpful)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    getCompany(slug)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) setCompany(res.data)
        else setNotFound(true)
      })
      .catch((err) => {
        if (cancelled) return
        if ((err as { response?: { status?: number } })?.response?.status === 404) setNotFound(true)
        else setError(apiError(err, 'Couldn’t load this company.'))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    setReviewsLoading(true)
    getCompanyReviews(slug, { page })
      .then((res) => {
        if (cancelled) return
        setReviews(Array.isArray(res.data) ? res.data : [])
        setTotalPages(res.total_pages || 1)
      })
      .catch(() => !cancelled && setReviews([]))
      .finally(() => !cancelled && setReviewsLoading(false))
    return () => {
      cancelled = true
    }
  }, [slug, page])

  const visible = useMemo(() => {
    let list = reviews
    if (filter === 'interview') list = list.filter((r) => r.interview_process?.trim())
    if (filter === 'salary') list = list.filter((r) => r.salary_min || r.salary_max)
    const sorted = [...list]
    if (sort === 'helpful') sorted.sort((a, b) => b.helpful_count - a.helpful_count)
    if (sort === 'high') sorted.sort((a, b) => b.overall_rating - a.overall_rating)
    if (sort === 'low') sorted.sort((a, b) => a.overall_rating - b.overall_rating)
    return sorted
  }, [reviews, filter, sort])

  const recommend = useMemo(() => {
    // Only meaningful when every review is loaded on one page.
    if (totalPages > 1 || reviews.length < 3) return null
    const yes = reviews.filter((r) => r.would_recommend === 'yes').length
    return Math.round((yes / reviews.length) * 100)
  }, [reviews, totalPages])

  async function onHelpful(id: string) {
    if (helpful.includes(id)) return
    // Votes need an account (stops scripted vote stuffing).
    if (!authed) {
      navigate(`/login?from=${encodeURIComponent(`/companies/${slug}`)}`)
      return
    }
    const next = [...helpful, id]
    setHelpful(next)
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, helpful_count: r.helpful_count + 1 } : r)))
    try {
      localStorage.setItem(HELPFUL_KEY, JSON.stringify(next.slice(-500)))
    } catch {
      /* ignore */
    }
    try {
      await markReviewHelpful(id)
    } catch {
      /* optimistic; ignore */
    }
  }

  const reviewHref = authed
    ? `/dashboard/review?company=${encodeURIComponent(company?.name || '')}`
    : `/signup?redirect=${encodeURIComponent(`/dashboard/review?company=${company?.name || ''}`)}`

  if (notFound) {
    return (
      <AdaptiveLayout>
        <SEO title="Company not found | SafeApply.AI" description="This company has no reviews yet." path={`/companies/${slug}`} noindex />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <EmptyState
            icon="domain_disabled"
            title="No page for this company yet"
            body="It might be listed under a different name, or nobody has reviewed it so far."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/companies" variant="secondary">
                  Search companies
                </ButtonLink>
                <ButtonLink to={authed ? '/dashboard/review' : '/signup'}>Write the first review</ButtonLink>
              </div>
            }
          />
        </div>
      </AdaptiveLayout>
    )
  }

  const overall = Number(company?.avg_overall_rating) || 0

  return (
    <AdaptiveLayout>
      <SEO
        title={company ? `${company.name} reviews | SafeApply.AI` : 'Company reviews | SafeApply.AI'}
        description={
          company
            ? `${company.total_reviews} anonymous review${company.total_reviews === 1 ? '' : 's'} of ${company.name}: culture, interviews and pay.`
            : 'Anonymous company reviews.'
        }
        path={`/companies/${slug}`}
        jsonLd={
          company && company.total_reviews > 0
            ? {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: company.name,
                url: `${SITE_URL}/companies/${slug}`,
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: overall.toFixed(1),
                  reviewCount: company.total_reviews,
                  bestRating: 5,
                  worstRating: 1,
                },
              }
            : undefined
        }
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-20">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link to="/companies" className="inline-flex items-center gap-1 hover:text-fg transition-colors">
            <Icon name="arrow_back" className="text-[16px]" />
            All companies
          </Link>
        </nav>

        {error && <Alert className="mt-6">{error}</Alert>}

        {/* Header */}
        <header className="mt-8 grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          {loading || !company ? (
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-[14px]" />
              <div className="flex flex-col gap-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ) : (
            <Reveal className="flex items-center gap-4 min-w-0">
              <span className="w-16 h-16 rounded-[14px] bg-surface border border-line flex items-center justify-center text-2xl font-semibold shrink-0" aria-hidden>
                {company.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight break-words flex flex-wrap items-center gap-2">
                  {company.name}
                  {company.verified && (
                    <span title="Verified company" className="inline-flex">
                      <Icon name="verified" fill className="text-[24px] text-accent" />
                      <span className="sr-only">Verified company</span>
                    </span>
                  )}
                </h1>
                <p className="text-muted mt-1">
                  {company.industry ? `${company.industry} · ` : ''}
                  {company.total_reviews} review{company.total_reviews === 1 ? '' : 's'}
                </p>
                {company.verified && (
                  <p className="mt-1.5">
                    <ResponseRate rate={company.response_rate ?? null} sample={company.response_sample ?? 0} />
                  </p>
                )}
              </div>
            </Reveal>
          )}
          <ButtonLink to={reviewHref} icon="rate_review" className="justify-self-start lg:justify-self-end">
            Write a review
          </ButtonLink>
        </header>

        {company && (
          <div className="mt-8">
            <CompanyTabs slug={company.slug} verified={!!company.verified} />
          </div>
        )}

        {company?.verified && (
          <Reveal delay={0.04} className="mt-8">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold">Hiring record</h2>
              <Link to={`/companies/${company.slug}/hiring-record`} className="text-sm text-muted hover:text-fg underline-offset-4 hover:underline">
                Every job
              </Link>
            </div>
            {company.ghost_warning && <Alert tone="warn" className="mb-3">This company has a hiring warning for repeatedly not opening applications.</Alert>}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <LevelChip level={company.trust_level ?? 0} />
              <BadgeList badges={company.badges ?? []} />
            </div>
            <RecordGrid score={company.record ?? null} />
          </Reveal>
        )}

        {/* Scores */}
        {company && (
          <Reveal delay={0.05}>
            <dl className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-[var(--radius-card)] overflow-hidden">
              <Score label="Overall" value={overall} big />
              <Score label="Culture" value={Number(company.avg_culture_rating) || 0} />
              <Score label="Interview experience" value={Number(company.avg_interview_rating) || 0} />
              <div className="bg-ink p-5 sm:p-6">
                <dt className="text-sm text-muted">Would recommend</dt>
                <dd className="mt-2 text-[28px] font-semibold tabular leading-none">{recommend === null ? '-' : `${recommend}%`}</dd>
                <dd className="mt-2 text-xs text-muted">{recommend === null ? 'Shown once there are 3+ reviews' : `of ${reviews.length} reviewers`}</dd>
              </div>
            </dl>
          </Reveal>
        )}

        {company?.verified && (company.about || company.open_jobs?.length) ? (
          <Reveal delay={0.08} className="mt-8 grid lg:grid-cols-2 gap-6">
            {company.about && (
              <div className="bg-surface border border-line rounded-[var(--radius-card)] p-5">
                <h2 className="text-[15px] font-semibold">About</h2>
                <p className="mt-2 text-sm text-muted leading-relaxed whitespace-pre-line break-words">{company.about}</p>
              </div>
            )}
            {!!company.open_jobs?.length && (
              <div className="bg-surface border border-line rounded-[var(--radius-card)] p-5">
                <h2 className="text-[15px] font-semibold">Open jobs</h2>
                <ul className="mt-2 divide-y divide-line">
                  {company.open_jobs.map((j) => (
                    <li key={j.id}>
                      <Link to={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-2.5 group">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate group-hover:text-accent transition-colors">{j.title}</span>
                          <span className="block text-xs text-muted">{[WORK_MODE_LABEL[j.work_mode as keyof typeof WORK_MODE_LABEL], j.location].filter(Boolean).join(' · ')}</span>
                        </span>
                        <Icon name="chevron_right" className="text-[18px] text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Reveal>
        ) : null}

        {/* Reviews */}
        <section className="mt-14" aria-labelledby="reviews-h">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 id="reviews-h" className="text-xl font-semibold tracking-tight">
              Reviews
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs<Filter>
                label="Filter reviews"
                value={filter}
                onChange={setFilter}
                items={[
                  { value: 'all', label: 'All' },
                  { value: 'interview', label: 'Interview notes' },
                  { value: 'salary', label: 'Pay' },
                ]}
              />
              <Select
                aria-label="Sort reviews"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                options={[
                  { value: 'recent', label: 'Newest' },
                  { value: 'helpful', label: 'Most helpful' },
                  { value: 'high', label: 'Highest rated' },
                  { value: 'low', label: 'Lowest rated' },
                ]}
                wrapClassName="w-40"
                className="h-10"
              />
            </div>
          </div>

          <div className="mt-6">
            {reviewsLoading ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 flex flex-col gap-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-[var(--radius-card)] border border-line bg-surface">
                <EmptyState
                  icon="forum"
                  title={filter === 'all' ? 'No approved reviews yet' : 'Nothing matches this filter'}
                  body={filter === 'all' ? 'New reviews appear after moderation.' : 'Switch back to All to see every review.'}
                  action={
                    filter === 'all' ? (
                      <ButtonLink to={reviewHref} variant="secondary">
                        Write a review
                      </ButtonLink>
                    ) : (
                      <Button variant="secondary" onClick={() => setFilter('all')}>
                        Show all
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {visible.map((r, i) => (
                  <Reveal as="li" key={r.id} delay={Math.min(i, 6) * 0.03}>
                    <ReviewCard r={r} helpful={helpful.includes(r.id)} onHelpful={() => onHelpful(r.id)} />
                  </Reveal>
                ))}
              </ul>
            )}
            <div className="mt-8">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </div>
        </section>

        <p className="mt-12 text-xs text-muted leading-relaxed max-w-[70ch]">
          Reviews are the opinions of individual members. SafeApply moderates for abuse and personal information but doesn’t verify every claim.
        </p>
      </div>
    </AdaptiveLayout>
  )
}

function Score({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className="bg-ink p-5 sm:p-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={cn('mt-2 font-semibold tabular leading-none', big ? 'text-[34px]' : 'text-[28px]')}>{value ? value.toFixed(1) : '-'}</dd>
      <dd className="mt-2">
        <Stars rating={value} size={14} />
      </dd>
    </div>
  )
}

function ReviewCard({ r, helpful, onHelpful }: { r: CompanyReview; helpful: boolean; onHelpful: () => void }) {
  const [open, setOpen] = useState(false)
  const long = r.review_text.length > 420
  const text = open || !long ? r.review_text : `${r.review_text.slice(0, 400).trimEnd()}…`
  const rec = r.would_recommend === 'yes' ? { tone: 'accent' as const, label: 'Recommends' } : r.would_recommend === 'no' ? { tone: 'danger' as const, label: 'Doesn’t recommend' } : { tone: 'neutral' as const, label: 'Unsure' }

  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Stars rating={r.overall_rating} />
            <span className="text-sm font-semibold tabular">{Number(r.overall_rating).toFixed(1)}</span>
          </div>
          <p className="mt-2 font-semibold break-words">{r.role_type}</p>
          <p className="text-sm text-muted mt-0.5">
            {RELATIONSHIP_LABEL[r.relationship] || 'Member'} · <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={rec.tone}>{rec.label}</Badge>
          {(r.salary_min || r.salary_max) && (
            <Badge>
              Pay {r.salary_min ? money(r.salary_min) : '?'}
              {r.salary_max ? ` to ${money(r.salary_max)}` : '+'}
            </Badge>
          )}
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-fg/85 whitespace-pre-line break-words">{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-sm text-accent hover:underline">
          {open ? 'Show less' : 'Read the full review'}
        </button>
      )}

      {r.interview_process?.trim() && (
        <div className="mt-5 rounded-[10px] bg-ink/60 border border-line p-4">
          <p className="text-xs text-muted mb-1.5">Interview process</p>
          <p className="text-sm leading-relaxed text-fg/85 whitespace-pre-line break-words">{r.interview_process}</p>
        </div>
      )}

      {r.reply && (
        <div className="mt-5 border-l-2 border-accent/50 pl-4">
          <p className="text-xs text-accent font-medium">Response from the company</p>
          <p className="mt-1 text-sm leading-relaxed text-fg/85 whitespace-pre-line break-words">{r.reply.body}</p>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex gap-4 text-muted tabular">
          <span>Culture {r.culture_rating}/5</span>
          <span>Interview {r.interview_rating}/5</span>
        </div>
        <button
          type="button"
          onClick={onHelpful}
          disabled={helpful}
          aria-pressed={helpful}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border transition-colors',
            helpful ? 'border-accent/40 text-accent' : 'border-line text-muted hover:text-fg hover:border-muted/60',
          )}
        >
          <Icon name="thumb_up" fill={helpful} className="text-[16px]" />
          Helpful <span className="tabular">{r.helpful_count}</span>
        </button>
      </div>
    </article>
  )
}
