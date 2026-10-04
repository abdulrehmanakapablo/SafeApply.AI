// FILE: src/components/recruiter/TalentCard.tsx
// PURPOSE: One opted-in candidate in talent search and saved folders.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skills } from '../freelance/Bits'
import { WORK_MODE_LABEL } from '../../api/recruiter'
import type { Talent } from '../../api/teams'
import { Badge, Icon, initialsOf, relativeDays } from '../ui'

export default function TalentCard({ t, extra }: { t: Talent; extra?: ReactNode }) {
  return (
    <Link to={`/recruiter/talent/${t.id}`} className="group h-full flex flex-col bg-surface border border-line rounded-[var(--radius-card)] p-5 hover:border-muted/40 transition-colors">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-[8px] bg-line grid place-items-center text-sm font-semibold" aria-hidden>
          {initialsOf(t.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate group-hover:text-accent transition-colors">{t.full_name}</p>
          <p className="text-sm text-muted line-clamp-2 break-words">{t.headline || t.desired_roles || 'No headline yet'}</p>
        </div>
        {t.open_to_work && <Badge tone="accent">Open to work</Badge>}
      </div>
      <p className="mt-3 text-xs text-muted flex flex-wrap gap-x-3 gap-y-1">
        {t.location && (
          <span className="inline-flex items-center gap-1">
            <Icon name="location_on" className="text-[14px]" />
            {t.location}
          </span>
        )}
        {t.work_modes.length > 0 && <span>{t.work_modes.map((m) => WORK_MODE_LABEL[m]).join(', ')}</span>}
        <span>updated {relativeDays(t.updated_at)}</span>
      </p>
      <Skills skills={t.skills} max={6} className="mt-3" />
      {extra}
    </Link>
  )
}
