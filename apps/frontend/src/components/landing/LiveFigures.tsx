// FILE: src/components/landing/LiveFigures.tsx
// PURPOSE: Live platform figures on the landing page, straight from the DB.
//          Figures still at zero are left out, and nothing renders until
//          there is something real to show.

import { useEffect, useState } from 'react'
import { getPublicStats, type PublicStats } from '../../api/growth'
import { Reveal } from '../motion/Reveal'

const ITEMS: { key: keyof PublicStats; label: string }[] = [
  { key: 'cvs_opened', label: 'CVs opened by recruiters, on the record' },
  { key: 'verified_companies', label: 'Verified employers' },
  { key: 'open_jobs', label: 'Open jobs with a salary shown' },
  { key: 'hires_confirmed', label: 'Hires confirmed by the person hired' },
  { key: 'contracts_completed', label: 'Freelance contracts completed' },
]

export default function LiveFigures() {
  const [s, setS] = useState<PublicStats | null>(null)
  useEffect(() => {
    getPublicStats()
      .then((r) => setS(r.data))
      .catch(() => setS(null))
  }, [])
  const shown = s ? ITEMS.filter((i) => s[i.key] > 0).slice(0, 4) : []
  if (!shown.length) return null
  return (
    <Reveal delay={0.12}>
      <dl className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-[16px] overflow-hidden">
        {shown.map((i) => (
          <div key={i.key} className="bg-ink p-5 sm:p-6 flex flex-col">
            <dt className="order-2 mt-2 text-sm text-muted leading-snug">{i.label}</dt>
            <dd className="order-1 text-3xl sm:text-4xl font-semibold tracking-tight tabular">{s![i.key].toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Live from the database. Updated every few minutes.</p>
    </Reveal>
  )
}
