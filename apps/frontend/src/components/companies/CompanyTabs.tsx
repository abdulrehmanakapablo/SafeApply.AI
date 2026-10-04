// FILE: src/components/companies/CompanyTabs.tsx
// PURPOSE: Navigation between a company's public pages, plus a share link.

import { NavLink } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon, cn } from '../ui'

export default function CompanyTabs({ slug, verified = true }: { slug: string; verified?: boolean }) {
  const tabs = [
    { to: `/companies/${slug}`, label: 'Overview', end: true },
    ...(verified
      ? [
          { to: `/companies/${slug}/hiring-record`, label: 'Hiring record' },
          { to: `/c/${slug}/ghosting`, label: 'Ghosting' },
        ]
      : []),
    { to: `/c/${slug}/interview-process`, label: 'Interviews' },
    { to: `/c/${slug}/salaries`, label: 'Salaries' },
  ]

  async function share() {
    const url = `${window.location.origin}/share/employer/${slug}`
    try {
      if (navigator.share) await navigator.share({ url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-line">
      <nav aria-label="Company pages" className="flex-1 min-w-0 flex gap-1 overflow-x-auto -mb-px [scrollbar-width:none]">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cn('shrink-0 px-3 h-10 inline-flex items-center text-sm border-b-2 transition-colors', isActive ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" onClick={share} className="shrink-0 h-8 px-2.5 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg rounded-[8px] hover:bg-line/60">
        <Icon name="ios_share" className="text-[16px]" />
        Share
      </button>
    </div>
  )
}
