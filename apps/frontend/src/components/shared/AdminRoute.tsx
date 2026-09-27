// FILE: src/components/shared/AdminRoute.tsx
// PURPOSE: Redirects to /dashboard if user is not admin
// DEV MODE: bypasses the role check so you can preview admin pages.
//           Disabled in production builds.

import { ReactNode, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const DEV_MOCK_USER = {
  id: 'dev-user-0001',
  email: 'dev@safeapply.ai',
  full_name: 'Dev Operator',
  role: 'admin',
  plan: 'pro',
}

export default function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)

  useEffect(() => {
    if (import.meta.env.DEV && !isAuthenticated) {
      login(DEV_MOCK_USER, 'dev-token')
    }
  }, [isAuthenticated, login])

  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}