// FILE: src/components/jobs/JobBits.tsx
// PURPOSE: Small shared pieces for job + pipeline UI.

import { Badge, Icon, cn } from '../ui'
import { EMPLOYMENT_LABEL, STAGE_LABEL, WORK_MODE_LABEL, formatSalary, type EmploymentType, type SalaryPeriod, type Stage, type WorkMode } from '../../api/recruiter'

const STAGE_TONE: Record<Stage, 'neutral' | 'accent' | 'warn' | 'danger'> = {
  applied: 'neutral',
  screening: 'warn',
  interview: 'accent',
  offer: 'accent',
  hired: 'accent',
  rejected: 'danger',
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
}

export function JobFacts({
  location,
  work_mode,
  employment_type,
  salary_min,
  salary_max,
  currency,
  salary_period,
  className,
}: {
  location: string
  work_mode: WorkMode
  employment_type: EmploymentType
  salary_min: number
  salary_max: number
  currency: string
  salary_period: SalaryPeriod
  className?: string
}) {
  const facts = [
    { icon: 'payments', text: formatSalary(salary_min, salary_max, currency, salary_period) },
    { icon: 'location_on', text: [WORK_MODE_LABEL[work_mode], location].filter(Boolean).join(' · ') },
    { icon: 'schedule', text: EMPLOYMENT_LABEL[employment_type] },
  ]
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted', className)}>
      {facts.map((f) => (
        <li key={f.icon} className="inline-flex items-center gap-1.5 min-w-0">
          <Icon name={f.icon} className="text-[16px] shrink-0" />
          <span className="truncate">{f.text}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResponseRate({ rate, sample }: { rate: number | null; sample: number }) {
  if (rate === null) {
    return <span className="text-xs text-muted">{sample ? 'Response rate shows after a few more applications' : 'New on SafeApply'}</span>
  }
  const tone = rate >= 80 ? 'text-accent' : rate >= 50 ? 'text-warn' : 'text-danger'
  return (
    <span className="text-xs text-muted">
      Replies to <span className={cn('font-semibold tabular', tone)}>{rate}%</span> of applicants within 14 days
    </span>
  )
}
