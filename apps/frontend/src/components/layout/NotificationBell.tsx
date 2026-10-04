// FILE: src/components/layout/NotificationBell.tsx
// PURPOSE: Top-bar bell. Polls every 45s while the tab is visible (no
//          websockets needed), shows unread count, marks read on open.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { listNotifications, markNotificationsRead, type AppNotification } from '../../api/recruiter'
import { Icon, cn, relativeDays } from '../ui'

const POLL_MS = 45_000

export default function NotificationBell() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await listNotifications()
      if (res.success) {
        setItems(res.data.items)
        setUnread(res.data.unread)
      }
    } catch {
      /* silent: the bell is never worth an error toast */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread > 0) {
      setUnread(0)
      setItems((p) => p.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
      try {
        await markNotificationsRead({ all: true })
      } catch {
        /* next poll restores the real count */
      }
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-[8px] flex items-center justify-center text-muted hover:text-fg hover:bg-line transition-colors"
      >
        <Icon name="notifications" className="text-[20px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-ink text-[10px] font-bold leading-4 text-center tabular">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-11 w-[340px] max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-50"
          >
            <div className="px-4 h-11 flex items-center border-b border-line text-sm font-semibold">Notifications</div>
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-line">
              {!loaded ? (
                <li className="p-4">
                  <div className="skeleton h-10 rounded-[8px]" />
                </li>
              ) : items.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-muted">Nothing yet.</li>
              ) : (
                items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        if (n.link.startsWith('/')) navigate(n.link)
                      }}
                      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-line/50 transition-colors"
                    >
                      <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full shrink-0', n.read_at ? 'bg-transparent' : 'bg-accent')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium break-words">{n.title}</span>
                        {n.body && <span className="block text-xs text-muted mt-0.5 line-clamp-2 break-words">{n.body}</span>}
                        <span className="block text-[11px] text-muted/80 mt-1">{relativeDays(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
