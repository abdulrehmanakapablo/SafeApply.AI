// FILE: src/components/freelance/ContractChat.tsx
// PURPOSE: Messages on one contract. Polls every 15s while the tab is
//          visible. Bodies render as plain text (React escapes them).

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { listContractMessages, postContractMessage, type ContractMessage } from '../../api/freelance'
import { apiError } from '../../lib/axios'
import { Button, Icon, cn } from '../ui'

const POLL_MS = 15_000
const MAX = 4000
const time = (iso: string) => {
  const d = new Date(iso)
  return new Date().toDateString() === d.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ContractChat({ contractId, readOnly }: { contractId: string; readOnly?: boolean }) {
  const [msgs, setMsgs] = useState<ContractMessage[] | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)

  const load = useCallback(async () => {
    try {
      const r = await listContractMessages(contractId)
      setMsgs(r.data)
    } catch {
      setMsgs((m) => m ?? [])
    }
  }, [contractId])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    const n = msgs?.length ?? 0
    if (n > lastCount.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    lastCount.current = n
  }, [msgs])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const r = await postContractMessage(contractId, body)
      setDraft('')
      setMsgs((m) => [...(m || []), r.data])
    } catch (err) {
      toast.error(apiError(err, 'Message not sent.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div ref={listRef} className="min-h-[220px] max-h-[52vh] overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 flex flex-col gap-2" aria-live="polite">
        {!msgs ? (
          [0, 1].map((i) => <div key={i} className={cn('skeleton h-11 rounded-[12px] w-2/3', i === 1 && 'self-end')} />)
        ) : msgs.length === 0 ? (
          <div className="m-auto text-center max-w-xs py-6">
            <Icon name="forum" className="text-[28px] text-muted" />
            <p className="mt-2 text-sm text-muted">No messages yet. Agree details, share files by link, and keep decisions here.</p>
          </div>
        ) : (
          msgs.map((m) => (
            <div key={m.id} className={cn('flex flex-col max-w-[85%] sm:max-w-[70%]', m.mine ? 'self-end items-end' : 'self-start items-start')}>
              <p className={cn('px-3.5 py-2 rounded-[14px] text-sm leading-relaxed whitespace-pre-wrap break-words', m.mine ? 'bg-accent text-ink rounded-br-[4px]' : 'bg-line text-fg rounded-bl-[4px]')}>{m.body}</p>
              <time dateTime={m.created_at} className="text-[11px] text-muted mt-1 px-1">
                {time(m.created_at)}
              </time>
            </div>
          ))
        )}
      </div>
      {!readOnly && (
        <form onSubmit={submit} className="border-t border-line p-3 flex items-end gap-2">
          <label htmlFor={`cmsg-${contractId}`} className="sr-only">
            Message
          </label>
          <textarea
            id={`cmsg-${contractId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            rows={1}
            placeholder="Write a message…"
            className="flex-1 min-h-10 max-h-40 resize-y bg-ink border border-line rounded-[var(--radius-input)] px-3 py-2.5 text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
          />
          <Button type="submit" icon="send" loading={sending} disabled={!draft.trim()} aria-label="Send message">
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      )}
    </div>
  )
}
