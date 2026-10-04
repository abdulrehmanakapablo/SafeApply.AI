// FILE: src/pages/public/Levels.tsx
// ROUTE: /levels
// PURPOSE: How trust levels are earned and lost, for every side.

import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import { Reveal } from '../../components/motion/Reveal'
import { LevelChip } from '../../components/trust/TrustBits'
import { LEVELS, LEVEL_RULES } from '../../lib/trust'

const SIDES: { key: keyof typeof LEVEL_RULES; title: string }[] = [
  { key: 'company', title: 'Companies' },
  { key: 'freelancer', title: 'Freelancers' },
  { key: 'client', title: 'Clients' },
]

export default function Levels() {
  return (
    <PublicLayout>
      <SEO title="Trust levels | SafeApply.AI" description="How SafeApply trust levels are earned and lost. Based only on recorded events, recalculated every hour." path="/levels" />
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <Reveal>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">Trust levels</h1>
          <p className="mt-5 text-lg text-muted leading-relaxed max-w-[60ch]">Levels come only from what happened on SafeApply. They’re recalculated every hour, so they go down when behaviour slips. They can’t be bought, and followers don’t exist here.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <LevelChip key={l.n} level={l.n} link={false} />
            ))}
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6">
          {SIDES.map((s) => (
            <Reveal key={s.key} className="bg-surface border border-line rounded-[16px] p-6 sm:p-8">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <ol className="mt-4 flex flex-col gap-3">
                {LEVEL_RULES[s.key].map((r) => (
                  <li key={r} className="text-sm text-muted leading-relaxed">
                    {r}
                  </li>
                ))}
              </ol>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Admins can correct a level in rare cases (for example, confirmed fraud). Every change is logged with a reason. Think yours is wrong?{' '}
          <Link to="/disputes" className="underline underline-offset-4 hover:text-fg">
            Open a dispute
          </Link>
          .
        </p>
      </article>
    </PublicLayout>
  )
}
