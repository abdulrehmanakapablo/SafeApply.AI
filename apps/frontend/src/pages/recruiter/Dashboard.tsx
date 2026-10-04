// FILE: src/pages/recruiter/Dashboard.tsx
// ROUTE: /recruiter
// BACKEND: GET /api/recruiter/company, /stats, /jobs

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLeaderboards, type BoardRow } from '../../api/progress'
import SEO from '../../components/SEO'
import VerificationBanner from '../../components/recruiter/VerificationBanner'
import { useCompany } from './useCompany'
import { getRecruiterStats, listMyJobs, type Job, type RecruiterStats } from '../../api/recruiter'
import { useAuthStore } from '../../store/authStore'
import { Alert, Badge, ButtonLink, Card, CardHeader, EmptyState, Icon, PageContainer, PageHeader, SkeletonRows, Stat, cn, relativeDays } from '../../components/ui'

const STATUS_TONE = { open: 'accent', draft: 'neutral', paused: 'warn', closed: 'neutral' } as const

export default function RecruiterDashboard() {
  const name = useAuthStore((s) => s.user?.full_name?.split(' ')[0])
  const { company, loading: companyLoading } = useCompany()
  const [stats, setStats] = useState<RecruiterStats | null>(null)
  const [jobs, setJobs] = useState<Job[] | null>(null)

  useEffect(() => {
    if (!company) return
    let cancelled = false
    Promise.allSettled([getRecruiterStats(), listMyJobs()]).then(([s, j]) => {
      if (cancelled) return
      if (s.status === 'fulfilled') setStats(s.value.data)
      setJobs(j.status === 'fulfilled' ? j.value.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [company])

  const verified = company?.verification_status === 'verified'
  const [rank, setRank] = useState<{ responsive?: number; hires?: number } | null>(null)
  useEffect(() => {
    if (!company?.slug || company.verification_status !== 'verified') return
    getLeaderboards()
      .then((r) => {
        const find = (rows: BoardRow[]) => rows.find((x) => x.company.slug === company.slug)?.rank
        setRank({ responsive: find(r.data.responsive), hires: find(r.data.verified_hires) })
      })
      .catch(() => {})
  }, [company?.slug, company?.verification_status])

  return (
    <>
      <SEO title="Recruiter overview | SafeApply.AI" description="Your hiring at a glance." path="/recruiter" noindex />
      <PageContainer>
        <PageHeader
          title={name ? `Hi, ${name}` : 'Overview'}
          description={company ? company.name : 'Hire with a verified profile and a public response rate.'}
          actions={
            company && (
              <ButtonLink to="/recruiter/jobs/new" icon="add">
                Post a job
              </ButtonLink>
            )
          }
        />

        {!companyLoading && <VerificationBanner company={company} />}
        {rank && (rank.responsive || rank.hires) && (
          <Alert tone="accent">
            {rank.responsive && `#${rank.responsive} most responsive employer this month. `}
            {rank.hires && `#${rank.hires} for verified hires. `}
            <Link to="/leaderboards" className="underline underline-offset-4">
              See leaderboards
            </Link>
          </Alert>
        )}

        {company && (
          <Card>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <Stat label="Open jobs" value={stats ? stats.open_jobs : '–'} hint={stats ? `${stats.total_jobs} in total` : undefined} />
              <Stat label="New applicants" value={stats ? stats.new_applicants : '–'} hint="Waiting for a first look" />
              <Stat
                label="Overdue"
                value={<span className={cn(stats && stats.overdue > 0 && 'text-warn')}>{stats ? stats.overdue : '–'}</span>}
                hint="No reply after 7 days"
              />
              <Stat
                label="Response rate"
                value={stats?.response_rate != null ? `${stats.response_rate}%` : '–'}
                hint={stats?.response_rate == null ? 'Shown publicly once you have data' : 'Shown on your public profile'}
              />
            </div>
          </Card>
        )}

        {company && (
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
            <Card>
              <CardHeader
                title="Your jobs"
                action={
                  <ButtonLink to="/recruiter/jobs" size="sm" variant="secondary">
                    All jobs
                  </ButtonLink>
                }
              />
              {!jobs ? (
                <SkeletonRows rows={3} />
              ) : jobs.length === 0 ? (
                <EmptyState
                  icon="work"
                  title="No jobs yet"
                  body={verified ? 'Post your first job. Salary range is required, and that’s why candidates trust it.' : 'Draft a job now. It goes live when verification completes.'}
                  action={<ButtonLink to="/recruiter/jobs/new">Post a job</ButtonLink>}
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-line -my-3">
                  {jobs.slice(0, 6).map((j) => (
                    <li key={j.id}>
                      <Link to={`/recruiter/jobs/${j.id}`} className="group flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{j.title}</p>
                          <p className="text-xs text-muted">Updated {relativeDays(j.last_activity_at)}</p>
                        </div>
                        {j.new_applicants ? <Badge tone="accent">{j.new_applicants} new</Badge> : null}
                        <span className="text-xs text-muted tabular w-20 text-right">{j.applicants} applicant{j.applicants === 1 ? '' : 's'}</span>
                        <Badge tone={STATUS_TONE[j.status]}>{j.status}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="How SafeApply works for employers" />
              <ul className="flex flex-col gap-4 text-sm">
                {[
                  ['verified', 'Verified badge', 'Candidates see a person checked your company.'],
                  ['payments', 'Salary on every job', 'Required. Serious applicants filter on it.'],
                  ['schedule', 'Reply within 14 days', 'Your response rate is public. Every stage change counts as a reply.'],
                  ['autorenew', 'No ghost jobs', 'Jobs untouched for 60 days come down automatically.'],
                ].map(([icon, title, body]) => (
                  <li key={title} className="flex gap-3">
                    <Icon name={icon} className="text-[20px] text-accent shrink-0" />
                    <span>
                      <span className="block font-medium">{title}</span>
                      <span className="block text-muted text-[13px] leading-relaxed">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}
      </PageContainer>
    </>
  )
}
