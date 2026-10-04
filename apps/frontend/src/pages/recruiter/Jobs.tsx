// FILE: src/pages/recruiter/Jobs.tsx
// ROUTE: /recruiter/jobs

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import VerificationBanner from '../../components/recruiter/VerificationBanner'
import { useCompany } from './useCompany'
import { listMyJobs, formatSalary, type Job, type JobStatus } from '../../api/recruiter'
import { Alert, Badge, ButtonLink, Card, EmptyState, PageContainer, PageHeader, SkeletonRows, Tabs, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

const TONE = { open: 'accent', draft: 'neutral', paused: 'warn', closed: 'neutral' } as const
type Filter = 'all' | JobStatus

export default function RecruiterJobs() {
  const { company, loading: cLoading } = useCompany()
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (!company) return
    listMyJobs()
      .then((r) => setJobs(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load jobs.')))
  }, [company])

  const shown = useMemo(() => (jobs || []).filter((j) => filter === 'all' || j.status === filter), [jobs, filter])
  const count = (s: JobStatus) => (jobs || []).filter((j) => j.status === s).length

  return (
    <>
      <SEO title="Jobs | Recruiter | SafeApply.AI" description="Your jobs." path="/recruiter/jobs" noindex />
      <PageContainer>
        <PageHeader
          title="Jobs"
          description="Open jobs stay public while you keep them active. 60 days without activity takes them down."
          actions={
            company && (
              <ButtonLink to="/recruiter/jobs/new" icon="add">
                Post a job
              </ButtonLink>
            )
          }
        />
        {!cLoading && <VerificationBanner company={company} />}
        {error && <Alert>{error}</Alert>}
        {company && (
          <>
            <Tabs
              label="Filter jobs"
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'All', count: jobs?.length },
                { value: 'open', label: 'Open', count: count('open') },
                { value: 'draft', label: 'Drafts', count: count('draft') },
                { value: 'paused', label: 'Paused', count: count('paused') },
                { value: 'closed', label: 'Closed', count: count('closed') },
              ]}
              className="self-start"
            />
            <Card padded={false} className="overflow-hidden">
              {!jobs ? (
                <div className="p-5">
                  <SkeletonRows rows={4} />
                </div>
              ) : shown.length === 0 ? (
                <EmptyState icon="work" title={jobs.length ? 'Nothing here' : 'No jobs yet'} body={jobs.length ? undefined : 'Post a job with a salary range. Drafts are fine while you’re being verified.'} action={!jobs.length && <ButtonLink to="/recruiter/jobs/new">Post a job</ButtonLink>} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted border-b border-line">
                        <th scope="col" className="font-medium px-5 py-3">Job</th>
                        <th scope="col" className="font-medium px-3 py-3 hidden md:table-cell">Salary</th>
                        <th scope="col" className="font-medium px-3 py-3">Applicants</th>
                        <th scope="col" className="font-medium px-3 py-3">Status</th>
                        <th scope="col" className="px-3 py-3 w-16"><span className="sr-only">Edit</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {shown.map((j) => (
                        <tr key={j.id} className="group hover:bg-line/30 transition-colors">
                          <td className="px-5 py-3 max-w-[320px]">
                            <Link to={`/recruiter/jobs/${j.id}`} className="block min-w-0">
                              <span className="block font-medium truncate group-hover:text-accent transition-colors">{j.title}</span>
                              <span className="block text-xs text-muted">Updated {relativeDays(j.last_activity_at)}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-muted tabular hidden md:table-cell whitespace-nowrap">{formatSalary(j.salary_min, j.salary_max, j.currency, j.salary_period)}</td>
                          <td className="px-3 py-3 tabular whitespace-nowrap">
                            {j.applicants}
                            {j.new_applicants ? <span className="ml-2 text-xs text-accent">{j.new_applicants} new</span> : null}
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={TONE[j.status]}>{j.status}</Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Link to={`/recruiter/jobs/${j.id}/edit`} className="text-xs text-muted hover:text-fg underline-offset-4 hover:underline">
                              Edit
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </PageContainer>
    </>
  )
}
