// FILE: src/components/layout/PublicLayout.tsx
// PURPOSE: One nav + one footer for every public page (Landing, Companies,
//          Blog, About, Pricing, legal). Auth-aware, active-link aware,
//          mobile sheet menu, skip link.

import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import { ButtonLink, Icon, cn, initialsOf } from '../ui'
import { homeFor } from '../../lib/roles'
import { useAuthStore, useIsAuthed } from '../../store/authStore'

const NAV = [
  { to: '/#how', label: 'How it works', hash: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/companies', label: 'Companies' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/freelance', label: 'Freelance' },
  { to: '/recruiters', label: 'For recruiters' },
]

export const CONTACT_EMAIL = 'hello@safeapply.ai'

export function PublicNav({ transparent = false }: { transparent?: boolean }) {
  const authed = useIsAuthed()
  const user = useAuthStore((s) => s.user)
  const adminPortal = useAuthStore((s) => s.adminPortal)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const reduce = useReducedMotion()

  useEffect(() => setOpen(false), [location.pathname, location.hash])

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-accent focus:text-ink focus:px-3 focus:py-2 focus:rounded-[8px] focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 border-b transition-colors',
          transparent ? 'bg-ink/70 border-transparent backdrop-blur-md' : 'bg-ink/85 border-line backdrop-blur-md',
        )}
      >
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          <Link to="/" aria-label="SafeApply.AI home" className="shrink-0">
            <Logo className="h-8 w-auto" />
          </Link>

          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {NAV.map((n) =>
              n.hash ? (
                <Link key={n.to} to={n.to} className="px-3 py-2 text-sm text-muted hover:text-fg transition-colors rounded-[8px]">
                  {n.label}
                </Link>
              ) : (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn('px-3 py-2 text-sm rounded-[8px] transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg')
                  }
                >
                  {n.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <ThemeToggle />
            {authed ? (
              <>
                <ButtonLink to={homeFor(user?.role, adminPortal)} variant="secondary" size="sm">
                  Dashboard
                </ButtonLink>
                <Link
                  to={`${homeFor(user?.role, adminPortal)}/settings`}
                  title={user?.email || ''}
                  className="w-8 h-8 rounded-[8px] bg-accent/15 text-accent text-xs font-semibold flex items-center justify-center hover:bg-accent/25 transition-colors"
                >
                  {initialsOf(user?.full_name || user?.email, 'U')}
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 text-sm text-muted hover:text-fg transition-colors">
                  Log in
                </Link>
                <ButtonLink to="/signup" size="sm">
                  Start free
                </ButtonLink>
              </>
            )}
          </div>

          <ThemeToggle className="md:hidden ml-auto" />
          <button
            type="button"
            className="md:hidden w-10 h-10 -mr-2 flex items-center justify-center rounded-[8px] text-fg hover:bg-line transition-colors"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} className="text-[22px]" />
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              aria-label="Mobile"
              className="md:hidden border-t border-line bg-ink px-4 pb-6 pt-2"
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <ul className="flex flex-col">
                {NAV.map((n) => (
                  <li key={n.to}>
                    <Link to={n.to} className="block py-3 text-[15px] text-fg border-b border-line">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-2 gap-2 mt-5">
                {authed ? (
                  <ButtonLink to={homeFor(user?.role, adminPortal)} className="col-span-2">
                    Dashboard
                  </ButtonLink>
                ) : (
                  <>
                    <ButtonLink to="/login" variant="secondary">
                      Log in
                    </ButtonLink>
                    <ButtonLink to="/signup">Start free</ButtonLink>
                  </>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-3 max-w-xs">
          <Logo className="h-7 w-auto self-start" />
          <p className="text-sm text-muted leading-relaxed">
            Research the company before you send the CV. Every claim links back to its source.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-fg hover:text-accent transition-colors w-fit">
            {CONTACT_EMAIL}
          </a>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2.5 text-sm">
          <span className="text-muted mb-1">Product</span>
          <Link to="/jobs" className="text-fg/90 hover:text-accent transition-colors w-fit">Jobs</Link>
          <Link to="/companies" className="text-fg/90 hover:text-accent transition-colors w-fit">Company reviews</Link>
          <Link to="/recruiters" className="text-fg/90 hover:text-accent transition-colors w-fit">For recruiters</Link>
          <Link to="/freelance" className="text-fg/90 hover:text-accent transition-colors w-fit">Freelance</Link>
          <Link to="/leaderboards" className="text-fg/90 hover:text-accent transition-colors w-fit">Employer leaderboards</Link>
          <Link to="/projects" className="text-fg/90 hover:text-accent transition-colors w-fit">Freelance projects</Link>
          <Link to="/pricing" className="text-fg/90 hover:text-accent transition-colors w-fit">Pricing</Link>
          <Link to="/signup" className="text-fg/90 hover:text-accent transition-colors w-fit">Create account</Link>
        </nav>
        <nav aria-label="Company" className="flex flex-col gap-2.5 text-sm">
          <span className="text-muted mb-1">Company</span>
          <Link to="/about" className="text-fg/90 hover:text-accent transition-colors w-fit">About</Link>
          <Link to="/blog" className="text-fg/90 hover:text-accent transition-colors w-fit">Blog</Link>
          <Link to="/privacy" className="text-fg/90 hover:text-accent transition-colors w-fit">Privacy</Link>
          <Link to="/terms" className="text-fg/90 hover:text-accent transition-colors w-fit">Terms</Link>
        </nav>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-t border-line text-xs text-muted">
        © {new Date().getFullYear()} SafeApply.AI. Data is pulled from public sources and linked so you can check it yourself.
      </div>
    </footer>
  )
}

export default function PublicLayout({ children, transparentNav }: { children: ReactNode; transparentNav?: boolean }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-ink text-fg">
      <PublicNav transparent={transparentNav} />
      <main id="main" className="flex-1 pt-16">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
