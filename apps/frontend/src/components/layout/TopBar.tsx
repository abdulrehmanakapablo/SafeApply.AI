// FILE: src/components/layout/TopBar.tsx
// PURPOSE: Fixed top bar for dashboard — sidebar toggle + page title + user dropdown
// Sits right of the sidebar, width adjusts when sidebar collapses

import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/company-report': 'Company Report',
  '/dashboard/company-report/history': 'Report History',
  '/dashboard/cv-match': 'CV Intelligence',
  '/dashboard/cv-builder': 'CV Builder',
  '/dashboard/cv-builder/saved': 'Saved CVs',
  '/dashboard/tracker': 'Application Tracker',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/review': 'Submit Review',
  '/dashboard/settings': 'Settings',
  '/dashboard/billing': 'Billing',
}

export default function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Resolve page title — handles /dashboard/tracker/:id too
  let pageTitle = PAGE_TITLES[location.pathname]
  if (!pageTitle && location.pathname.startsWith('/dashboard/tracker/')) {
    pageTitle = 'Application Detail'
  }
  pageTitle = pageTitle || 'Dashboard'

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false)
  }, [location.pathname])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header
      style={{ left: collapsed ? '64px' : '240px' }}
      className="fixed top-0 right-0 h-16 z-40 bg-[#000000]/85 backdrop-blur-md border-b border-[#1A1A1A] px-4 flex items-center justify-between transition-[left] duration-200 ease-out"
    >
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#1A1A1A] transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[22px]">
            {collapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
        <h1 className="text-base sm:text-lg font-bold text-white truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Right: notifications + avatar dropdown */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#1A1A1A] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            notifications
          </span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#22c55e]" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[#1A1A1A] transition-colors"
          >
            <span className="w-8 h-8 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/40 flex items-center justify-center text-[#22c55e] text-xs font-semibold">
              {initials}
            </span>
            <span className="material-symbols-outlined text-[#737373] text-[16px] hidden sm:block">
              expand_more
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-12 w-56 bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg p-1.5 shadow-xl z-50">
              <div className="px-3 py-2 border-b border-[#1A1A1A] mb-1">
                <p className="text-sm font-medium text-white truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-[11px] text-[#737373] truncate">
                  {user?.email || ''}
                </p>
              </div>

              <Link
                to="/dashboard/settings"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#737373] hover:text-white hover:bg-[#22c55e]/[0.08] rounded-md transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  settings
                </span>
                Account Settings
              </Link>

              <Link
                to="/dashboard/billing"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#737373] hover:text-white hover:bg-[#22c55e]/[0.08] rounded-md transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  credit_card
                </span>
                Billing
              </Link>

              <div className="border-t border-[#1A1A1A] my-1" />

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#737373] hover:text-[#EF4444] hover:bg-[#EF4444]/[0.08] rounded-md transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  logout
                </span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}