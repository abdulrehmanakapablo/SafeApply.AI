// FILE: src/components/freelance/Bits.tsx
// PURPOSE: Small shared pieces for the freelance pages.

import { Badge, Icon, cn } from '../ui'
import {
  DURATION_LABEL,
  MILESTONE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  PROPOSAL_STATUS_LABEL,
  budgetLabel,
  type ContractStatus,
  type MilestoneStatus,
  type Project,
  type ProjectStatus,
  type ProposalStatus,
} from '../../api/freelance'

type Tone = 'neutral' | 'accent' | 'warn' | 'danger'

const PROJECT_TONE: Record<ProjectStatus, Tone> = { draft: 'neutral', open: 'accent', in_progress: 'warn', completed: 'accent', cancelled: 'danger', closed: 'neutral' }
const PROPOSAL_TONE: Record<ProposalStatus, Tone> = { pending: 'neutral', shortlisted: 'warn', accepted: 'accent', declined: 'danger', withdrawn: 'neutral' }
const MILESTONE_TONE: Record<MilestoneStatus, Tone> = { pending: 'neutral', submitted: 'warn', revision: 'danger', approved: 'accent' }
const CONTRACT_TONE: Record<ContractStatus, Tone> = { active: 'warn', completed: 'accent', cancelled: 'danger' }
const CONTRACT_LABEL: Record<ContractStatus, string> = { active: 'Active', completed: 'Completed', cancelled: 'Cancelled' }

export const ProjectBadge = ({ status }: { status: ProjectStatus }) => <Badge tone={PROJECT_TONE[status]}>{PROJECT_STATUS_LABEL[status]}</Badge>
export const ProposalBadge = ({ status }: { status: ProposalStatus }) => <Badge tone={PROPOSAL_TONE[status]}>{PROPOSAL_STATUS_LABEL[status]}</Badge>
export const MilestoneBadge = ({ status }: { status: MilestoneStatus }) => <Badge tone={MILESTONE_TONE[status]}>{MILESTONE_STATUS_LABEL[status]}</Badge>
export const ContractBadge = ({ status }: { status: ContractStatus }) => <Badge tone={CONTRACT_TONE[status]}>{CONTRACT_LABEL[status]}</Badge>

export function Skills({ skills, className, max = 8 }: { skills: string[]; className?: string; max?: number }) {
  if (!skills.length) return null
  const shown = skills.slice(0, max)
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Skills">
      {shown.map((s) => (
        <li key={s} className="text-xs bg-line text-fg/85 rounded-full px-2.5 py-1">
          {s}
        </li>
      ))}
      {skills.length > max && <li className="text-xs text-muted px-1 py-1">+{skills.length - max}</li>}
    </ul>
  )
}

export function ProjectFacts({ p, className }: { p: Pick<Project, 'budget_type' | 'budget_min' | 'budget_max' | 'currency' | 'duration'>; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted', className)}>
      <span className="inline-flex items-center gap-1.5 text-fg font-medium tabular">
        <Icon name="payments" className="text-[17px] text-accent" />
        {budgetLabel(p)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Icon name="schedule" className="text-[17px]" />
        {DURATION_LABEL[p.duration]}
      </span>
    </div>
  )
}

export function Rating({ rating, reviews, className }: { rating: number | null; reviews?: number; className?: string }) {
  if (rating == null) return <span className={cn('text-xs text-muted', className)}>No reviews yet</span>
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <Icon name="star" fill className="text-[15px] text-warn" />
      <span className="font-semibold tabular">{rating.toFixed(1)}</span>
      {reviews != null && <span className="text-muted tabular">({reviews})</span>}
    </span>
  )
}

/** Comma/Enter separated skill input. Keeps lowercase, unique, short tokens. */
export function SkillInput({ value, onChange, max, label, hint }: { value: string[]; onChange: (v: string[]) => void; max: number; label: string; hint?: string }) {
  const add = (raw: string) => {
    const next = [...value]
    for (const part of raw.split(',')) {
      const s = part.trim().toLowerCase().replace(/[^a-z0-9 +#./-]/g, '').slice(0, 30)
      if (s && /^[a-z0-9]/.test(s) && !next.includes(s) && next.length < max) next.push(s)
    }
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 min-h-10 px-2 py-1.5 bg-ink border border-line rounded-[var(--radius-input)] focus-within:border-accent">
        {value.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 text-xs bg-line rounded-full pl-2.5 pr-1 py-0.5">
            {s}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="w-5 h-5 rounded-full inline-flex items-center justify-center text-muted hover:text-fg">
              <Icon name="close" className="text-[14px]" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            aria-label={label}
            className="flex-1 min-w-[120px] bg-transparent text-sm py-1 focus:outline-none placeholder:text-muted/80"
            placeholder={value.length ? 'Add another' : 'Type a skill, press Enter'}
            onKeyDown={(e) => {
              const el = e.currentTarget
              if ((e.key === 'Enter' || e.key === ',') && el.value.trim()) {
                e.preventDefault()
                add(el.value)
                el.value = ''
              } else if (e.key === 'Backspace' && !el.value && value.length) onChange(value.slice(0, -1))
            }}
            onBlur={(e) => {
              if (e.currentTarget.value.trim()) {
                add(e.currentTarget.value)
                e.currentTarget.value = ''
              }
            }}
          />
        )}
      </div>
      <span className="text-xs text-muted">{hint ?? `${value.length} of ${max}`}</span>
    </div>
  )
}
