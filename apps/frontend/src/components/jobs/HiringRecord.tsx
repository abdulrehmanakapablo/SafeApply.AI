// FILE: src/components/jobs/HiringRecord.tsx
// PURPOSE: The public Hiring Record in three sizes: a stat grid (company
//          pages), a one-line strip (job pages) and a tiny badge (job
//          cards). Every number links back to /methodology.

import { Link } from 'react-router-dom'
import { Icon, cn } from '../ui'
import type { HiringScore } from '../../api/recruiter'

const tone = (pct: number | null, good = 70, ok = 40) => (pct == null ? 'text-muted' : pct >= good ? 'text-accent' : pct >= ok ? 'text-warn' : 'text-danger')
const pctText = (pct: number | null) => (pct == null ? 'Not enough data' : `${pct}%`)

export function RecordGrid({ score, className }: { score: HiringScore | null; className?: string }) {
  const s = score
  const items: { label: string; value: string; cls: string; hint: string }[] = [
    { label: 'CVs opened', value: pctText(s?.opened_pct ?? null), cls: tone(s?.opened_pct ?? null), hint: 'Applicants whose CV a recruiter opened' },
    { label: 'Replied within 7 days', value: pctText(s?.replied_7d_pct ?? null), cls: tone(s?.replied_7d_pct ?? null, 60, 30), hint: 'Any stage change or message counts' },
    { label: 'Never answered', value: pctText(s?.no_response_pct ?? null), cls: s?.no_response_pct == null ? 'text-muted' : s.no_response_pct <= 10 ? 'text-accent' : s.no_response_pct <= 30 ? 'text-warn' : 'text-danger', hint: 'No reply after 21 days' },
    { label: 'Verified hires', value: String(s?.hires_verified ?? 0), cls: 'text-fg', hint: `Confirmed by the person hired. ${s?.hires_here ?? 0} recorded by the company.` },
  ]
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-[var(--radius-card)] overflow-hidden">
        {items.map((i) => (
          <div key={i.label} className="bg-surface p-4 sm:p-5" title={i.hint}>
            <dt className="text-xs text-muted">{i.label}</dt>
            <dd className={cn('mt-1.5 text-xl sm:text-2xl font-semibold tabular tracking-tight', i.cls)}>{i.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tabular">{s?.applications ?? 0} applications recorded on SafeApply</span>
        {!!s?.interviews_confirmed && <span className="tabular">{s.interviews_confirmed} interview{s.interviews_confirmed === 1 ? '' : 's'} confirmed by candidates</span>}
        {!!s?.ghost_jobs_90d && <span className="text-danger tabular">{s.ghost_jobs_90d} ghost job{s.ghost_jobs_90d === 1 ? '' : 's'} in 90 days</span>}
        <Link to="/methodology" className="underline underline-offset-4 hover:text-fg">
          How we calculate this
        </Link>
      </p>
    </div>
  )
}

export function RecordStrip({ score, slug }: { score: HiringScore | null; slug: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      <span className="text-muted">Hiring record:</span>
      <span className={tone(score?.opened_pct ?? null)}>
        <span className="tabular font-semibold">{pctText(score?.opened_pct ?? null)}</span> {score?.opened_pct != null && 'of CVs opened'}
      </span>
      {score?.replied_7d_pct != null && (
        <span className={tone(score.replied_7d_pct, 60, 30)}>
          <span className="tabular font-semibold">{score.replied_7d_pct}%</span> replied within 7 days
        </span>
      )}
      <Link to={`/companies/${slug}/hiring-record`} className="text-muted underline underline-offset-4 hover:text-fg">
        Full record
      </Link>
    </div>
  )
}

export function OpenedBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', tone(pct))} title="Share of applicants whose CV a recruiter opened">
      <Icon name="visibility" className="text-[15px]" />
      <span className="tabular">Opens {pct}% of CVs</span>
    </span>
  )
}

export function GhostFlag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold bg-danger/10 text-danger', className)} title="People applied, but no CV was opened">
      <Icon name="visibility_off" className="text-[14px]" />
      Ghost job
    </span>
  )
}
