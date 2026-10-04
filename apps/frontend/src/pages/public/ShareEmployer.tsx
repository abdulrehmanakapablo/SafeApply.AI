// FILE: src/pages/public/ShareEmployer.tsx
// ROUTE: /share/employer/:slug
// PURPOSE: A compact, shareable card for one employer (built for links in
//          chats and posts): verification, level, reply rate, ghosting,
//          rating. Every figure links to the page it came from.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import { LevelChip } from '../../components/trust/TrustBits'
import { getEmployerCard, type EmployerCard } from '../../api/growth'
import { Alert, Button, ButtonLink, Card, EmptyState, Icon, Skeleton, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

function Fact({ label, value, to, tone }: { label: string; value: string; to: string; tone?: 'good' | 'bad' }) {
  return (
    <Link to={to} className="group flex flex-col gap-1 p-4 rounded-[8px] bg-ink border border-line hover:border-muted/40 transition-colors">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('text-2xl font-semibold tabular', tone === 'good' && 'text-accent', tone === 'bad' && 'text-danger')}>{value}</span>
    </Link>
  )
}

export default function ShareEmployer() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [d, setD] = useState<EmployerCard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getEmployerCard(slug)
      .then((r) => !cancelled && setD(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Company not found.')))
    return () => {
      cancelled = true
    }
  }, [slug])

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Couldn’t copy. Copy the address bar instead.')
    }
  }

  const c = d?.company
  const s = d?.score
  const pct = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : `${n}%`)
  return (
    <PublicLayout>
      <SEO
        title={c ? `${c.name} on SafeApply: ${c.verified ? 'verified employer' : 'employer reviews'}` : 'Employer | SafeApply.AI'}
        description={c ? `${c.name}: ${c.verified ? `${pct(d?.response_rate)} of applicants get a reply, ${s?.ghost_jobs_90d ?? 0} ghosted jobs in 90 days.` : 'Reviews, salaries and interview experiences.'}` : 'Employer card.'}
        path={`/share/employer/${slug}`}
      />
      <section className="max-w-xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20">
        {error ? (
          <Card padded={false}>
            <EmptyState icon="domain_disabled" title="Company not found" body={error} action={<ButtonLink to="/companies">Browse companies</ButtonLink>} />
          </Card>
        ) : !d || !c ? (
          <Skeleton className="h-96 rounded-[16px]" />
        ) : (
          <Card className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight break-words">{c.name}</h1>
                {c.industry && <p className="text-sm text-muted mt-1">{c.industry}</p>}
              </div>
              {c.trust_level > 0 && <LevelChip level={c.trust_level} />}
            </div>
            <p className={cn('mt-4 inline-flex items-center gap-1.5 text-sm font-medium', c.verified ? 'text-accent' : 'text-muted')}>
              <Icon name={c.verified ? 'verified' : 'help'} className="text-[18px]" />
              {c.verified ? 'Verified employer on SafeApply' : 'Not verified on SafeApply'}
            </p>
            {c.suspended && <Alert className="mt-4">Suspended from posting jobs.</Alert>}
            {d.warning && (
              <Alert tone="warn" className="mt-4">
                {d.warning}
              </Alert>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              {c.verified ? (
                <>
                  <Fact label="Applicants who got a reply" value={pct(d.response_rate)} to={`/companies/${slug}/hiring-record`} tone={d.response_rate !== null ? (d.response_rate >= 70 ? 'good' : d.response_rate < 40 ? 'bad' : undefined) : undefined} />
                  <Fact label="CVs opened" value={pct(s?.opened_pct)} to={`/c/${slug}/ghosting`} />
                  <Fact label="Ghosted jobs, 90 days" value={String(s?.ghost_jobs_90d ?? 0)} to={`/c/${slug}/ghosting`} tone={(s?.ghost_jobs_90d ?? 0) > 0 ? 'bad' : 'good'} />
                  <Fact label="Confirmed hires" value={String(s?.hires_verified ?? 0)} to={`/companies/${slug}/hiring-record`} />
                </>
              ) : (
                <p className="col-span-2 text-sm text-muted">This company hasn’t verified a hiring account, so there’s no record of how it treats applicants yet.</p>
              )}
              <Fact label="Employee rating" value={d.rating ? `${d.rating.avg.toFixed(1)} / 5` : 'No reviews'} to={`/companies/${slug}`} />
              <Fact label="Reviews" value={String(d.rating?.count ?? 0)} to={`/companies/${slug}`} />
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink to={`/companies/${slug}`} iconRight="arrow_forward">
                Full company page
              </ButtonLink>
              <Button variant="secondary" icon="content_copy" onClick={copy}>
                Copy link
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted">Figures come only from activity recorded on SafeApply and refresh hourly.</p>
          </Card>
        )}
      </section>
    </PublicLayout>
  )
}
