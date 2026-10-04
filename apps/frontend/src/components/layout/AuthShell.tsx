// FILE: src/components/layout/AuthShell.tsx
// PURPOSE: Shared frame for Login / Signup / Forgot / Reset.
//          Form on the left, a plain statement of what the account gets
//          on the right (lg+). No fake security badges.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import { Icon } from '../ui'
import { Reveal } from '../motion/Reveal'

const RECRUITER_POINTS = [
  { icon: 'domain_verification', title: 'A verified company page', body: 'Candidates see that your company is real before they apply.' },
  { icon: 'view_kanban', title: 'A pipeline that keeps people informed', body: 'Every stage change reaches the candidate’s tracker, so nobody is left waiting.' },
  { icon: 'forum', title: 'Messages and review replies', body: 'Talk to applicants in one place and reply publicly to reviews of your company.' },
]

const FREELANCER_POINTS = [
  { icon: 'payments', title: 'Budgets on every project', body: 'No guessing what a client can pay. Every project shows its range.' },
  { icon: 'flag', title: 'Milestones agreed up front', body: 'You and the client split the work before it starts, and approve it step by step.' },
  { icon: 'reviews', title: 'Reviews both ways', body: 'Clients review you, and you review them. Nobody can delete a review.' },
]

const CLIENT_POINTS = [
  { icon: 'send', title: 'Proposals with real profiles', body: 'See each freelancer’s finished contracts and client reviews before you hire.' },
  { icon: 'flag', title: 'Pay for progress', body: 'Split the work into milestones and approve each one when it’s done.' },
  { icon: 'forum', title: 'Everything in one thread', body: 'Messages, hand-ins and decisions stay on the contract.' },
]

const ASIDE = {
  seeker: { headline: 'Know who you’re applying to before they know who you are.', points: [] as typeof RECRUITER_POINTS },
  recruiter: { headline: 'Hire from people who can trust you.', points: RECRUITER_POINTS },
  freelancer: { headline: 'Work for clients who show their budget.', points: FREELANCER_POINTS },
  client: { headline: 'Hire freelancers and pay for progress.', points: CLIENT_POINTS },
}

const POINTS = [
  { icon: 'travel_explore', title: 'Company reports', body: 'News, GitHub activity and repeat postings for any employer, each linked to its source.' },
  { icon: 'compare_arrows', title: 'CV against the job', body: 'See which requirements your CV covers, which it misses, and rewrite bullets in the job’s language.' },
  { icon: 'view_kanban', title: 'One place to track it', body: 'Every application, status change and follow-up in a single board.' },
]

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  aside = true,
  variant = 'seeker',
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  aside?: boolean
  variant?: keyof typeof ASIDE
}) {
  const aside_ = ASIDE[variant]
  const points = variant === 'seeker' ? POINTS : aside_.points
  return (
    <div className="min-h-[100dvh] bg-ink text-fg grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col min-h-[100dvh]">
        <header className="h-16 px-5 sm:px-8 flex items-center justify-between">
          <Link to="/" aria-label="SafeApply.AI home">
            <Logo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/" className="text-sm text-muted hover:text-fg transition-colors inline-flex items-center gap-1">
              <Icon name="arrow_back" className="text-[16px]" />
              Back to site
            </Link>
          </div>
        </header>

        <main id="main" className="flex-1 flex items-center justify-center px-5 sm:px-8 py-10">
          <Reveal className="w-full max-w-[400px]">
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted mt-2 leading-relaxed">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
          </Reveal>
        </main>

        <footer className="px-5 sm:px-8 py-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          <span>© {new Date().getFullYear()} SafeApply.AI</span>
          <Link to="/privacy" className="hover:text-fg transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-fg transition-colors">Terms</Link>
        </footer>
      </div>

      {aside && (
        <aside className="hidden lg:flex relative overflow-hidden border-l border-line bg-surface">
          <div
            aria-hidden
            className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full opacity-[0.10]"
            style={{ background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }}
          />
          <div className="relative flex flex-col justify-center px-14 xl:px-20 py-16 max-w-xl">
            <p className="text-[26px] font-semibold leading-snug tracking-tight">
              {aside_.headline}
            </p>
            <ul className="mt-10 flex flex-col gap-7">
              {points.map((p) => (
                <li key={p.title} className="flex gap-4">
                  <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
                    <Icon name={p.icon} className="text-[20px]" />
                  </span>
                  <div>
                    <p className="text-[15px] font-medium">{p.title}</p>
                    <p className="text-sm text-muted mt-1 leading-relaxed">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  )
}
