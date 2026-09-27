// FILE: src/components/layout/DashboardLayout.tsx
// PURPOSE: Layout shell for all authenticated dashboard routes
// Combines Sidebar + TopBar + Outlet, adjusts padding when sidebar collapses

import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useUIStore } from '../../store/uiStore'

export default function DashboardLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <Sidebar />
      <TopBar />
      <div
        style={{ paddingLeft: collapsed ? '64px' : '240px' }}
        className="transition-[padding] duration-200 ease-out"
      >
        <main className="pt-16 min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  )
}