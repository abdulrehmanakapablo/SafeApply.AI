// FILE: src/components/layout/TopBar.tsx
// PURPOSE: Slim top bar. Mobile: menu button + logo. Desktop: collapse toggle
//          + page title.

import { Link, useLocation } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import { Icon, cn } from '../ui'
import NotificationBell from './NotificationBell'
import { useAuthStore } from '../../store/authStore'
import { homeFor } from '../../lib/roles'

const TITLES: Array<[RegExp, string]> = [
  [/^\/dashboard\/?$/, 'Overview'],
  [/^\/dashboard\/company-report\/history/, 'Report history'],
  [/^\/dashboard\/company-report/, 'Company report'],
  [/^\/dashboard\/cv-match/, 'CV match'],
  [/^\/dashboard\/cv-builder\/saved/, 'Saved CVs'],
  [/^\/dashboard\/cv-builder/, 'CV builder'],
  [/^\/dashboard\/tracker\/.+/, 'Application'],
  [/^\/dashboard\/tracker/, 'Tracker'],
  [/^\/dashboard\/analytics/, 'Analytics'],
  [/^\/dashboard\/review/, 'Write a review'],
  [/^\/dashboard\/settings/, 'Settings'],
  [/^\/(dashboard|recruiter|freelancer|client)\/billing/, 'Plan & billing'],
  [/^\/billing\/checkout/, 'Upgrade'],
  [/^\/billing\/manual/, 'Payment'],
  [/^\/billing\/history/, 'Payment history'],
  [/^\/dashboard\/messages/, 'Messages'],
  [/^\/dashboard\/applications\/.+/, 'Application'],
  [/^\/(dashboard|recruiter)\/interviews\/new/, 'Schedule interview'],
  [/^\/(dashboard|recruiter)\/interviews/, 'Interviews'],
  [/^\/interviews\/.+/, 'Interview'],
  [/^\/recruiter\/?$/, 'Overview'],
  [/^\/recruiter\/jobs\/new/, 'New job'],
  [/^\/recruiter\/jobs\/.+\/edit/, 'Edit job'],
  [/^\/recruiter\/jobs\/.+\/close/, 'Close job'],
  [/^\/recruiter\/jobs\/.+/, 'Pipeline'],
  [/^\/recruiter\/jobs/, 'Jobs'],
  [/^\/recruiter\/applicants/, 'Applicant'],
  [/^\/recruiter\/messages/, 'Messages'],
  [/^\/recruiter\/company/, 'Company profile'],
  [/^\/recruiter\/reviews/, 'Reviews'],
  [/^\/recruiter\/team\/invite/, 'Invite teammate'],
  [/^\/recruiter\/team/, 'Team'],
  [/^\/recruiter\/talent\/saved/, 'Saved talent'],
  [/^\/recruiter\/talent/, 'Find talent'],
  [/^\/recruiter\/analytics/, 'Analytics'],
  [/^\/team\/join/, 'Join team'],
  [/^\/disputes/, 'Disputes'],
  [/^\/recruiter\/settings/, 'Settings'],
  [/^\/freelancer\/?$/, 'Overview'],
  [/^\/freelancer\/proposals/, 'Proposals'],
  [/^\/(freelancer|client)\/contracts\/.+/, 'Contract'],
  [/^\/(freelancer|client)\/contracts/, 'Contracts'],
  [/^\/freelancer\/profile/, 'My profile'],
  [/^\/freelancer\/work/, 'Verified work'],
  [/^\/freelancer\/clients\/invite/, 'Invite a client'],
  [/^\/(freelancer|client)\/invoices\/.+/, 'Invoice'],
  [/^\/(freelancer|client)\/invoices/, 'Invoices'],
  [/^\/(freelancer|client)\/settings/, 'Settings'],
  [/^\/client\/?$/, 'Overview'],
  [/^\/client\/projects\/new/, 'Post a project'],
  [/^\/client\/projects\/.+\/edit/, 'Edit project'],
  [/^\/client\/projects\/.+/, 'Project'],
  [/^\/client\/projects/, 'My projects'],
  [/^\/projects\/.+/, 'Project'],
  [/^\/projects/, 'Find projects'],
  [/^\/me\/progress/, 'My progress'],
  [/^\/me\/badges/, 'Badges'],
  [/^\/leaderboards/, 'Leaderboards'],
  [/^\/jobs\/.+/, 'Job'],
  [/^\/jobs/, 'Jobs'],
  [/^\/companies\/.+\/hiring-record/, 'Hiring record'],
  [/^\/companies\/.+/, 'Company'],
  [/^\/companies/, 'Company reviews'],
]

export default function TopBar() {
  const { pathname } = useLocation()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)
  const openMobile = useUIStore((s) => s.setMobileNavOpen)
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] || 'Dashboard'
  const role = useAuthStore((s) => s.user?.role)
  const adminPortal = useAuthStore((s) => s.adminPortal)

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-30 h-14 bg-ink/85 backdrop-blur-md border-b border-line flex items-center justify-between gap-3 px-4 sm:px-6 transition-[left] duration-200 ease-out',
        collapsed ? 'lg:left-16' : 'lg:left-60',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => openMobile(true)}
          aria-label="Open navigation"
          className="lg:hidden w-9 h-9 -ml-2 rounded-[8px] flex items-center justify-center text-muted hover:text-fg hover:bg-line transition-colors"
        >
          <Icon name="menu" className="text-[22px]" />
        </button>
        <Link to={homeFor(role, adminPortal)} className="lg:hidden mr-1" aria-label="Home">
          <Logo mark className="h-7 w-7" />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex w-8 h-8 -ml-1.5 rounded-[8px] items-center justify-center text-muted hover:text-fg hover:bg-line transition-colors"
        >
          <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} className="text-[20px]" />
        </button>
        <span className="text-sm font-medium text-fg truncate">{title}</span>
      </div>
      <ThemeToggle />
      <NotificationBell />
    </header>
  )
}
