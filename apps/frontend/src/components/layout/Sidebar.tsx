// FILE: src/components/layout/Sidebar.tsx
// PURPOSE: Dashboard navigation. Desktop: fixed rail, collapsible to icons.
//          Mobile (< lg): slide-in drawer controlled by uiStore.mobileNavOpen.

import { useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import Logo from '../ui/Logo'
import { Icon, cn, initialsOf } from '../ui'
import { logout as apiLogout } from '../../api/auth'
import { useBillingStatus } from '../../api/billing'
import { LevelChip } from '../trust/TrustBits'
import { activePortal, homeFor, portalBase, type Portal } from '../../lib/roles'

interface NavItem {
  label: string
  to: string
  icon: string
  exact?: boolean
}

const SEEKER_GROUPS: Array<{ label?: string; items: NavItem[] }> = [
  { items: [{ label: 'Overview', to: '/dashboard', icon: 'space_dashboard', exact: true }] },
  {
    label: 'Research',
    items: [
      { label: 'Jobs', to: '/jobs', icon: 'work' },
      { label: 'Company reports', to: '/dashboard/company-report', icon: 'travel_explore' },
      { label: 'Company reviews', to: '/companies', icon: 'reviews' },
      { label: 'Write a review', to: '/dashboard/review', icon: 'rate_review' },
    ],
  },
  {
    label: 'CV',
    items: [
      { label: 'CV match', to: '/dashboard/cv-match', icon: 'compare_arrows' },
      { label: 'CV builder', to: '/dashboard/cv-builder', icon: 'edit_document', exact: true },
      { label: 'Saved CVs', to: '/dashboard/cv-builder/saved', icon: 'folder_open' },
    ],
  },
  {
    label: 'Applications',
    items: [
      { label: 'Tracker', to: '/dashboard/tracker', icon: 'view_kanban' },
      { label: 'Messages', to: '/dashboard/messages', icon: 'forum' },
      { label: 'Interviews', to: '/dashboard/interviews', icon: 'event' },
      { label: 'Analytics', to: '/dashboard/analytics', icon: 'monitoring' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My progress', to: '/me/progress', icon: 'insights' },
      { label: 'Plan & billing', to: '/dashboard/billing', icon: 'credit_card' },
    ],
  },
]

type Groups = Array<{ label?: string; items: NavItem[] }>

const FREELANCER_GROUPS: Groups = [
  { items: [{ label: 'Overview', to: '/freelancer', icon: 'space_dashboard', exact: true }] },
  {
    label: 'Work',
    items: [
      { label: 'Find projects', to: '/projects', icon: 'travel_explore' },
      { label: 'Proposals', to: '/freelancer/proposals', icon: 'send' },
      { label: 'Contracts', to: '/freelancer/contracts', icon: 'handshake' },
      { label: 'Invoices', to: '/freelancer/invoices', icon: 'receipt_long' },
      { label: 'Verified work', to: '/freelancer/work', icon: 'verified' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My profile', to: '/freelancer/profile', icon: 'badge' },
      { label: 'My progress', to: '/me/progress', icon: 'insights' },
      { label: 'Plan & billing', to: '/freelancer/billing', icon: 'credit_card' },
    ],
  },
]

const CLIENT_GROUPS: Groups = [
  { items: [{ label: 'Overview', to: '/client', icon: 'space_dashboard', exact: true }] },
  {
    label: 'Hiring',
    items: [
      { label: 'My projects', to: '/client/projects', icon: 'folder_open' },
      { label: 'Contracts', to: '/client/contracts', icon: 'handshake' },
      { label: 'Invoices', to: '/client/invoices', icon: 'receipt_long' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My progress', to: '/me/progress', icon: 'insights' },
      { label: 'Plan & billing', to: '/client/billing', icon: 'credit_card' },
    ],
  },
]

const RECRUITER_GROUPS: Array<{ label?: string; items: NavItem[] }> = [
  { items: [{ label: 'Overview', to: '/recruiter', icon: 'space_dashboard', exact: true }] },
  {
    label: 'Hiring',
    items: [
      { label: 'Jobs', to: '/recruiter/jobs', icon: 'work' },
      { label: 'Find talent', to: '/recruiter/talent', icon: 'person_search' },
      { label: 'Interviews', to: '/recruiter/interviews', icon: 'event' },
      { label: 'Messages', to: '/recruiter/messages', icon: 'forum' },
      { label: 'Analytics', to: '/recruiter/analytics', icon: 'monitoring' },
    ],
  },
  {
    label: 'Company',
    items: [
      { label: 'Company profile', to: '/recruiter/company', icon: 'apartment' },
      { label: 'Team', to: '/recruiter/team', icon: 'group' },
      { label: 'Disputes', to: '/disputes', icon: 'gavel' },
      { label: 'Reviews', to: '/recruiter/reviews', icon: 'reviews' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My progress', to: '/me/progress', icon: 'insights' },
      { label: 'Plan & billing', to: '/recruiter/billing', icon: 'credit_card' },
    ],
  },
]

const GROUPS: Record<Portal, Groups> = { seeker: SEEKER_GROUPS, recruiter: RECRUITER_GROUPS, freelancer: FREELANCER_GROUPS, client: CLIENT_GROUPS }

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const adminPortal = useAuthStore((s) => s.adminPortal)
  const portal = activePortal(user?.role, adminPortal)

  const link = (item: NavItem, danger = false) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.exact}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center rounded-[8px] text-[13.5px] font-medium transition-colors',
          collapsed ? 'justify-center h-10 w-10 mx-auto' : 'gap-3 h-9 px-3',
          isActive
            ? danger
              ? 'bg-danger/10 text-danger'
              : 'bg-line text-fg'
            : danger
              ? 'text-danger/80 hover:text-danger hover:bg-danger/10'
              : 'text-muted hover:text-fg hover:bg-line/60',
        )
      }
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {isActive && !danger && !collapsed && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-accent" aria-hidden />}
          <Icon name={item.icon} className={cn('text-[19px] shrink-0', isActive && !danger && 'text-accent')} />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  )

  return (
    <nav aria-label={`${portal} navigation`} className="flex flex-col gap-5 px-3 py-4">
      {GROUPS[portal].map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.label && !collapsed && <span className="px-3 pb-1.5 text-[12px] text-muted/80">{g.label}</span>}
          {g.label && collapsed && <span className="mx-auto mb-1 h-px w-6 bg-line" aria-hidden />}
          {g.items.map((it) => link(it))}
        </div>
      ))}
      {isAdmin && (
        <div className="flex flex-col gap-0.5">
          {!collapsed ? <span className="px-3 pb-1.5 text-[12px] text-muted/80">Admin</span> : <span className="mx-auto mb-1 h-px w-6 bg-line" aria-hidden />}
          {link({ label: 'Admin console', to: '/admin', icon: 'admin_panel_settings' }, true)}
        </div>
      )}
    </nav>
  )
}

function Footer({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const status = useBillingStatus(user?.role !== 'admin')
  const portal = activePortal(user?.role, useAuthStore((s) => s.adminPortal))

  async function handleLogout() {
    try {
      await apiLogout()
    } catch {
      /* clear locally regardless */
    }
    logout()
    navigate('/login')
  }

  return (
    <div className={cn('border-t border-line', collapsed ? 'p-2 flex flex-col items-center gap-1' : 'p-3 flex flex-col gap-1')}>
      {!collapsed && status && !status.pro && (
        <Link to="/billing/checkout" onClick={onNavigate} className="mb-2 rounded-[10px] border border-accent/30 px-3 py-2.5 hover:border-accent/60 transition-colors">
          <p className="text-[13px] font-medium text-fg flex items-center gap-1.5">
            Free plan <span className="text-accent">· Upgrade</span>
          </p>
          <p className="text-xs text-muted mt-0.5">See what Pro unlocks for {portal === 'seeker' ? 'job seekers' : `${portal}s`}.</p>
        </Link>
      )}
      {!collapsed && status && portal !== 'seeker' && (
        <div className="mb-2 px-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{portal === 'recruiter' ? 'Company level' : 'Your level'}</span>
          <LevelChip level={status.trust_level} />
        </div>
      )}
      {!collapsed && status?.pro && status.until && (
        <p className="mb-2 px-3 text-xs text-muted">Pro until {new Date(status.until).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
      )}
      <NavLink
        to={`${portalBase(portal)}/settings`}
        onClick={onNavigate}
        title={collapsed ? 'Settings' : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-[8px] transition-colors',
            collapsed ? 'justify-center h-10 w-10' : 'gap-3 px-2 py-2',
            isActive ? 'bg-line' : 'hover:bg-line/60',
          )
        }
      >
        <span className="w-7 h-7 rounded-[8px] bg-accent/15 text-accent text-[11px] font-semibold flex items-center justify-center shrink-0">
          {initialsOf(user?.full_name || user?.email, 'U')}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-fg font-medium truncate">{user?.full_name || 'Your account'}</span>
            <span className="block text-xs text-muted truncate">{user?.email}</span>
          </span>
        )}
        {!collapsed && <Icon name="settings" className="text-[18px] text-muted" />}
      </NavLink>
      <button
        type="button"
        onClick={handleLogout}
        title={collapsed ? 'Log out' : undefined}
        className={cn(
          'flex items-center rounded-[8px] text-[13.5px] text-muted hover:text-danger hover:bg-danger/10 transition-colors',
          collapsed ? 'justify-center h-10 w-10' : 'gap-3 h-9 px-3',
        )}
      >
        <Icon name="logout" className="text-[19px]" />
        {!collapsed && 'Log out'}
      </button>
    </div>
  )
}

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const mobileOpen = useUIStore((s) => s.mobileNavOpen)
  const setMobileOpen = useUIStore((s) => s.setMobileNavOpen)
  const location = useLocation()
  const reduce = useReducedMotion()
  const role = useAuthStore((s) => s.user?.role)
  const adminPortal = useAuthStore((s) => s.adminPortal)

  useEffect(() => setMobileOpen(false), [location.pathname, setMobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, setMobileOpen])

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-ink border-r border-line transition-[width] duration-200 ease-out',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('h-16 flex items-center border-b border-line shrink-0', collapsed ? 'justify-center' : 'px-5')}>
          <Link to={homeFor(role, adminPortal)} aria-label="Home">
            {collapsed ? <Logo mark className="h-8 w-8" /> : <Logo className="h-7 w-auto" />}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <NavList collapsed={collapsed} />
        </div>
        <Footer collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-[90]">
            <motion.div
              className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.18 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-ink border-r border-line flex flex-col"
              initial={reduce ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
              <div className="h-16 flex items-center justify-between px-5 border-b border-line shrink-0">
                <Logo className="h-7 w-auto" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="w-9 h-9 -mr-2 rounded-[8px] flex items-center justify-center text-muted hover:text-fg hover:bg-line transition-colors"
                >
                  <Icon name="close" className="text-[20px]" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
              <Footer collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
