// FILE: src/pages/public/CompanyInterviews.tsx
// ROUTE: /c/:slug/interview-process
// PURPOSE: What interviewing at a company looks like: formats, speed,
//          cancellations (recorded) and anonymous experiences (reviews).

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import CompanyShell from '../../components/companies/CompanyShell'
import { getInterviewProcess, type InterviewsData } from '../../api/growth'
import { ButtonLink, Card, CardHeader, Icon, Stat, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

const MODE_LABEL = { video: 'Video', phone: 'Phone', onsite: 'On-site' } as const

export default function CompanyInterviews() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [d, setD] = useState<InterviewsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setD(null)
    getInterviewProcess(slug)
      .then((r) => !cancelled && setD(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Company not found.')))
    return () => {
      cancelled = true
    }
  }, [slug])

  const name = d?.company.name || 'this company'
  const iv = d?.interviews
  const totalModes = iv ? iv.modes.video + iv.modes.phone + iv.modes.onsite : 0
  return (
    <CompanyShell
      slug={slug}
      company={d?.company || null}
      error={error}
      heading={`Interviewing at ${d?.company.name || 'this company'}`}
      intro="Formats and timing come from interviews scheduled on SafeApply. Experiences are written anonymously by people who interviewed."
      seoTitle={`${d?.company.name || 'Company'} interview process | SafeApply.AI`}
      seoDescription={`How ${name} interviews: formats, how long it takes, cancellations and anonymous candidate experiences.`}
      path={`/c/${slug}/interview-process`}
    >
      {d && iv && (
        <>
          {iv.total > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <Stat label="Interviews scheduled" value={iv.total.toLocaleString()} hint="last 12 months" />
                </Card>
                <Card>
                  <Stat label="Apply to interview" value={iv.median_days_to_interview === null ? 'No data' : `${iv.median_days_to_interview} days`} hint="median" />
                </Card>
                <Card>
                  <Stat label="Confirmed held by both sides" value={iv.past ? `${Math.round((iv.held_confirmed / iv.past) * 100)}%` : 'No data'} hint={`${iv.held_confirmed} of ${iv.past}`} />
                </Card>
                <Card>
                  <Stat label="Cancelled by the company" value={String(iv.cancelled_by_company)} />
                </Card>
              </div>
              <Card>
                <CardHeader title="Format" description={iv.median_duration_min ? `Typical length: ${iv.median_duration_min} minutes` : undefined} className="mb-4" />
                <ul className="flex flex-col gap-3">
                  {(Object.keys(MODE_LABEL) as (keyof typeof MODE_LABEL)[]).map((m) => {
                    const pct = totalModes ? Math.round((iv.modes[m] / totalModes) * 100) : 0
                    return (
                      <li key={m} className="grid grid-cols-[80px_1fr_48px] items-center gap-3 text-sm">
                        <span className="text-muted">{MODE_LABEL[m]}</span>
                        <span className="h-2.5 rounded-full bg-line overflow-hidden">
                          <span className="block h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-right tabular">{pct}%</span>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-muted">No interviews have been scheduled through SafeApply yet.</p>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Candidate experiences"
              description={d.reviews.avg_rating !== null ? `Interview rating ${d.reviews.avg_rating} / 5 from ${d.reviews.count} review${d.reviews.count === 1 ? '' : 's'}` : 'No interview ratings yet'}
              action={
                <ButtonLink to="/dashboard/review" size="sm" variant="secondary" icon="rate_review">
                  Share yours
                </ButtonLink>
              }
              className="mb-4"
            />
            {d.reviews.experiences.length === 0 ? (
              <p className="text-sm text-muted">Nobody has described their interview here yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {d.reviews.experiences.map((x, i) => (
                  <li key={i} className="py-4 first:pt-0 last:pb-0">
                    <p className="text-xs text-muted flex flex-wrap items-center gap-2">
                      <span className="text-fg font-medium">{x.role_type || 'Candidate'}</span>
                      <span>{formatDate(x.created_at)}</span>
                      {x.rating > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-warn">
                          <Icon name="star" className="text-[14px]" />
                          {x.rating}
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line break-words">{x.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </CompanyShell>
  )
}
