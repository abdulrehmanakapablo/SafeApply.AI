// FILE: src/pages/admin/RevenueDashboard.tsx
// ROUTE: /admin/revenue
// PURPOSE: Plan distribution. Payments aren't live, so there is no revenue
//          to report; this page says so instead of drawing sample charts.
// BACKEND: GET /api/admin/users?plan= (counts only)

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { getAdminUsers } from '../../api/admin'
import { Alert, ButtonLink, Card, CardHeader, Icon, PageContainer, PageHeader, Skeleton, Stat } from '../../components/ui'
import { apiError } from '../../lib/axios'

const PLANS = [
  { key: 'free', label: 'Early access (free)', bar: 'bg-muted/60' },
  { key: 'pro', label: 'Pro', bar: 'bg-accent/70' },
  { key: 'lifetime', label: 'Lifetime', bar: 'bg-accent' },
] as const

export default function RevenueDashboard() {
  const reduce = useReducedMotion()
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all(PLANS.map((p) => getAdminUsers({ plan: p.key, page: 1 })))
      .then((res) => {
        if (cancelled) return
        setCounts(Object.fromEntries(PLANS.map((p, i) => [p.key, res[i].total || 0])))
      })
      .catch((e) => !cancelled && setError(apiError(e, 'Couldn’t load plan counts.')))
    return () => {
      cancelled = true
    }
  }, [])

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <SEO title="Plans | Admin | SafeApply.AI" description="Plan distribution." path="/admin/revenue" noindex />
      <PageContainer>
        <PageHeader title="Plans" description="Who is on which plan." />

        <Alert tone="warn" title="Payments aren’t connected">
          No checkout or billing provider is set up, so there is no revenue data. Paid plans shown below were assigned by an admin.
        </Alert>

        {error && <Alert>{error}</Alert>}

        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
          <Card>
            <div className="grid grid-cols-2 gap-6">
              <Stat label="Accounts" value={counts ? total.toLocaleString() : '–'} />
              <Stat label="On a paid plan" value={counts ? ((counts.pro || 0) + (counts.lifetime || 0)).toLocaleString() : '–'} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Distribution" />
            {!counts ? (
              <div className="flex flex-col gap-4">
                {PLANS.map((p) => (
                  <Skeleton key={p.key} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-4">
                {PLANS.map((p, i) => {
                  const n = counts[p.key] || 0
                  const share = total ? n / total : 0
                  return (
                    <li key={p.key} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">{p.label}</span>
                        <span className="tabular">
                          {n.toLocaleString()} <span className="text-muted">({Math.round(share * 100)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-line/60 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full origin-left ${p.bar}`}
                          initial={reduce ? false : { scaleX: 0 }}
                          animate={{ scaleX: share }}
                          transition={{ duration: 0.6, delay: reduce ? 0 : i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Icon name="info" className="text-[22px] text-muted shrink-0" />
            <p className="text-sm text-muted flex-1">When a payment provider is connected, MRR, churn and payments belong here, read from the provider’s API rather than estimated.</p>
            <ButtonLink to="/admin/users" variant="secondary" size="sm">
              Manage plans
            </ButtonLink>
          </div>
        </Card>
      </PageContainer>
    </>
  )
}
