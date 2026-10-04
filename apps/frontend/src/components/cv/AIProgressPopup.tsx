// FILE: src/components/cv/AIProgressPopup.tsx
// PURPOSE: Progress dialog for CV structuring. Driven by real backend
//          NDJSON events (start → progress 1..n → merging → done).

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Icon, cn } from '../ui'

export interface AIProgressState {
  started: boolean
  totalChunks: number
  completedChunks: number
  merging: boolean
  cached: boolean
  error: string | null
}

export const EMPTY_PROGRESS: AIProgressState = {
  started: false,
  totalChunks: 0,
  completedChunks: 0,
  merging: false,
  cached: false,
  error: null,
}

// Backend v3 reports two steps: local parse, then AI labelling.
const STEP_LABELS = ['Reading the layout', 'Sorting it into sections']

export default function AIProgressPopup({
  open,
  state,
  title = 'Reading your CV',
  subtitle = 'Usually 5 to 15 seconds.',
}: {
  open: boolean
  state: AIProgressState
  title?: string
  subtitle?: string
}) {
  const reduce = useReducedMotion()
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      setVisible(true)
      return
    }
    const t = window.setTimeout(() => setVisible(false), 350)
    return () => window.clearTimeout(t)
  }, [open])

  const { totalChunks, completedChunks, merging } = state
  const steps = Array.from({ length: Math.max(totalChunks, 0) }, (_, i) => STEP_LABELS[i] || `Step ${i + 1}`)
  const done = !merging && totalChunks > 0 && completedChunks >= totalChunks

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[120] bg-ink/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            className="w-full max-w-sm bg-surface border border-line rounded-[var(--radius-card)] p-6 flex flex-col gap-5"
            initial={reduce ? false : { y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Icon name="description" className="text-[20px]" />
              </span>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted mt-0.5">{subtitle}</p>
              </div>
            </div>

            <ol className="flex flex-col gap-3" aria-live="polite">
              {!state.started ? (
                <li className="flex items-center gap-3 text-sm">
                  <Icon name="progress_activity" className="text-[18px] text-accent animate-spin" />
                  <span className="text-muted">Starting…</span>
                </li>
              ) : (
                <>
                  {steps.map((label, i) => {
                    const n = i + 1
                    const isDone = n <= completedChunks
                    const active = !merging && n === completedChunks + 1
                    return (
                      <li key={label} className={cn('flex items-center gap-3 text-sm transition-opacity', !isDone && !active && 'opacity-40')}>
                        {isDone ? (
                          <Icon name="check_circle" fill className="text-[18px] text-accent" />
                        ) : active ? (
                          <Icon name="progress_activity" className="text-[18px] text-accent animate-spin" />
                        ) : (
                          <Icon name="radio_button_unchecked" className="text-[18px] text-muted" />
                        )}
                        <span className={isDone ? 'text-fg' : 'text-muted'}>{label}</span>
                      </li>
                    )
                  })}
                  {(merging || done) && (
                    <li className="flex items-center gap-3 text-sm">
                      {done ? (
                        <Icon name="check_circle" fill className="text-[18px] text-accent" />
                      ) : (
                        <Icon name="progress_activity" className="text-[18px] text-accent animate-spin" />
                      )}
                      <span className={done ? 'text-accent' : 'text-fg'}>{done ? 'Filling in the form' : 'Putting it together…'}</span>
                    </li>
                  )}
                </>
              )}
            </ol>

            {state.error ? (
              <p className="text-sm text-danger">{state.error}</p>
            ) : (
              <p className="text-xs text-muted leading-relaxed">Check every section afterwards. Unusual layouts can put a detail in the wrong place.</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
