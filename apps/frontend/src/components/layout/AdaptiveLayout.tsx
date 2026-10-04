// FILE: src/components/layout/AdaptiveLayout.tsx
// PURPOSE: For pages anyone can open (company reviews). Logged in → the app
//          shell (sidebar + top bar). Logged out → the public site layout.

import type { ReactNode } from 'react'
import PublicLayout from './PublicLayout'
import { DashboardShell } from './DashboardLayout'
import { useIsAuthed } from '../../store/authStore'

export default function AdaptiveLayout({ children }: { children: ReactNode }) {
  const authed = useIsAuthed()
  return authed ? <DashboardShell>{children}</DashboardShell> : <PublicLayout>{children}</PublicLayout>
}
