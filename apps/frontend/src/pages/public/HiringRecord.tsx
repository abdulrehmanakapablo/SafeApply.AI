// FILE: src/pages/public/HiringRecord.tsx
// ROUTE: /companies/:slug/hiring-record
// PURPOSE: A company's public Hiring Record: the scores and, under them,
//          every job's facts (applicants, CVs opened, replies, outcome).

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import CompanyTabs from '../../components/companies/CompanyTabs'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { GhostFlag, RecordGrid } from '../../components/jobs/HiringRecord'
import { OUTCOME_LABEL, getCompanyRecord, type CompanyRecord } from '../../api/recruiter'
import { Alert, Badge, ButtonLink, Card, EmptyState, Skeleton, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function HiringRecord() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [r, setR] = useState<CompanyRecord | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getCompanyRecord(slug)
      .then((x) => !cancelled && setR(x.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Company not found.')))
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <AdaptiveLayout>
      <SEO
        title={r ? `${r.company.name} hiring record | SafeApply.AI` : 'Hiring record | SafeApply.AI'}
        description={r ? `Does ${r.company.name} open CVs and reply to applicants? Verified numbers from applications on SafeApply.` : 'Company hiring record.'}
        path={`/companies/${slug}/hiring-record`}
      />
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-20 flex flex-col gap-6">
        {error ? (
          <Card padded={false}>
            <EmptyState icon="domain_disabled" title="No hiring record" body={error} action={<ButtonLink to="/companies">Browse companies</ButtonLink>} />
          </Card>
        ) : !r ? (
          <>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-28 rounded-[16px]" />
            <Skeleton className="h-64 rounded-[16px]" />
          </>
        ) : (
          <>
            <header>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight break-words">{r.company.name}: hiring record</h1>
              <p className="mt-2 text-muted max-w-[60ch]">What this company actually did with applications sent through SafeApply. Nothing here is self-reported.</p>
            </header>
            <CompanyTabs slug={slug} />
            {r.company.suspended && <Alert>This company is suspended from posting jobs.</Alert>}
            {r.warning && <Alert tone="warn">Hiring warning: {r.warning}</Alert>}
            <RecordGrid score={r.score} />

            <Card padded={false} className="overflow-hidden">
              <div className="px-5 h-12 flex items-center border-b border-line text-[15px] font-semibold">Jobs</div>
              {r.jobs.length === 0 ? (
                <EmptyState icon="work_off" title="No jobs yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted border-b border-line">
                        <th scope="col" className="font-medium px-5 py-3">Job</th>
                        <th scope="col" className="font-medium px-3 py-3 text-right">Applied</th>
                        <th scope="col" className="font-medium px-3 py-3 text-right">CVs opened</th>
                        <th scope="col" className="font-medium px-3 py-3 text-right">Replied</th>
                        <th scope="col" className="font-medium px-5 py-3">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {r.jobs.map((j) => (
                        <tr key={j.id}>
                          <td className="px-5 py-3 max-w-[280px]">
                            <span className="block font-medium truncate">{j.title}</span>
                            <span className="block text-xs text-muted">Posted {formatDate(j.created_at)}</span>
                          </td>
                          <td className="px-3 py-3 text-right tabular">{j.apps_count}</td>
                          <td className="px-3 py-3 text-right tabular">{j.apps_count ? `${j.opened_count} (${Math.round((j.opened_count / j.apps_count) * 100)}%)` : '–'}</td>
                          <td className="px-3 py-3 text-right tabular">{j.apps_count ? j.replied_count : '–'}</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {j.ghost_flag && <GhostFlag />}
                              {j.status === 'closed' ? <span className="text-xs">{j.outcome ? OUTCOME_LABEL[j.outcome] : 'Closed'}</span> : <Badge tone={j.status === 'open' ? 'accent' : 'neutral'}>{j.status}</Badge>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <p className="text-xs text-muted">
              Numbers refresh every hour. A company that thinks a number is wrong can{' '}
              <Link to="/disputes" className="underline underline-offset-4 hover:text-fg">
                dispute it
              </Link>
              .
            </p>
          </>
        )}
      </section>
    </AdaptiveLayout>
  )
}
