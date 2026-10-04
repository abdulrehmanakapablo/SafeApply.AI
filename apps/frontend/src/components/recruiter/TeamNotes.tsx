// FILE: src/components/recruiter/TeamNotes.tsx
// PURPOSE: Private hiring-team notes on an applicant: ratings, @mentions
//          (teammates get notified). The candidate never sees these.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import toast from 'react-hot-toast'
import { addNote, deleteNote, listNotes, type NotesPayload } from '../../api/teams'
import { Button, Card, CardHeader, Icon, SkeletonRows, cn, initialsOf, relativeDays } from '../ui'
import { apiError } from '../../lib/axios'

function Stars({ value, onChange, size = 18 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <span className="inline-flex items-center" role={onChange ? 'radiogroup' : undefined} aria-label={onChange ? 'Rating' : `Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value || 0) >= n
        const cls = cn('material-symbols-outlined leading-none', on ? 'text-warn' : 'text-line')
        const style = { fontSize: size, fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0" }
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => onChange(value === n ? null : n)} className="p-0.5 hover:scale-110 transition-transform">
            <span className={cls} style={style} aria-hidden>
              star
            </span>
          </button>
        ) : (
          <span key={n} className={cls} style={style} aria-hidden>
            star
          </span>
        )
      })}
    </span>
  )
}

export default function TeamNotes({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<NotesPayload | null>(null)
  const [body, setBody] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [picked, setPicked] = useState<Map<string, string>>(new Map())
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      setData((await listNotes(applicationId)).data)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t load team notes.'))
      setData({ notes: [], rating: null, team: [], can_moderate: false })
    }
  }, [applicationId])
  useEffect(() => {
    void load()
  }, [load])

  const suggestions = useMemo(() => {
    if (query === null || !data) return []
    const q = query.toLowerCase()
    return data.team.filter((t) => t.full_name.toLowerCase().includes(q)).slice(0, 6)
  }, [query, data])

  function onChange(v: string) {
    setBody(v.slice(0, 2000))
    const caret = ref.current?.selectionStart ?? v.length
    const m = /(?:^|\s)@([\p{L}\p{N} .'-]{0,30})$/u.exec(v.slice(0, caret))
    setQuery(m ? m[1] : null)
    setActive(0)
  }

  function pick(p: { id: string; full_name: string }) {
    const el = ref.current
    const caret = el?.selectionStart ?? body.length
    const before = body.slice(0, caret).replace(/@[\p{L}\p{N} .'-]{0,30}$/u, `@${p.full_name} `)
    const next = (before + body.slice(caret)).slice(0, 2000)
    setBody(next)
    setPicked((m) => new Map(m).set(p.id, p.full_name))
    setQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pick(suggestions[active])
    } else if (e.key === 'Escape') setQuery(null)
  }

  async function submit() {
    const text = body.trim()
    if (!text || busy) return
    // Only mentions still present in the text are sent.
    const mentions = [...picked].filter(([, name]) => text.includes(`@${name}`)).map(([id]) => id)
    setBusy(true)
    try {
      await addNote(applicationId, { body: text, rating, mentions })
      setBody('')
      setRating(null)
      setPicked(new Map())
      await load()
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save the note.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      await deleteNote(applicationId, id)
      setData((d) => (d ? { ...d, notes: d.notes.filter((n) => n.id !== id) } : d))
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t delete the note.'))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Team notes"
        description="Only your hiring team sees these."
        action={
          data?.rating ? (
            <span className="flex items-center gap-1.5 text-xs text-muted tabular">
              <Stars value={Math.round(data.rating.avg)} size={14} />
              {data.rating.avg} · {data.rating.count}
            </span>
          ) : undefined
        }
        className="mb-4"
      />
      {!data ? (
        <SkeletonRows rows={2} />
      ) : (
        <>
          {data.notes.length > 0 && (
            <ul className="flex flex-col gap-4 mb-5 max-h-[420px] overflow-y-auto pr-1">
              {data.notes.map((n) => (
                <li key={n.id} className="flex gap-3 group">
                  <span className="w-7 h-7 shrink-0 rounded-[8px] bg-line grid place-items-center text-[11px] font-semibold" aria-hidden>
                    {initialsOf(n.author)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted flex flex-wrap items-center gap-x-2">
                      <span className="text-fg font-medium">{n.author}</span>
                      <span>{relativeDays(n.created_at)}</span>
                      {n.rating && <Stars value={n.rating} size={12} />}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-line break-words">{n.body}</p>
                  </div>
                  {(n.mine || data.can_moderate) && (
                    <button type="button" onClick={() => remove(n.id)} aria-label="Delete note" className="self-start opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted hover:text-danger transition-opacity">
                      <Icon name="delete" className="text-[16px]" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="relative">
            <label htmlFor="team-note" className="sr-only">
              Add a note
            </label>
            <textarea
              id="team-note"
              ref={ref}
              value={body}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKey}
              onBlur={() => setTimeout(() => setQuery(null), 120)}
              rows={3}
              placeholder={data.team.length ? 'Add a note. Type @ to mention a teammate.' : 'Add a note for yourself or future teammates.'}
              className="w-full px-3 py-2.5 rounded-[var(--radius-input)] bg-ink border border-line text-sm leading-relaxed resize-y focus:outline-none focus:border-accent"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
            />
            {suggestions.length > 0 && (
              <ul role="listbox" className="absolute z-20 left-2 right-2 top-full -mt-1 bg-surface border border-line rounded-[8px] shadow-lg py-1">
                {suggestions.map((s, i) => (
                  <li key={s.id} role="option" aria-selected={i === active}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} className={cn('w-full text-left px-3 py-2 text-sm', i === active ? 'bg-line' : 'hover:bg-line/60')}>
                      {s.full_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Stars value={rating} onChange={setRating} />
            <Button size="sm" onClick={submit} loading={busy} disabled={!body.trim()}>
              Add note
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
