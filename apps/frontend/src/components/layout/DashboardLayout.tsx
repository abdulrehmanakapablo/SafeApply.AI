// FILE: src/components/layout/DashboardLayout.tsx
// PURPOSE: Shell for authenticated pages. Sidebar + top bar + content.
//          <DashboardShell> wraps any children (used by AdaptiveLayout for
//          pages that are public but should look like the app when logged in).

import type { ReactNode } from 'react'
import { Outlet, useNavigation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../ui'

export function DashboardShell({ children }: { children: ReactNode }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const navigation = useNavigation()
  const loading = navigation.state === 'loading'

  return (
    <div className="min-h-[100dvh] bg-ink text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-accent focus:text-ink focus:px-3 focus:py-2 focus:rounded-[8px] focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <Sidebar />
      <TopBar />
      <div className={cn('transition-[padding] duration-200 ease-out', collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        <div
          aria-hidden
          className={cn(
            'fixed top-14 left-0 right-0 z-30 h-[2px] bg-accent origin-left transition-transform duration-500',
            loading ? 'scale-x-75' : 'scale-x-0',
          )}
        />
        <main id="main" className="pt-14 min-h-[100dvh]">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  )
}
