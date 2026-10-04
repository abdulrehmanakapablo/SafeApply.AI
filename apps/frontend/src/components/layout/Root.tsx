// FILE: src/components/layout/Root.tsx
// PURPOSE: App root. Scroll restoration, in-page hash scrolling
//          (/#how from any page), and a route-level error screen.

import { useEffect } from 'react'
import { Link, Outlet, ScrollRestoration, isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom'
import Logo from '../ui/Logo'
import { buttonClass } from '../ui'
import { useAuthStore } from '../../store/authStore'
import { homeFor } from '../../lib/roles'

function HashScroller() {
  const { hash, pathname } = useLocation()
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    // Wait a frame so the target section has mounted
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => window.clearTimeout(t)
  }, [hash, pathname])
  return null
}

export default function Root() {
  return (
    <>
      <ScrollRestoration />
      <HashScroller />
      <Outlet />
    </>
  )
}

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const role = useAuthStore((s) => s.user?.role)
  const adminPortal = useAuthStore((s) => s.adminPortal)
  const home = homeFor(role, adminPortal)
  if (error && !notFound) console.error(error)

  return (
    <div className="min-h-[100dvh] bg-ink text-fg flex flex-col">
      <header className="h-16 px-5 sm:px-8 flex items-center">
        <Link to="/" aria-label="SafeApply.AI home">
          <Logo className="h-8 w-auto" />
        </Link>
      </header>
      <main id="main" className="flex-1 flex items-center px-5 sm:px-8">
        <div className="max-w-lg mx-auto sm:mx-0 sm:ml-[12vw]">
          <p className="text-sm text-accent font-medium tabular">{notFound ? '404' : 'Error'}</p>
          <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight mt-2">
            {notFound ? 'This page doesn’t exist.' : 'Something broke on our side.'}
          </h1>
          <p className="text-muted mt-3 leading-relaxed">
            {notFound
              ? 'The link may be old or mistyped. Head back and try again from there.'
              : 'Reload the page. If it keeps happening, sign out and back in.'}
          </p>
          <div className="flex flex-wrap gap-2 mt-8">
            <Link to="/" className={buttonClass('primary')}>
              Go to home
            </Link>
            <Link to={home} className={buttonClass('secondary')}>
              Open dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
