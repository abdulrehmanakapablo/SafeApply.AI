// FILE: src/components/shared/ProtectedRoute.tsx
// PURPOSE: Logged-in gate with strict portal isolation.
//   `portal`: only accounts living in that portal may render it. A recruiter
//   can never open the seeker portal, and vice versa. Admins are locked to
//   their active portal; any other portal URL bounces back to it.
//   `roles`: extra role restriction for single pages.
//   The backend enforces roles again on every API call; this is the UI layer.

import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, useIsAuthed } from '../../store/authStore'
import { activePortal, homeFor, type Portal } from '../../lib/roles'

export default function ProtectedRoute({ children, portal, roles }: { children: ReactNode; portal?: Portal; roles?: string[] }) {
  const authed = useIsAuthed()
  const role = useAuthStore((s) => s.user?.role)
  const adminPortal = useAuthStore((s) => s.adminPortal)
  const setAdminPortal = useAuthStore((s) => s.setAdminPortal)
  const location = useLocation()

  // Admin sessions from before portal locking: lock to the first portal entered.
  const claim = role === 'admin' && !adminPortal && portal ? portal : null
  useEffect(() => {
    if (claim) setAdminPortal(claim)
  }, [claim, setAdminPortal])

  if (!authed) {
    const from = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?from=${from}`} replace />
  }
  const effective = claim ?? adminPortal
  if (portal && activePortal(role, effective) !== portal) return <Navigate to={homeFor(role, effective)} replace />
  if (roles && !roles.includes(role || '')) return <Navigate to={homeFor(role, effective)} replace />

  return <>{children}</>
}
