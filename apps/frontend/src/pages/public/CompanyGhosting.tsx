// FILE: src/pages/public/CompanyGhosting.tsx
// ROUTE: /c/:slug/ghosting
// PURPOSE: "Does <company> ghost applicants?" answered with recorded data:
//          CV-open rate, 7-day reply rate, no-response rate, flagged jobs.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CompanyShell from '../../components/companies/CompanyShell'
import { GhostFlag } from '../../components/jobs/HiringRecord'
import { getGhosting, type GhostingData } from '../../api/growth'
import { SITE_URL } from '../../components/SEO'
import { Alert, Card, CardHeader, EmptyState, Stat, cn, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

const pctText = (n: number | null | undefined) => (n === null || n === undefined ? 'Not enough data' : `${n}%`)

function verdict(d: GhostingData): { text: string; tone: 'accent' | 'warn' | 'danger' } | null {
  const s = d.score
  if (!s || s.no_response_pct === null || s.opened_pct === null) return null
  if (s.ghost_jobs_90d >= 2 || s.no_response_pct >= 50) return { text: 'Often leaves applicants without an answer.', tone: 'danger' }
  if (s.no_response_pct >= 20 || s.opened_pct < 60) return { text: 'Mixed. Some applicants never hear back.', tone: 'warn' }
  return { text: 'Usually opens CVs and replies.', tone: 'accent' }
}

export default function CompanyGhosting() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [d, setD] = useState<GhostingData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setD(null)
    getGhosting(slug)
      .then((r) => !cancelled && setD(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Company not found.')))
    return () => {
      cancelled = true
    }
  }, [slug])

  const name = d?.company.name || 'This company'
  const v = d ? verdict(d) : null
  const faq = d?.tracked && d.score
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `Does ${name} ghost applicants?`,
            acceptedAnswer: { '@type': 'Answer', text: `On SafeApply, ${name} opened ${pctText(d.score.opened_pct)} of CVs and ${pctText(d.score.no_response_pct)} of applicants got no response. ${d.score.ghost_jobs_90d} jobs were flagged for ghosting in the last 90 days.` },
          },
        ],
        url: `${SITE_URL}/c/${slug}/ghosting`,
      }
    : undefined

  return (
    <CompanyShell
      slug={slug}
      company={d?.company || null}
      error={error}
      heading={`Does ${name} ghost applicants?`}
      intro="Answered only from applications sent through SafeApply: whether CVs were opened, whether people got a reply, and jobs where nobody was looked at."
      seoTitle={`Does ${name} ghost applicants? | SafeApply.AI`}
      seoDescription={`${name} CV-open rate, reply rate and ghosted jobs, from real applications on SafeApply.`}
      path={`/c/${slug}/ghosting`}
      jsonLd={faq}
    >
      {d && !d.tracked ? (
        <Card padded={false}>
          <EmptyState icon="visibility" title="Not tracked yet" body={`${name} hasn’t verified a hiring account on SafeApply, so there’s no record of how it treats applicants. Reviews and salaries may still be available.`} />
        </Card>
      ) : d ? (
        <>
          {d.warning && <Alert tone="warn">Hiring warning: {d.warning}</Alert>}
          {v && (
            <p className={cn('text-lg font-medium', v.tone === 'accent' ? 'text-accent' : v.tone === 'warn' ? 'text-warn' : 'text-danger')}>{v.text}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <Stat label="CVs opened" value={pctText(d.score?.opened_pct)} hint={`${d.score?.applications ?? 0} applications`} />
            </Card>
            <Card>
              <Stat label="Replied within 7 days" value={pctText(d.score?.replied_7d_pct)} />
            </Card>
            <Card>
              <Stat label="Never got a response" value={pctText(d.score?.no_response_pct)} hint="after 21 days" />
            </Card>
            <Card>
              <Stat label="Ghosted jobs (90 days)" value={String(d.score?.ghost_jobs_90d ?? 0)} />
            </Card>
          </div>

          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Flagged jobs" description="3 or more people applied and no CV was opened." className="px-5 pt-5 pb-3" />
            {d.ghost_jobs && d.ghost_jobs.length > 0 ? (
              <ul className="divide-y divide-line border-t border-line">
                {d.ghost_jobs.map((j) => (
                  <li key={j.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{j.title}</p>
                      <p className="text-xs text-muted">
                        Posted {formatDate(j.created_at)} · {j.apps_count} applied · {j.opened_count} opened
                      </p>
                    </div>
                    <GhostFlag />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted">No flagged jobs in the last 12 months.</p>
            )}
          </Card>

          <p className="text-xs text-muted leading-relaxed">
            Based on {d.jobs_tracked ?? 0} jobs from the last 12 months.
            {d.cleared_on_review ? ` ${d.cleared_on_review} flag${d.cleared_on_review === 1 ? ' was' : 's were'} removed after a dispute was accepted.` : ''} See{' '}
            <Link to="/methodology" className="underline underline-offset-4 hover:text-fg">
              how we measure
            </Link>
            . Wrong number?{' '}
            <Link to="/disputes" className="underline underline-offset-4 hover:text-fg">
              Dispute it
            </Link>
            .
          </p>
        </>
      ) : null}
    </CompanyShell>
  )
}
