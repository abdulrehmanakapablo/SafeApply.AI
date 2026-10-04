// FILE: src/pages/public/Leaderboards.tsx
// ROUTES: /leaderboards (this month, live), /leaderboards/:month (archive)
// PURPOSE: Employers ranked by how they treat applicants. Companies with a
//          ghosting penalty never appear. Nobody can pay to be listed.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { LevelChip } from '../../components/trust/TrustBits'
import { getLeaderboards, type BoardRow, type Leaderboards as Data } from '../../api/progress'
import { Alert, Badge, Card, EmptyState, Icon, Skeleton, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })

function Board({ title, desc, rows, unit }: { title: string; desc: string; rows: BoardRow[]; unit: (r: BoardRow) => string }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-xs text-muted mt-0.5">{desc}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="leaderboard" title="No ranking yet" body="Companies appear once they have enough recorded activity this month." />
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.rank} className="flex items-center gap-4 px-5 py-3">
              <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold tabular shrink-0', r.rank <= 3 ? 'bg-accent text-ink' : 'bg-line text-muted')}>{r.rank}</span>
              <Link to={`/companies/${r.company.slug}/hiring-record`} className="min-w-0 flex-1 font-medium truncate hover:text-accent">
                {r.company.name}
              </Link>
              <LevelChip level={r.company.trust_level} className="hidden sm:inline-flex" />
              <span className="text-sm tabular text-right w-28 shrink-0">{unit(r)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export default function Leaderboards() {
  const { month } = useParams<{ month?: string }>()
  const navigate = useNavigate()
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setD(null)
    getLeaderboards(month)
      .then((r) => setD(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load leaderboards.')))
  }, [month])

  return (
    <AdaptiveLayout>
      <SEO title={`Most responsive employers${d ? `, ${monthName(d.month)}` : ''} | SafeApply.AI`} description="Employers ranked by how fast they reply to applicants and how many hires the people hired confirmed." path={month ? `/leaderboards/${month}` : '/leaderboards'} />
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-20 flex flex-col gap-6">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Employers who show up</h1>
            <p className="mt-3 text-muted max-w-[60ch]">Ranked only by what they did on SafeApply. Companies with a ghosting penalty never appear, and no one can pay to be listed.</p>
          </div>
          {d && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Month</span>
              <select
                value={d.month}
                onChange={(e) => navigate(e.target.value === d.months[0] ? '/leaderboards' : `/leaderboards/${e.target.value}`)}
                className="h-10 px-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm"
              >
                {d.months.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>
        {error && <Alert>{error}</Alert>}
        {d?.live && (
          <p className="text-xs text-muted flex items-center gap-1.5">
            <Badge tone="accent">Live</Badge> This month updates hourly and freezes on the 1st.
          </p>
        )}
        {!d ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-[16px]" />
            <Skeleton className="h-80 rounded-[16px]" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <Board title="Most responsive" desc="Share of applicants answered within 7 days (5+ applications)." rows={d.responsive} unit={(r) => `${r.value}% of ${r.sample}`} />
            <Board title="Most verified hires" desc="Hires confirmed by the person hired." rows={d.verified_hires} unit={(r) => `${r.value} hire${r.value === 1 ? '' : 's'}`} />
          </div>
        )}
        <p className="text-xs text-muted flex items-center gap-1.5">
          <Icon name="info" className="text-[16px]" />
          <Link to="/methodology" className="underline underline-offset-4 hover:text-fg">
            How the numbers are calculated
          </Link>
        </p>
      </section>
    </AdaptiveLayout>
  )
}
