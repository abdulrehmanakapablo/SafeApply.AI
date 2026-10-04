// FILE: src/components/messages/ThreadView.tsx
// PURPOSE: One application's conversation. Used by the seeker inbox and the
//          recruiter applicant page. Polls every 15s while visible; messages
//          render as plain text (React escapes everything).

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { getThread, sendMessage, type Message, type Thread } from '../../api/recruiter'
import { apiError } from '../../lib/axios'
import { Button, EmptyState, Icon, cn } from '../ui'

const POLL_MS = 15_000
const MAX = 4000

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ThreadView({ applicationId, className, onLoaded }: { applicationId: string; className?: string; onLoaded?: (t: Thread) => void }) {
  const [thread, setThread] = useState<Thread | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  const load = useCallback(async () => {
    try {
      const res = await getThread(applicationId)
      if (res.success) {
        setThread(res.data)
        setError('')
        onLoadedRef.current?.(res.data)
      }
    } catch (e) {
      setError(apiError(e, 'Couldn’t load this conversation.'))
    }
  }, [applicationId])

  useEffect(() => {
    setThread(null)
    lastCount.current = 0
    void load()
    const t = window.setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  // Stick to the bottom only when new messages arrive.
  useEffect(() => {
    const n = thread?.messages.length ?? 0
    if (n > lastCount.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    lastCount.current = n
  }, [thread])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const res = await sendMessage(applicationId, body)
      if (res.success) {
        setDraft('')
        setThread((t) => (t ? { ...t, messages: [...t.messages, res.data as Message] } : t))
      }
    } catch (err) {
      toast.error(apiError(err, 'Message not sent.'))
    } finally {
      setSending(false)
    }
  }

  if (error && !thread) return <EmptyState icon="forum" title="Conversation unavailable" body={error} />
  if (!thread) {
    return (
      <div className={cn('flex flex-col gap-3 p-5', className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('skeleton h-12 rounded-[12px] w-2/3', i % 2 === 1 && 'self-end')} />
        ))}
      </div>
    )
  }

  const mine = thread.side
  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div ref={listRef} className="flex-1 min-h-[240px] max-h-[56vh] overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 flex flex-col gap-2" aria-live="polite">
        {thread.messages.length === 0 ? (
          <div className="m-auto text-center max-w-xs py-8">
            <Icon name="forum" className="text-[28px] text-muted" />
            <p className="mt-2 text-sm text-muted">
              {mine === 'company' ? 'Say hello, ask a question, or share next steps.' : 'No messages yet. The company can contact you here, and you can reply.'}
            </p>
          </div>
        ) : (
          thread.messages.map((m) => {
            const own = m.sender_side === mine
            return (
              <div key={m.id} className={cn('flex flex-col max-w-[85%] sm:max-w-[70%]', own ? 'self-end items-end' : 'self-start items-start')}>
                <p
                  className={cn(
                    'px-3.5 py-2 rounded-[14px] text-sm leading-relaxed whitespace-pre-wrap break-words',
                    own ? 'bg-accent text-ink rounded-br-[4px]' : 'bg-line text-fg rounded-bl-[4px]',
                  )}
                >
                  {m.body}
                </p>
                <time dateTime={m.created_at} className="text-[11px] text-muted mt-1 px-1">
                  {timeLabel(m.created_at)}
                </time>
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={submit} className="border-t border-line p-3 flex items-end gap-2">
        <label htmlFor={`msg-${applicationId}`} className="sr-only">
          Message
        </label>
        <textarea
          id={`msg-${applicationId}`}
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
    </div>
  )
}
