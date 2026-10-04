// FILE: src/pages/public/CompanySearch.tsx
// ROUTE: /companies   (?q= prefills the search, used by JSON-LD SearchAction)
// BACKEND: GET /api/reviews/companies?search&min_rating&page
// Shows only what the API returns. No invented locations, open roles,
// interview difficulty or recommend percentages.

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { Reveal } from '../../components/motion/Reveal'
import { Alert, ButtonLink, EmptyState, Icon, Pagination, Select, Skeleton, cn } from '../../components/ui'
import { Stars } from '../../components/ui/Stars'
import { getCompanies, type CompanyListItem } from '../../api/reviews'
import { useIsAuthed } from '../../store/authStore'
import { apiError } from '../../lib/axios'

const RATINGS = [
  { value: '0', label: 'Any rating' },
  { value: '4', label: '4 stars and up' },
  { value: '3', label: '3 stars and up' },
  { value: '2', label: '2 stars and up' },
]

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

export default function CompanySearch() {
  const [params] = useSearchParams()
  const authed = useIsAuthed()
  const [query, setQuery] = useState(() => params.get('q') || '')
  const [minRating, setMinRating] = useState('0')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<CompanyListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useDebounced(query.trim(), 300)

  useEffect(() => setPage(1), [search, minRating])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getCompanies({ search: search || undefined, min_rating: Number(minRating) || undefined, page })
      .then((res) => {
        if (cancelled) return
        setItems(Array.isArray(res.data) ? res.data : [])
        setTotal(res.total || 0)
        setTotalPages(res.total_pages || 1)
      })
      .catch((err) => !cancelled && setError(apiError(err, 'Couldn’t load companies.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [search, minRating, page])

  // "/" focuses search, like most search-first sites
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const reviewHref = authed ? '/dashboard/review' : '/signup?redirect=%2Fdashboard%2Freview'
  const filtered = Boolean(search) || minRating !== '0'

  return (
    <AdaptiveLayout>
      <SEO
        title="Company reviews | SafeApply.AI"
        description="Anonymous, moderated reviews of employers from people who worked or interviewed there."
        path="/companies"
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-8">
        <Reveal>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">Company reviews</h1>
          <p className="mt-4 text-lg text-muted max-w-[52ch] leading-relaxed">
            Written by people who worked or interviewed there. Anonymous, moderated, and labelled by how the writer knows the company.
          </p>
        </Reveal>

        <div className="mt-10 grid sm:grid-cols-[1fr_13rem] gap-3">
          <div className="relative">
            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-muted pointer-events-none" />
            <label htmlFor="company-search" className="sr-only">
              Search companies
            </label>
            <input
              id="company-search"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by company name"
              autoComplete="off"
              className="w-full h-12 pl-11 pr-12 rounded-[10px] bg-surface border border-line text-[15px] placeholder:text-muted/80 focus:outline-none focus:border-accent transition-colors"
            />
            <kbd className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 h-6 min-w-6 px-1.5 items-center justify-center rounded-[5px] border border-line text-[11px] text-muted">
              /
            </kbd>
          </div>
          <Select aria-label="Minimum rating" value={minRating} onChange={(e) => setMinRating(e.target.value)} options={RATINGS} className="h-12 rounded-[10px] bg-surface" />
        </div>
        <p className="mt-3 text-sm text-muted tabular" aria-live="polite">
          {loading ? 'Searching' : `${total} ${total === 1 ? 'company' : 'companies'}`}
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {error ? (
          <Alert>{error}</Alert>
        ) : loading ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-11 h-11 rounded-[10px]" />
                  <div className="flex-1 flex flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-12 w-full" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface">
            <EmptyState
              icon={filtered ? 'search_off' : 'rate_review'}
              title={filtered ? 'No companies match that' : 'No reviews yet'}
              body={
                filtered
                  ? 'Try a shorter name or lower the rating filter. If the company isn’t here yet, you can be the first to review it.'
                  : 'Be the first. Reviews show up here once they pass moderation.'
              }
              action={
                <ButtonLink to={reviewHref} icon="rate_review">
                  Write a review
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((c, i) => (
                <Reveal as="li" key={c.id} delay={Math.min(i, 8) * 0.03}>
                  <CompanyCard c={c} />
                </Reveal>
              ))}
            </ul>
            <div className="mt-10">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </>
        )}

        <div className="mt-16 rounded-[var(--radius-card)] border border-line p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Interviewed or worked somewhere recently?</h2>
            <p className="mt-1.5 text-sm text-muted max-w-[52ch]">Your review stays anonymous and helps the next person decide whether to apply.</p>
          </div>
          <ButtonLink to={reviewHref} variant="secondary" icon="rate_review" className="shrink-0">
            Write a review
          </ButtonLink>
        </div>
      </section>
    </AdaptiveLayout>
  )
}

function CompanyCard({ c }: { c: CompanyListItem }) {
  const overall = Number(c.avg_overall_rating) || 0
  const rows: Array<[string, number]> = [
    ['Culture', Number(c.avg_culture_rating) || 0],
    ['Interviews', Number(c.avg_interview_rating) || 0],
  ]
  return (
    <Link
      to={`/companies/${c.slug}`}
      className="group h-full rounded-[var(--radius-card)] border border-line bg-surface p-6 flex flex-col gap-5 hover:border-muted/40 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-[10px] bg-line flex items-center justify-center text-[15px] font-semibold shrink-0" aria-hidden>
          {c.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold truncate group-hover:text-accent transition-colors">{c.name}</h3>
          {c.industry && <p className="text-sm text-muted truncate">{c.industry}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Stars rating={overall} />
        <span className="text-sm font-semibold tabular">{overall.toFixed(1)}</span>
        <span className="text-sm text-muted tabular">
          {c.total_reviews} review{c.total_reviews === 1 ? '' : 's'}
        </span>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-line">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={cn('text-sm font-medium tabular mt-0.5', v ? 'text-fg' : 'text-muted')}>{v ? `${v.toFixed(1)} / 5` : 'No data'}</dd>
          </div>
        ))}
      </dl>
    </Link>
  )
}
