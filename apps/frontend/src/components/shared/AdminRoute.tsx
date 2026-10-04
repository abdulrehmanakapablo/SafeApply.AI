// FILE: src/components/shared/AdminRoute.tsx
// PURPOSE: Unauthenticated → /login, non-admin → their own portal home.

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, useIsAuthed } from '../../store/authStore'
import { homeFor } from '../../lib/roles'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const authed = useIsAuthed()
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!authed) {
    const from = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?from=${from}`} replace />
  }
  if (user?.role !== 'admin') return <Navigate to={homeFor(user?.role)} replace />

  return <>{children}</>
}
