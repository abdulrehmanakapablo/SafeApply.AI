// FILE: src/pages/public/Pricing.tsx
// ROUTE: /pricing  (?for=seeker|recruiter|freelancer|client)
// PURPOSE: Free vs Pro for each side. Monthly only, no auto-renew.

import { useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import PlanCards from '../../components/PlanCards'
import { Reveal } from '../../components/motion/Reveal'
import { Icon, Tabs } from '../../components/ui'
import { AUDIENCES, FREE_LIMIT } from '../../lib/plans'
import type { PlanKey } from '../../api/billing'

const RULES: [string, string][] = [
  ['block', 'Nobody pays to rank higher. Search order comes from trust, never money.'],
  ['visibility', 'Hiring records and ghost flags are the same on every plan.'],
  ['event_repeat', 'Each payment covers 30 days. Nothing renews by itself.'],
]

export default function Pricing() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('for')
  const audience: PlanKey = AUDIENCES.some((a) => a.key === raw) ? (raw as PlanKey) : 'seeker'

  return (
    <PublicLayout>
      <SEO
        title="Pricing | SafeApply.AI"
        description={`Free accounts include ${FREE_LIMIT} of each paid tool. Pro is monthly with no auto-renew, with local prices in Pakistan.`}
        path="/pricing"
      />
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <Reveal>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-[18ch]">Start free. Pay only if it earns it.</h1>
          <p className="mt-5 text-lg text-muted leading-relaxed max-w-[52ch]">Every side gets a real free plan. Pro is monthly, priced for where you live, and never renews by itself.</p>
        </Reveal>
        <Reveal delay={0.04} className="mt-10">
          <Tabs label="Pricing for" value={audience} onChange={(v) => setParams({ for: v }, { replace: true })} items={AUDIENCES.map((a) => ({ value: a.key, label: a.label }))} />
        </Reveal>
        <Reveal delay={0.08} className="mt-6">
          <PlanCards key={audience} audience={audience} />
        </Reveal>
        <Reveal delay={0.1} className="mt-10 grid sm:grid-cols-3 gap-4">
          {RULES.map(([icon, text]) => (
            <div key={icon} className="flex gap-3 text-sm text-muted">
              <Icon name={icon} className="text-[20px] text-accent shrink-0" />
              <p>{text}</p>
            </div>
          ))}
        </Reveal>
      </section>
    </PublicLayout>
  )
}
