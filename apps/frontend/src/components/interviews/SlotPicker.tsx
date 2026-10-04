// FILE: src/components/interviews/SlotPicker.tsx
// PURPOSE: Up to 5 time options in the user's local time zone. Values are
//          sent as ISO strings (UTC) so both sides see the same moment.

import { Button, Icon } from '../ui'

const pad = (n: number) => String(n).padStart(2, '0')
/** datetime-local value for "now + minutes", in local time. */
export function localInput(offsetMin: number) {
  const d = new Date(Date.now() + offsetMin * 60_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const toIso = (local: string) => new Date(local).toISOString()

export default function SlotPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const min = localInput(30)
  const max = localInput(90 * 24 * 60)
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">Times you can do</span>
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="datetime-local"
            aria-label={`Option ${i + 1}`}
            value={v}
            min={min}
            max={max}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
            className="flex-1 h-10 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={value.length === 1}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={`Remove option ${i + 1}`}
            className="w-9 h-10 inline-flex items-center justify-center rounded-[8px] text-muted hover:text-danger hover:bg-line disabled:opacity-30 disabled:pointer-events-none"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      ))}
      {value.length < 5 && (
        <Button size="sm" variant="ghost" icon="add" className="self-start" onClick={() => onChange([...value, localInput(24 * 60 * (value.length + 1))])}>
          Add another time
        </Button>
      )}
      <span className="text-xs text-muted">Shown in your time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). The candidate sees them in theirs.</span>
    </div>
  )
}
