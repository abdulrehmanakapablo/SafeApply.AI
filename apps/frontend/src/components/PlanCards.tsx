// FILE: src/components/PlanCards.tsx
// PURPOSE: Free vs Pro for one audience (seeker, recruiter, freelancer,
//          client). Prices come from the backend so they can't drift.
//          Used on /pricing, the landing page and every billing page.

import { useEffect, useState } from 'react'
import { Badge, ButtonLink, Icon, Skeleton, cn } from './ui'
import { AUDIENCES, PLAN_FEATURES } from '../lib/plans'
import { PLAN_ROLE, getBillingConfig, pkr, useBillingStatus, type BillingConfig, type PlanKey } from '../api/billing'
import { useAuthStore, useIsAuthed } from '../store/authStore'

export default function PlanCards({ audience = 'seeker', className }: { audience?: PlanKey; className?: string }) {
  const authed = useIsAuthed()
  const role = useAuthStore((s) => s.user?.role)
  const [cfg, setCfg] = useState<BillingConfig | null>(null)
  const sameSide = authed && (role === PLAN_ROLE[audience] || role === 'admin')
  const status = useBillingStatus(sameSide)

  useEffect(() => {
    getBillingConfig().then(setCfg).catch(() => setCfg(null))
  }, [])

  const plan = cfg?.plans[audience]
  const founding = Boolean(cfg && cfg.founding_left > 0)
  const signup = AUDIENCES.find((a) => a.key === audience)!.signup
  const features = PLAN_FEATURES[audience]
  const isPro = sameSide && status?.pro
  const proCta = !authed
    ? { to: `${signup}${signup.includes('?') ? '&' : '?'}redirect=${encodeURIComponent('/billing/checkout')}`, label: 'Start free, upgrade any time' }
    : sameSide
      ? isPro
        ? null
        : { to: '/billing/checkout', label: 'Upgrade to Pro' }
      : null

  return (
    <div className={cn('grid md:grid-cols-2 gap-4 items-stretch', className)}>
      <article className="rounded-[var(--radius-card)] border border-line bg-surface flex flex-col">
        <div className="p-6 sm:p-7 border-b border-line">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Free</h3>
            {sameSide && status && !status.pro && <Badge tone="accent">Your plan</Badge>}
          </div>
          <p className="mt-3 text-[40px] font-semibold tracking-tight leading-none tabular">$0</p>
          <p className="mt-2 text-sm text-muted">Forever. No card needed.</p>
        </div>
        <FeatureList items={features.free} />
        {!authed && (
          <div className="p-6 sm:p-7 pt-0">
            <ButtonLink to={signup} variant="secondary" className="w-full">
              Create a free account
            </ButtonLink>
          </div>
        )}
      </article>

      <article className="relative rounded-[var(--radius-card)] border border-accent/40 bg-[radial-gradient(120%_100%_at_100%_0%,color-mix(in_srgb,var(--c-accent)_10%,transparent),transparent_60%),var(--c-surface)] flex flex-col">
        <div className="p-6 sm:p-7 border-b border-line">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{plan?.name ?? 'Pro'}</h3>
            {isPro ? <Badge tone="accent">Your plan</Badge> : founding && <Badge tone="warn">Founding price</Badge>}
          </div>
          {!plan ? (
            <Skeleton className="mt-3 h-10 w-32" />
          ) : (
            <>
              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-[40px] font-semibold tracking-tight leading-none tabular">${founding ? plan.founding_usd : plan.usd}</span>
                {founding && <span className="text-muted line-through tabular">${plan.usd}</span>}
                <span className="text-sm text-muted">/ month</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                In Pakistan: <span className="text-fg font-medium tabular">{pkr(plan.pkr)}</span> / month. 30 days per payment, no auto-renew.
              </p>
              {founding && <p className="mt-1 text-xs text-warn tabular">{cfg!.founding_left} founding seats left at this price.</p>}
            </>
          )}
        </div>
        <FeatureList items={features.pro} pro />
        <div className="p-6 sm:p-7 pt-0">
          {proCta ? (
            <ButtonLink to={proCta.to} className="w-full" iconRight="arrow_forward">
              {proCta.label}
            </ButtonLink>
          ) : isPro ? (
            <p className="text-sm text-accent text-center">You’re on Pro</p>
          ) : (
            <p className="text-xs text-muted text-center">Available on a {AUDIENCES.find((a) => a.key === audience)!.label.toLowerCase().replace(/s$/, '')} account.</p>
          )}
        </div>
      </article>
    </div>
  )
}

function FeatureList({ items, pro }: { items: string[]; pro?: boolean }) {
  return (
    <ul className="p-6 sm:p-7 flex flex-col gap-3 flex-1">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-3 text-sm">
          <Icon name={pro ? 'add_circle' : 'check_circle'} fill={pro} className={cn('text-[18px] shrink-0 mt-px', pro ? 'text-accent' : 'text-muted')} />
          {f}
        </li>
      ))}
    </ul>
  )
}
