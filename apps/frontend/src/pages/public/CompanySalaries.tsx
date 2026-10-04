// FILE: src/pages/public/CompanySalaries.tsx
// ROUTE: /c/:slug/salaries
// PURPOSE: Pay at a company from two honest sources: ranges the company
//          posted on its jobs, and anonymous reviewer reports (a rounded
//          median, shown only when enough people reported the same role).

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CompanyShell from '../../components/companies/CompanyShell'
import { getSalaries, type SalariesData } from '../../api/growth'
import { formatSalary } from '../../api/recruiter'
import { Badge, ButtonLink, Card, CardHeader, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

const num = (n: number) => Math.round(n).toLocaleString()

export default function CompanySalaries() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [d, setD] = useState<SalariesData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setD(null)
    getSalaries(slug)
      .then((r) => !cancelled && setD(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'Company not found.')))
    return () => {
      cancelled = true
    }
  }, [slug])

  const name = d?.company.name || 'Company'
  return (
    <CompanyShell
      slug={slug}
      company={d?.company || null}
      error={error}
      heading={`${name} salaries`}
      intro="Posted ranges come straight from the company’s job ads. Reported pay comes from anonymous reviews and is shown only when enough people reported the same role."
      seoTitle={`${name} salaries | SafeApply.AI`}
      seoDescription={`Salary ranges ${name} posted and pay reported anonymously by employees and applicants.`}
      path={`/c/${slug}/salaries`}
    >
      {d && (
        <>
          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Posted by the company" description="Every job on SafeApply must show a salary range." className="px-5 pt-5 pb-3" />
            {d.posted.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">No jobs with a salary posted yet.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {d.posted.map((j) => (
                  <li key={j.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="min-w-0 flex-1">
                      {j.status === 'open' ? (
                        <Link to={`/jobs/${j.id}`} className="font-medium hover:text-accent truncate block">
                          {j.title}
                        </Link>
                      ) : (
                        <p className="font-medium truncate">{j.title}</p>
                      )}
                      <p className="text-xs text-muted">Posted {formatDate(j.created_at)}</p>
                    </div>
                    <span className="tabular text-sm">{formatSalary(j.salary_min, j.salary_max, j.currency, j.salary_period)}</span>
                    {j.status === 'open' && <Badge tone="accent">Open</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false} className="overflow-hidden">
            <CardHeader
              title="Reported by people"
              description="Rounded median of the ranges reviewers entered, in the currency they used. Individual figures are never shown."
              action={
                <ButtonLink to="/dashboard/review" size="sm" variant="secondary">
                  Add your pay
                </ButtonLink>
              }
              className="px-5 pt-5 pb-3"
            />
            {d.reported.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Not enough reports yet. A role appears once {d.min_reports} people report it.</p>
            ) : (
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line">
                      <th scope="col" className="text-left font-normal px-5 py-2.5">Role</th>
                      <th scope="col" className="text-right font-normal px-3 py-2.5">Typical pay</th>
                      <th scope="col" className="text-right font-normal px-5 py-2.5">Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular">
                    {d.reported.map((r) => (
                      <tr key={r.role}>
                        <td className="px-5 py-3 font-medium">{r.role}</td>
                        <td className="text-right px-3">{num(r.median)}</td>
                        <td className="text-right px-5 text-muted">{r.reports}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {d.withheld > 0 && <p className="px-5 py-3 border-t border-line text-xs text-muted">{d.withheld} more report{d.withheld === 1 ? ' is' : 's are'} held back until enough people share the same role, to protect who reported.</p>}
          </Card>
        </>
      )}
    </CompanyShell>
  )
}
