// FILE: src/components/layout/AdminLayout.tsx
// PURPOSE: Shell for /admin routes. Top bar + tab navigation; no sidebar,
//          so admin screens get the full width for tables.

import { Link, NavLink, Outlet, useNavigate, useNavigation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import { Badge, Icon, cn, initialsOf } from '../ui'
import { useAuthStore } from '../../store/authStore'
import { PORTALS, PORTAL_LABEL, portalBase, type Portal } from '../../lib/roles'

const NAV = [
  { to: '/admin', label: 'Overview', icon: 'space_dashboard', end: true },
  { to: '/admin/reviews', label: 'Reviews', icon: 'rate_review' },
  { to: '/admin/companies', label: 'Companies', icon: 'domain_verification' },
  { to: '/admin/projects', label: 'Projects', icon: 'work' },
  { to: '/admin/users', label: 'Users', icon: 'group' },
  { to: '/admin/payments', label: 'Payments', icon: 'payments' },
  { to: '/admin/trust', label: 'Trust', icon: 'shield' },
  { to: '/admin/disputes', label: 'Disputes', icon: 'gavel' },
  { to: '/admin/budget', label: 'Budget', icon: 'savings' },
  { to: '/admin/revenue', label: 'Plans', icon: 'workspace_premium' },
]

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useNavigation().state === 'loading'

  return (
    <div className="min-h-[100dvh] bg-ink text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-accent focus:text-ink focus:px-3 focus:py-2 focus:rounded-[8px] focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 bg-ink/85 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between gap-3">
            <Link to="/admin" className="flex items-center gap-2.5" aria-label="Admin home">
              <Logo mark className="h-7 w-7" />
              <span className="text-sm font-semibold hidden sm:inline">SafeApply.AI</span>
              <Badge tone="danger">Admin</Badge>
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <PortalSwitch />
              <span className="w-8 h-8 rounded-[8px] bg-line flex items-center justify-center text-xs font-semibold" title={user?.email} aria-hidden>
                {initialsOf(user?.full_name, 'A')}
              </span>
            </div>
          </div>
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto -mb-px">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }: { isActive: boolean }) =>
                  cn('relative shrink-0 h-10 px-3 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg')
                }
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon name={n.icon} className="text-[17px]" />
                    {n.label}
                    {isActive && <motion.span layoutId="admin-tab" className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full bg-accent" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div aria-hidden className={cn('absolute left-0 right-0 bottom-0 h-[2px] bg-accent origin-left transition-transform duration-500', loading ? 'scale-x-75' : 'scale-x-0')} />
      </header>
      <main id="main">
        <Outlet />
      </main>
    </div>
  )
}

/** Admins work in exactly one portal at a time; switching is explicit. */
function PortalSwitch() {
  const navigate = useNavigate()
  const current = useAuthStore((s) => s.adminPortal)
  const setAdminPortal = useAuthStore((s) => s.setAdminPortal)
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <Icon name="swap_horiz" className="text-[18px]" />
      <span className="sr-only">Open portal</span>
      <select
        value=""
        onChange={(e) => {
          const p = e.target.value as Portal
          if (!p) return
          setAdminPortal(p)
          navigate(portalBase(p))
        }}
        className="h-8 px-2 rounded-[var(--radius-input)] bg-surface border border-line text-sm text-fg"
      >
        <option value="">Switch portal</option>
        {PORTALS.map((p) => (
          <option key={p} value={p}>
            {PORTAL_LABEL[p]}
            {p === current ? ' (current)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
