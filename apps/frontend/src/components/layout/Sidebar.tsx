// FILE: src/components/layout/Sidebar.tsx
// PURPOSE: Fixed left sidebar for dashboard — collapsible, persistent
// Width: 240px expanded, 64px collapsed
// Admin item appears only for users with role === 'admin'

import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import Logo from '../ui/Logo'

interface NavItem {
  label: string
  to: string
  icon: string
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'space_dashboard', exact: true },
  { label: 'Company Reports', to: '/dashboard/company-report', icon: 'corporate_fare' },
  { label: 'CV Intelligence', to: '/dashboard/cv-match', icon: 'psychology' },
  { label: 'CV Builder', to: '/dashboard/cv-builder', icon: 'description' },
  { label: 'Tracker', to: '/dashboard/tracker', icon: 'checklist' },
  { label: 'Analytics', to: '/dashboard/analytics', icon: 'analytics' },
  { label: 'Companies', to: '/companies', icon: 'business' },
  { label: 'Submit Review', to: '/dashboard/review', icon: 'rate_review' },
  { label: 'Settings', to: '/dashboard/settings', icon: 'settings' },
  { label: 'Billing', to: '/dashboard/billing', icon: 'credit_card' },
]

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  const isPro = user?.plan === 'pro' || user?.plan === 'lifetime'
  const isAdmin = user?.role === 'admin'
  const planDisplay =
    user?.plan === 'pro'
      ? 'Pro Tier'
      : user?.plan === 'lifetime'
      ? 'Lifetime'
      : 'Free Tier'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside
      style={{ width: collapsed ? '64px' : '240px' }}
      className="fixed left-0 top-0 bottom-0 z-50 bg-[#0D0D0D] border-r border-[#1A1A1A] flex flex-col justify-between overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out"
    >
      <div className="flex flex-col">
        {/* ── LOGO ─────────────────────────────────────── */}
        <div
          className={`h-16 border-b border-[#1A1A1A] flex items-center shrink-0 ${
            collapsed ? 'justify-center px-2' : 'px-4 gap-2'
          }`}
        >
          <Link
            to="/dashboard"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {collapsed ? (
              <span className="w-8 h-8 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 flex items-center justify-center text-[#22C55E] font-extrabold text-sm">
                S
              </span>
            ) : (
              <Logo className="h-7 w-auto" />
            )}
          </Link>
        </div>

        {/* ── USER CARD ────────────────────────────────── */}
        <div
          className={`border-b border-[#1A1A1A] shrink-0 ${
            collapsed ? 'py-3 flex justify-center' : 'p-3'
          }`}
        >
          {collapsed ? (
            <Link
              to="/dashboard/settings"
              title={user?.full_name || 'User'}
              className="w-8 h-8 rounded-lg bg-[#1c1b1b] border border-white/10 flex items-center justify-center text-[#22c55e] font-semibold text-xs"
            >
              {initials}
            </Link>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#1c1b1b] border border-white/10 flex items-center justify-center text-[#22c55e] font-semibold text-xs shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-white truncate max-w-[95px] font-medium">
                    {user?.full_name || 'Operator'}
                  </span>
                  <span className="text-[11px] text-[#737373] truncate max-w-[95px]">
                    {planDisplay}
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 border ${
                  isPro
                    ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                    : 'bg-[#1A1A1A] text-[#737373] border-[#1A1A1A]'
                }`}
              >
                {isPro ? 'PRO' : 'FREE'}
              </span>
            </div>
          )}
        </div>

        {/* ── NAV ITEMS ────────────────────────────────── */}
        <nav className="flex flex-col py-2">
          {NAV_ITEMS.map((item) => (
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
                    ? 'bg-[#22C55E]/[0.12] text-[#22C55E] border-[#22C55E]'
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

          {/* ── ADMIN SECTION (role === 'admin' only) ──── */}
          {isAdmin && (
            <>
              {!collapsed && (
                <span className="block px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#EF4444]/70 border-t border-[#1A1A1A] mt-2">
                  Root Access
                </span>
              )}
              <NavLink
                to="/admin"
                title={collapsed ? 'Admin Console' : undefined}
                className={({ isActive }) =>
                  [
                    'flex items-center transition-colors text-sm font-medium border-l-2',
                    collapsed
                      ? 'justify-center px-2 py-3 border-t border-[#1A1A1A] mt-2 pt-3'
                      : 'gap-3 px-4 py-2.5',
                    isActive
                      ? 'bg-[#EF4444]/[0.12] text-[#EF4444] border-[#EF4444]'
                      : 'text-[#EF4444]/70 hover:bg-[#EF4444]/10 hover:text-[#EF4444] border-transparent',
                  ].join(' ')
                }
              >
                <span className="material-symbols-outlined text-[20px] shrink-0">
                  shield_person
                </span>
                {!collapsed && (
                  <span className="truncate flex items-center gap-1.5">
                    Admin Console
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[#EF4444]/15 border border-[#EF4444]/30">
                      Root
                    </span>
                  </span>
                )}
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* ── BOTTOM: UPGRADE + LOGOUT ─────────────────── */}
      <div
        className={`flex flex-col gap-2 border-t border-[#1A1A1A] shrink-0 ${
          collapsed ? 'p-2' : 'p-3'
        }`}
      >
        {!collapsed && !isPro && (
          <div className="bg-[#22c55e]/[0.08] border border-[#22c55e]/[0.2] rounded-lg p-3 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[#22c55e]">
              Pro Telemetry
            </span>
            <p className="text-[11px] text-[#737373] leading-snug">
              Unlock neural matching & verified employer audits.
            </p>
            <Link
              to="/dashboard/billing"
              className="text-center bg-[#22c55e] hover:bg-[#16A34A] text-black text-[11px] font-semibold py-1.5 rounded-md transition-colors"
            >
              Upgrade to Pro
            </Link>
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
  )
}