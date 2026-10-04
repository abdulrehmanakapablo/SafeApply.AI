// FILE: src/pages/me/Badges.tsx
// ROUTE: /me/badges
// PURPOSE: Badges you (or your company) earned, and the ones still open.
//          Badges come only from recorded events and are never sold.

import { useEffect, useState } from 'react'
import SEO from '../../components/SEO'
import { getMyBadges, type EarnedBadge } from '../../api/progress'
import { BADGES } from '../../lib/trust'
import { Alert, Card, CardHeader, Icon, PageContainer, PageHeader, Skeleton, cn, formatDate } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

const FOR: Record<string, string[]> = {
  user: ['researcher', 'first_interview', 'hired'],
  freelancer: ['first_contract', 'zero_late', 'five_star', 'verified_five'],
  client: ['first_hire', 'fast_approver', 'repeat_client'],
  company: ['first_verified_hire', 'ten_verified_hires', 'opens_every_cv', 'answers_everyone'],
}

function Grid({ keys, earned }: { keys: string[]; earned: EarnedBadge[] }) {
  return (
    <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {keys.map((k) => {
        const d = BADGES[k]
        const got = earned.find((e) => e.badge_key === k)
        return (
          <li key={k} className={cn('rounded-[12px] border p-4 flex flex-col gap-2', got ? 'border-accent/40 bg-accent/5' : 'border-line opacity-70')}>
            <Icon name={got ? d.icon : 'lock'} className={cn('text-[26px]', got ? 'text-accent' : 'text-muted')} />
            <p className="text-sm font-semibold">{d.label}</p>
            <p className="text-xs text-muted">{d.desc}</p>
            {got && <p className="text-[11px] text-accent mt-auto">Earned {formatDate(got.earned_at)}</p>}
          </li>
        )
      })}
    </ul>
  )
}

export default function Badges() {
  const role = useAuthStore((s) => s.user?.role) || 'user'
  const [d, setD] = useState<{ user: EarnedBadge[]; company: EarnedBadge[]; company_name: string | null } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getMyBadges()
      .then((r) => setD(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load badges.')))
  }, [])

  return (
    <>
      <SEO title="Badges | SafeApply.AI" description="Your badges." path="/me/badges" noindex />
      <PageContainer>
        <PageHeader back={{ to: '/me/progress', label: 'My progress' }} title="Badges" description="Earned from what actually happened. They can’t be bought." />
        {error && <Alert>{error}</Alert>}
        {!d ? (
          <Skeleton className="h-48 rounded-[16px]" />
        ) : (
          <>
            {FOR[role] && (
              <Card>
                <CardHeader title="Yours" />
                <Grid keys={FOR[role]} earned={d.user} />
              </Card>
            )}
            {(role === 'recruiter' || d.company_name) && (
              <Card>
                <CardHeader title={d.company_name || 'Your company'} description="Shown on your public company page." />
                <Grid keys={FOR.company} earned={d.company} />
              </Card>
            )}
          </>
        )}
      </PageContainer>
    </>
  )
}
