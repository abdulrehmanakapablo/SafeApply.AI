// FILE: src/components/shared/ProtectedRoute.tsx
// PURPOSE: Redirects to /login if user is not authenticated
// DEV MODE: auto-seeds a mock admin user so you can preview dashboard pages
//           while the database is empty. Disabled in production builds.

import { ReactNode, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

// Dev-only mock user — only used when import.meta.env.DEV is true
const DEV_MOCK_USER = {
  id: 'dev-user-0001',
  email: 'dev@safeapply.ai',
  full_name: 'Dev Operator',
  role: 'admin',
  plan: 'pro',
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)

  // DEV ONLY: if not authenticated, seed the mock user once
  useEffect(() => {
    if (import.meta.env.DEV && !isAuthenticated) {
      login(DEV_MOCK_USER, 'dev-token')
    }
  }, [isAuthenticated, login])

  // In dev, always render — the useEffect above will have logged in by
  // the time children mount. In production, enforce the real guard.
  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}