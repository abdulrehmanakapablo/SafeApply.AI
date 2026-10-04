// FILE: src/components/ui/Stars.tsx
// PURPOSE: Star rating display (supports halves) and an accessible input
//          built on a radio group (arrow keys work, labels are announced).

import { useId } from 'react'
import { Icon, cn } from './index'

export function Stars({ rating, size = 16, className }: { rating: number; size?: number; className?: string }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0))
  return (
    <span className={cn('inline-flex items-center', className)} style={{ fontSize: size }} role="img" aria-label={`${r.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const half = r < i && r >= i - 0.5
        const filled = r >= i - 0.5
        return <Icon key={i} name={half ? 'star_half' : 'star'} fill={filled} className={cn('text-[1em]', filled ? 'text-accent' : 'text-line')} />
      })}
    </span>
  )
}

const LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent']

export function StarInput({
  value,
  onChange,
  label,
  error,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  error?: string
}) {
  const id = useId()
  return (
    <fieldset className="flex flex-col gap-1.5 min-w-0">
      <legend className="text-[13px] font-medium mb-1.5">
        {label}
        <span className="text-accent ml-0.5" aria-hidden>
          *
        </span>
      </legend>
      <div className="flex items-center gap-3">
        <div className="flex items-center" role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer p-0.5 group">
              <input
                type="radio"
                name={id}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only peer"
                aria-label={`${n} star${n > 1 ? 's' : ''}, ${LABELS[n - 1]}`}
              />
              <Icon
                name="star"
                fill={n <= value}
                className={cn(
                  'text-[28px] transition-[color,transform] duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent rounded-[4px] group-hover:scale-110',
                  n <= value ? 'text-accent' : 'text-line group-hover:text-muted',
                )}
              />
            </label>
          ))}
        </div>
        <span className="text-sm text-muted min-w-[5rem]">{value ? LABELS[value - 1] : 'Not rated'}</span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}
