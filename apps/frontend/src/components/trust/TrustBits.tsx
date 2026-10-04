// FILE: src/components/trust/TrustBits.tsx
import { Link } from 'react-router-dom'
import { Icon, cn } from '../ui'
import { BADGES, LEVELS } from '../../lib/trust'
import type { EarnedBadge } from '../../api/progress'

const LEVEL_TONE = ['bg-line text-muted', 'bg-line text-fg', 'bg-accent/10 text-accent', 'bg-accent/15 text-accent', 'bg-accent text-ink']

export function LevelChip({ level, className, link = true }: { level: number; className?: string; link?: boolean }) {
  const l = LEVELS[Math.max(0, Math.min(4, level))]
  const chip = (
    <span className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap', LEVEL_TONE[l.n], className)} title={`Trust level: ${l.name}`}>
      <Icon name={l.icon} className="text-[14px]" />
      {l.name}
    </span>
  )
  return link ? (
    <Link to="/levels" className="inline-flex" aria-label={`Trust level ${l.name}. How levels work`}>
      {chip}
    </Link>
  ) : (
    chip
  )
}

export function BadgeList({ badges, className }: { badges: EarnedBadge[]; className?: string }) {
  const known = badges.filter((b) => BADGES[b.badge_key])
  if (!known.length) return null
  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label="Badges">
      {known.map((b) => {
        const d = BADGES[b.badge_key]
        return (
          <li key={b.badge_key} title={d.desc} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-line bg-surface text-xs">
            <Icon name={d.icon} className="text-[15px] text-accent" />
            {d.label}
          </li>
        )
      })}
    </ul>
  )
}
