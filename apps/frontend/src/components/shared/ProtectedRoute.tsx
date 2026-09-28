// FILE: src/components/shared/ProtectedRoute.tsx
// PURPOSE: Redirects to /login if user is not authenticated.
//
// NOTE: Dev-mode auto-login was removed. It was added early on to preview
// dashboard pages against an empty DB, but it defeated the auth guard in
// dev (every unauthenticated visitor was silently logged in as a fake
// admin) and the fake 'dev-token' broke every authenticated API call.
//
// If you need to preview dashboard pages without a real account, create
// a real one via /signup. If you truly want a dev bypass later, gate it
// behind an explicit env var like VITE_DEV_AUTH_BYPASS=true AND check
// that the request is against a local backend — not import.meta.env.DEV,
// which is true for every `vite` dev session.

import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()

  // A real access token must be present too — the Zustand flag alone can
  // be stale (persisted across sessions, or set by old dev-bypass code).
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

  return <>{children}</>
}