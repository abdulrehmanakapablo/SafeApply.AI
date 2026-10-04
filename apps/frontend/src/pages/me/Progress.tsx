// FILE: src/pages/me/Progress.tsx
// ROUTE: /me/progress
// PURPOSE: Private numbers and a gentle weekly streak. Never shown to
//          anyone else. Rejections are counted plainly: they're normal.

import { useEffect, useState } from 'react'
import SEO from '../../components/SEO'
import { LevelChip } from '../../components/trust/TrustBits'
import { getProgress, type Progress as Data } from '../../api/progress'
import { Alert, ButtonLink, Card, CardHeader, Icon, PageContainer, PageHeader, Skeleton, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function Progress() {
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getProgress()
      .then((r) => setD(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load your progress.')))
  }, [])

  const max = d ? Math.max(1, ...d.weeks) : 1
  const rejected = d?.stats.find((s) => s.label === 'Not selected')?.value ?? 0

  return (
    <>
      <SEO title="My progress | SafeApply.AI" description="Your private progress." path="/me/progress" noindex />
      <PageContainer>
        <PageHeader
          title="My progress"
          description="Only you can see this page."
          actions={
            <ButtonLink to="/me/badges" variant="secondary" icon="military_tech">
              Badges
            </ButtonLink>
          }
        />
        {error && <Alert>{error}</Alert>}
        {!d ? (
          <Skeleton className="h-64 rounded-[16px]" />
        ) : (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="text-[15px] font-semibold">Your numbers</h2>
                {(d.role === 'freelancer' || d.role === 'client') && <LevelChip level={d.trust_level} />}
              </div>
              {d.stats.length === 0 ? (
                <p className="text-sm text-muted">Nothing recorded yet.</p>
              ) : (
                <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
                  {d.stats.map((s) => (
                    <div key={s.label}>
                      <dt className="text-xs text-muted">{s.label}</dt>
                      <dd className="mt-1 text-2xl font-semibold tabular">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {rejected > 0 && <p className="mt-5 text-xs text-muted">Every “not selected” is a real answer, which is more than most job sites give you. It’s part of the process, not a verdict on you.</p>}
            </Card>

            <Card>
              <CardHeader
                title="Last 12 weeks"
                description={d.activity ? `Weeks with ${d.activity}. A gentle nudge, not a race.` : undefined}
                action={
                  d.streak > 0 ? (
                    <span className="inline-flex items-center gap-1 text-sm text-accent">
                      <Icon name="local_fire_department" className="text-[18px]" />
                      <span className="tabular">{d.streak}</span> week{d.streak === 1 ? '' : 's'} in a row
                    </span>
                  ) : undefined
                }
              />
              <div className="flex items-end gap-1.5 h-32" role="img" aria-label={`Activity per week: ${d.weeks.join(', ')}`}>
                {d.weeks.map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                    <div className={cn('w-full rounded-[4px] transition-[height]', n ? 'bg-accent' : 'bg-line')} style={{ height: `${Math.max(4, (n / max) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted">
                <span>12 weeks ago</span>
                <span>This week</span>
              </div>
            </Card>
          </>
        )}
      </PageContainer>
    </>
  )
}
