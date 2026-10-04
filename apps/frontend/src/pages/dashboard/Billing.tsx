// FILE: src/pages/dashboard/Billing.tsx
// ROUTES: /dashboard/billing, /recruiter/billing, /freelancer/billing, /client/billing
// PURPOSE: Plan & billing for whichever side the user is on: current plan,
//          expiry, usage against free caps, pending payments, the plans.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import PlanCards from '../../components/PlanCards'
import { Alert, Badge, ButtonLink, Card, CardHeader, PageContainer, PageHeader, QuotaMeter, Skeleton, formatDate } from '../../components/ui'
import { METHOD_LABEL, getBillingStatus, pkr, type BillingStatus } from '../../api/billing'
import { apiError } from '../../lib/axios'

export default function Billing() {
  const [s, setS] = useState<BillingStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getBillingStatus()
      .then((r) => setS(r.data))
      .catch((e) => setError(apiError(e, 'Couldn’t load your plan.')))
  }, [])

  const admin = s?.role === 'admin'
  const daysLeft = s?.until ? Math.max(0, Math.ceil((new Date(s.until).getTime() - Date.now()) / 86_400_000)) : null
  const maxed = s && !s.pro && s.usage.some((u) => u.limit !== null && u.used >= u.limit)

  return (
    <>
      <SEO title="Plan & billing | SafeApply.AI" description="Your plan, usage and payments." path="/dashboard/billing" noindex />
      <PageContainer>
        <PageHeader
          title="Plan & billing"
          description="What your account includes, what you’ve used, and your payments."
          actions={
            <ButtonLink to="/billing/history" variant="secondary" icon="receipt_long">
              Payment history
            </ButtonLink>
          }
        />
        {error && <Alert>{error}</Alert>}
        {s?.free_ai_paused && <Alert tone="warn">Free AI checks are paused until next month because this month’s free budget is used up. Pro keeps working.</Alert>}
        {maxed && <Alert tone="warn">You’ve used a free allowance. Everything else keeps working and nothing you saved is removed.</Alert>}
        {s?.pending.map((p) => (
          <Alert key={p.id} tone="accent">
            Your {METHOD_LABEL[p.method]} payment of {pkr(p.amount_pkr)} from {formatDate(p.created_at)} is waiting for review. Plans usually activate within a few hours.
          </Alert>
        ))}

        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
          <Card>
            {!s ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">Current plan</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">{admin ? 'Admin' : s.pro ? 'Pro' : 'Free'}</p>
                  </div>
                  <Badge tone={s.pro ? 'accent' : 'neutral'}>{s.pro ? 'Active' : 'Free'}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted leading-relaxed">
                  {admin
                    ? 'Admin accounts have no limits.'
                    : s.pro
                      ? s.until
                        ? `Runs until ${formatDate(s.until)} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left). Paying again adds 30 days on top.`
                        : 'No end date.'
                      : 'Free limits apply. Upgrade any time; each payment covers 30 days.'}
                </p>
                {!admin && (
                  <ButtonLink to="/billing/checkout" className="mt-5 w-full" variant={s.pro ? 'secondary' : 'primary'}>
                    {s.pro ? 'Add 30 days' : 'Upgrade to Pro'}
                  </ButtonLink>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Usage" description={s?.pro ? 'No limits on your plan' : 'Counted across the life of your account'} />
            {!s ? (
              <div className="flex flex-col gap-5">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            ) : s.usage.length === 0 ? (
              <p className="text-sm text-muted">Nothing on your plan is limited.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {s.usage.map((u) => (
                  <QuotaMeter key={u.key} label={u.label} used={u.used} limit={u.limit} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {s?.plan_key && (
          <section aria-labelledby="plans-h" className="flex flex-col gap-4">
            <h2 id="plans-h" className="text-lg font-semibold">
              Plans{' '}
              <Link to={`/pricing?for=${s.plan_key}`} className="text-sm font-normal text-muted hover:text-fg underline-offset-4 hover:underline">
                Compare all
              </Link>
            </h2>
            <PlanCards audience={s.plan_key} />
          </section>
        )}
      </PageContainer>
    </>
  )
}
