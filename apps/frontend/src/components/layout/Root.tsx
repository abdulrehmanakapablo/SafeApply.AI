// FILE: src/components/layout/Root.tsx
// PURPOSE: Root layout wrapper — renders ScrollRestoration so scroll resets
//          to top on every route change, then renders the current route's Outlet.

import { ScrollRestoration, Outlet } from 'react-router-dom'

export default function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}