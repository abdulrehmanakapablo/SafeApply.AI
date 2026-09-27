// FILE: src/components/layout/AdminLayout.tsx
// PURPOSE: Layout shell for all admin routes.
// Combines a fixed admin sidebar + topbar with the current page's Outlet.
// Wider sidebar than dashboard — admin has fewer, more distinct sections.

import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import Logo from '../ui/Logo'

interface NavItem {
  label: string
  to: string
  icon: string
  exact?: boolean
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Admin Dashboard', to: '/admin', icon: 'space_dashboard', exact: true },
  { label: 'Review Moderation', to: '/admin/reviews', icon: 'rate_review' },
  { label: 'User Management', to: '/admin/users', icon: 'manage_accounts' },
  { label: 'Revenue Dashboard', to: '/admin/revenue', icon: 'payments' },
]

const ADMIN_SECONDARY_NAV: NavItem[] = [
  { label: 'Public Reviews', to: '/companies', icon: 'public' },
  { label: 'Main Dashboard', to: '/dashboard', icon: 'arrow_back' },
]

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const navigate = useNavigate()

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'AD'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      {/* ═══════════ SIDEBAR ═══════════ */}
      <aside
        style={{ width: collapsed ? '64px' : '240px' }}
        className="fixed left-0 top-0 bottom-0 z-50 bg-[#0D0D0D] border-r border-[#1A1A1A] flex flex-col justify-between overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out"
      >
        <div className="flex flex-col">
          {/* Logo + admin badge */}
          <div
            className={`h-16 border-b border-[#1A1A1A] flex items-center shrink-0 ${
              collapsed ? 'justify-center px-2' : 'px-4 gap-2'
            }`}
          >
            <Link
              to="/admin"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              {collapsed ? (
                <span className="w-8 h-8 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444] font-extrabold text-sm">
                  A
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <Logo className="h-7 w-auto" />
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                    Admin
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* User card */}
          <div
            className={`border-b border-[#1A1A1A] shrink-0 ${
              collapsed ? 'py-3 flex justify-center' : 'p-3'
            }`}
          >
            {collapsed ? (
              <Link
                to="/dashboard/settings"
                title={user?.full_name || 'Admin'}
                className="w-8 h-8 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] flex items-center justify-center text-[#EF4444] font-semibold text-xs"
              >
                {initials}
              </Link>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1c1b1b] border border-[#1A1A1A] flex items-center justify-center text-[#EF4444] font-semibold text-xs shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-white truncate font-medium">
                    {user?.full_name || 'Admin User'}
                  </span>
                  <span className="text-[10px] text-[#EF4444] font-mono uppercase tracking-wider">
                    Root privileges
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Admin section nav */}
          <div className="py-3">
            {!collapsed && (
              <span className="block px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                Administration
              </span>
            )}
            <nav className="flex flex-col">
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    [
                      'flex items-center transition-colors text-sm font-medium border-l-2',
                      collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-2.5',
                      isActive
                        ? 'bg-[#EF4444]/[0.12] text-[#EF4444] border-[#EF4444]'
                        : 'text-[#737373] hover:bg-[#1A1A1A] hover:text-white border-transparent',
                    ].join(' ')
                  }
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* System resources section */}
          <div className="py-3 border-t border-[#1A1A1A]">
            {!collapsed && (
              <span className="block px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                System Resources
              </span>
            )}
            <nav className="flex flex-col">
              {ADMIN_SECONDARY_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    [
                      'flex items-center transition-colors text-sm font-medium border-l-2',
                      collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-2.5',
                      isActive
                        ? 'bg-[#EF4444]/[0.12] text-[#EF4444] border-[#EF4444]'
                        : 'text-[#737373] hover:bg-[#1A1A1A] hover:text-white border-transparent',
                    ].join(' ')
                  }
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom: network status + logout */}
        <div
          className={`flex flex-col gap-2 border-t border-[#1A1A1A] shrink-0 ${
            collapsed ? 'p-2' : 'p-3'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center justify-between text-[10px] px-1">
              <span className="text-[#737373] uppercase tracking-wider">
                Network
              </span>
              <span className="font-mono text-[#22c55e]">99.98% OK</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`flex items-center text-[#737373] hover:text-[#EF4444] transition-colors text-sm rounded-md ${
              collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">
              logout
            </span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ═══════════ TOPBAR ═══════════ */}
      <header
        style={{ left: collapsed ? '64px' : '240px' }}
        className="fixed top-0 right-0 h-16 z-40 bg-[#000000]/85 backdrop-blur-md border-b border-[#1A1A1A] px-4 flex items-center justify-between transition-[left] duration-200 ease-out"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444] shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              shield_person
            </span>
          </span>
          <h1 className="text-base sm:text-lg font-bold text-white truncate">
            {pageTitleFromPath(window.location.pathname)}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-[#0D0D0D] border border-[#1A1A1A]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="font-mono text-[10px] text-[#22c55e] uppercase tracking-wider">
              Root access
            </span>
          </div>
          <Link
            to="/dashboard"
            className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              arrow_back
            </span>
            Back to App
          </Link>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
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

// ─── Page title resolver ────────────────────────────────
function pageTitleFromPath(pathname: string): string {
  if (pathname.startsWith('/admin/reviews')) return 'Review Moderation'
  if (pathname.startsWith('/admin/users')) return 'User Management'
  if (pathname.startsWith('/admin/revenue')) return 'Revenue Dashboard'
  if (pathname.startsWith('/admin')) return 'Admin Console'
  return 'Admin'
}