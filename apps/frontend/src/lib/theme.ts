// FILE: src/lib/theme.ts
// PURPOSE: Light/dark theme. The attribute on <html> is the single source
//          of truth (set before paint by /public/theme-init.js); React reads
//          it through useSyncExternalStore so every toggle stays in sync.

import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'sa-theme'
const EVENT = 'sa-theme-change'

const read = (): Theme => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')

export function setTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* private mode: theme still applies for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark' as Theme)
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')]
}
