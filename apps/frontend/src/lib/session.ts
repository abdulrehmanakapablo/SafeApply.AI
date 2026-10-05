// FILE: src/lib/session.ts
// PURPOSE: Wipe everything in the browser that belongs to the signed-in
//          account (CV drafts, match results, cached API data). Runs on
//          logout, on session expiry, and when a different account logs
//          in, so one person never sees another person's data on a
//          shared browser.
//   • Saved CV data is stamped with its owner's id. Data whose owner isn't
//     the signed-in account is wiped on load, even if it was written
//     before this check existed.
//   • Module-level caches register a reset with onUserCleared().
//   • A sign-in or sign-out in another tab reloads this tab, so a stale
//     tab can't keep showing (or re-save) the previous account's data.

import { useCVStore } from '../store/cvStore'
import { queryClient } from './queryClient'

const resetters = new Set<() => void>()

/** Register a reset for a module-level cache that holds per-account data. */
export function onUserCleared(fn: () => void): void {
  resetters.add(fn)
}

export function clearUserData(): void {
  useCVStore.getState().resetAll()
  useCVStore.persist.clearStorage()
  useCVStore.setState({ ownerId: null })
  queryClient.clear()
  resetters.forEach((fn) => {
    try {
      fn()
    } catch {
      /* a failing reset must not block the others */
    }
  })
}

/** Make sure browser-held account data belongs to `userId`; wipe it otherwise. */
export function ensureOwner(userId: string | null): void {
  if (useCVStore.getState().ownerId === userId) return
  clearUserData()
  useCVStore.setState({ ownerId: userId })
}

if (typeof window !== 'undefined') {
  // 'storage' fires only in OTHER tabs. Reload only when the signed-in
  // account changes (sign-in, sign-out, switch), not on token refreshes.
  window.addEventListener('storage', (e) => {
    if (e.key === null) return window.location.reload()
    if (e.key === 'safeapply-auth' && safeUserId(e.oldValue) !== safeUserId(e.newValue)) window.location.reload()
  })
}

function safeUserId(raw: string | null): string | null {
  try {
    return (JSON.parse(raw || 'null')?.state?.user?.id as string | undefined) ?? null
  } catch {
    return null
  }
}
