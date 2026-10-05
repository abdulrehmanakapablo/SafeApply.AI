// FILE: src/lib/session.ts
// PURPOSE: Wipe everything in the browser that belongs to the signed-in
//          account (CV drafts, match results, cached API data). Runs on
//          logout, on session expiry, and when a different account logs
//          in, so one person never sees another person's data on a
//          shared browser.

import { useCVStore } from '../store/cvStore'
import { queryClient } from './queryClient'

export function clearUserData(): void {
  useCVStore.getState().resetAll()
  useCVStore.persist.clearStorage()
  queryClient.clear()
}
