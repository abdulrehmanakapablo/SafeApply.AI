// FILE: src/components/shared/AdminRoute.tsx
// PURPOSE: Redirects non-admins away from /admin/*.
// Also redirects unauthenticated users to /login.
//
// NOTE: The old dev-mode auto-login was removed here. It fired whenever
// this component mounted and silently logged the visitor in as a fake
// admin ('Dev Operator'), which then persisted to localStorage via
// Zustand and made the entire app think the user was authenticated on
// every subsequent page load. That's why logged-out users could reach
// /dashboard/review and why every API call sent an invalid 'dev-token'.

import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  // Must have BOTH the flag and a real token — the Zustand flag alone can
  // be stale (from an old session, or set by old dev-bypass code).
  const hasToken =
    typeof window !== 'undefined' && Boolean(localStorage.getItem('access_token'))

  if (!isAuthenticated || !hasToken) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}