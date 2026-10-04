// FILE: src/pages/billing/Checkout.tsx
// ROUTE: /billing/checkout
// PURPOSE: Pick how to pay for the plan that matches your account type.
//          The plan comes from your role (server decides too), so nobody
//          can pay for the wrong side.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { PLAN_FEATURES, billingPathFor } from '../../lib/plans'
import { METHOD_LABEL, getBillingConfig, pkr, useBillingStatus, type BillingConfig, type Method, type PlanKey } from '../../api/billing'
import { Alert, Badge, Card, EmptyState, Icon, PageContainer, PageHeader, Skeleton, cn, formatDate } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'

const ROLE_PLAN: Record<string, PlanKey> = { user: 'seeker', freelancer: 'freelancer', client: 'client', recruiter: 'recruiter' }
const METHOD_ICON: Record<Method, string> = { jazzcash: 'smartphone', easypaisa: 'account_balance_wallet', bank: 'account_balance' }

export default function Checkout() {
  const role = useAuthStore((s) => s.user?.role)
  const planKey = ROLE_PLAN[role || '']
  const status = useBillingStatus()
  const [cfg, setCfg] = useState<BillingConfig | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getBillingConfig()
      .then(setCfg)
      .catch(() => setError('Couldn’t load prices. Refresh to try again.'))
  }, [])

  if (role === 'admin' || !planKey) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="verified" title="No plan needed" body="Admin accounts have every feature." />
        </Card>
      </PageContainer>
    )
  }

  const plan = cfg?.plans[planKey]
  const methods = cfg ? (Object.keys(cfg.methods) as Method[]).filter((m) => cfg.methods[m]) : []

  return (
    <>
      <SEO title="Upgrade | SafeApply.AI" description="Upgrade to Pro." path="/billing/checkout" noindex />
      <PageContainer narrow>
        <PageHeader back={{ to: billingPathFor(role), label: 'Plan & billing' }} title={plan ? `Upgrade to ${plan.name}` : 'Upgrade'} description="Each payment unlocks 30 days. Nothing renews by itself." />
        {error && <Alert>{error}</Alert>}
        {status?.pro && status.until && <Alert tone="accent">You’re on Pro until {formatDate(status.until)}. Paying now adds 30 days on top.</Alert>}

        <Card>
          {!plan ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              <div className="flex-1">
                <p className="font-semibold">{plan.name}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {PLAN_FEATURES[planKey].pro.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-muted">
                      <Icon name="check" className="text-[18px] text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="text-3xl font-semibold tabular">{pkr(plan.pkr)}</p>
                <p className="text-xs text-muted">per 30 days in Pakistan</p>
                <p className="mt-2 text-sm text-muted tabular">${cfg!.founding_left > 0 ? plan.founding_usd : plan.usd} / month elsewhere</p>
              </div>
            </div>
          )}
        </Card>

        <section aria-labelledby="pay-h" className="flex flex-col gap-3">
          <h2 id="pay-h" className="text-[15px] font-semibold">Pay in Pakistan</h2>
          {cfg && methods.length === 0 && <Alert tone="warn">Local payments aren’t set up yet. Check back soon.</Alert>}
          <div className="grid sm:grid-cols-3 gap-3">
            {methods.map((m) => (
              <Link key={m} to={`/billing/manual/${m}`} className="group bg-surface border border-line rounded-[var(--radius-card)] p-5 flex flex-col gap-3 hover:border-accent/50 transition-colors">
                <Icon name={METHOD_ICON[m]} className="text-[24px] text-accent" />
                <span className="font-medium group-hover:text-accent transition-colors">{METHOD_LABEL[m]}</span>
                <span className="text-xs text-muted">Send the amount, then enter the transaction ID.</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="card-h" className="flex flex-col gap-3">
          <h2 id="card-h" className="text-[15px] font-semibold">Pay by card</h2>
          <div className={cn('bg-surface border border-line rounded-[var(--radius-card)] p-5 flex items-center gap-4', !cfg?.card_enabled && 'opacity-70')}>
            <Icon name="credit_card" className="text-[24px] text-muted" />
            <div className="flex-1">
              <p className="font-medium">International card</p>
              <p className="text-xs text-muted">For payments in USD from outside Pakistan.</p>
            </div>
            <Badge>{cfg?.card_enabled ? 'Available' : 'Opening soon'}</Badge>
          </div>
        </section>
      </PageContainer>
    </>
  )
}
