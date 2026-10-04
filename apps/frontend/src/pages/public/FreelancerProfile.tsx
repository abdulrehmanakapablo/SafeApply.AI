// FILE: src/pages/public/FreelancerProfile.tsx
// ROUTE: /freelancers/:id
// PURPOSE: Public freelancer profile: headline, skills, rate, finished
//          contracts and reviews from clients. No contact details.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { Rating, Skills } from '../../components/freelance/Bits'
import { BadgeList, LevelChip } from '../../components/trust/TrustBits'
import { Stars } from '../../components/ui/Stars'
import { getFreelancer, money, type PublicFreelancer } from '../../api/freelance'
import { Badge, ButtonLink, Card, CardHeader, EmptyState, Icon, Skeleton, formatDate, initialsOf } from '../../components/ui'
import { apiError } from '../../lib/axios'

const safeHref = (url: string | null) => {
  try {
    const u = new URL(url || '')
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

export default function FreelancerProfile() {
  const { id = '' } = useParams<{ id: string }>()
  const [f, setF] = useState<PublicFreelancer | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getFreelancer(id)
      .then((r) => !cancelled && setF(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Profile not found.')))
    return () => {
      cancelled = true
    }
  }, [id])

  const portfolio = safeHref(f?.portfolio_url ?? null)

  return (
    <AdaptiveLayout>
      <SEO title={`${f?.name || 'Freelancer'} | SafeApply.AI`} description={f?.headline || 'Freelancer profile.'} path={`/freelancers/${id}`} />
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-20 flex flex-col gap-6">
        {error ? (
          <Card padded={false}>
            <EmptyState icon="person_off" title="Profile not found" body={error} action={<ButtonLink to="/projects">Browse projects</ButtonLink>} />
          </Card>
        ) : !f ? (
          <>
            <Skeleton className="h-28 rounded-[16px]" />
            <Skeleton className="h-64 rounded-[16px]" />
          </>
        ) : (
          <>
            <header className="flex flex-col sm:flex-row sm:items-center gap-5">
              <span className="w-20 h-20 rounded-[18px] bg-accent/15 text-accent text-2xl font-semibold flex items-center justify-center shrink-0" aria-hidden>
                {initialsOf(f.name, 'F')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-words">{f.name}</h1>
                  <LevelChip level={f.trust_level} />
                  <Badge tone={f.available ? 'accent' : 'neutral'}>{f.available ? 'Available' : 'Not taking work'}</Badge>
                </div>
                <p className="mt-1 text-muted break-words">{f.headline}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <Rating rating={f.rating} reviews={f.reviews.length} />
                  <span className="tabular">{f.completed} completed contract{f.completed === 1 ? '' : 's'}</span>
                  {f.hourly_rate != null && <span className="tabular text-fg">{money(f.hourly_rate, f.currency)} / hour</span>}
                  {f.location && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="location_on" className="text-[16px]" />
                      {f.location}
                    </span>
                  )}
                </div>
              </div>
              {portfolio && (
                <a href={portfolio} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-sm text-accent hover:underline underline-offset-4 inline-flex items-center gap-1 shrink-0">
                  Portfolio <Icon name="open_in_new" className="text-[16px]" />
                </a>
              )}
            </header>

            <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
              <Card>
                <CardHeader title="About" className="mb-3" />
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line break-words">{f.bio || 'No bio yet.'}</p>
                {f.skills.length > 0 && <Skills skills={f.skills} max={15} className="mt-5" />}
                <BadgeList badges={f.badges} className="mt-5" />
              </Card>
              <Card>
                <CardHeader title="On SafeApply" className="mb-3" />
                <p className="text-sm text-muted">Member since {formatDate(f.member_since)}</p>
              </Card>
            </div>

            {f.verified_work.length > 0 && (
              <Card padded={false}>
                <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Verified work</div>
                <ul className="divide-y divide-line">
                  {f.verified_work.map((w) => (
                    <li key={`${w.source}-${w.id}`} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium break-words">{w.title}</span>
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted">
                        <Icon name="verified" fill className="text-[16px] text-accent" />
                        {w.source === 'safeapply' ? 'Completed on SafeApply' : 'Confirmed by the client'}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card padded={false}>
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Reviews from clients</div>
              {f.reviews.length === 0 ? (
                <EmptyState icon="reviews" title="No reviews yet" body="Reviews appear after a contract is completed." />
              ) : (
                <ul className="divide-y divide-line">
                  {f.reviews.map((r) => (
                    <li key={r.id} className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{r.reviewer}</span>
                        <Stars rating={r.rating} size={14} />
                      </div>
                      <p className="mt-2 text-sm text-muted leading-relaxed whitespace-pre-line break-words">{r.comment}</p>
                      <p className="mt-2 text-xs text-muted">{formatDate(r.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </section>
    </AdaptiveLayout>
  )
}
