// FILE: src/components/freelance/ContractList.tsx
// PURPOSE: Contract rows for both portals. `base` is /freelancer or /client.

import { Link } from 'react-router-dom'
import { ContractBadge } from './Bits'
import { money, type ContractRow } from '../../api/freelance'
import { EmptyState, SkeletonRows, relativeDays } from '../ui'

export default function ContractList({ rows, base, empty }: { rows: ContractRow[] | null; base: string; empty: string }) {
  if (!rows) {
    return (
      <div className="p-5">
        <SkeletonRows rows={3} />
      </div>
    )
  }
  if (!rows.length) return <EmptyState icon="handshake" title="No contracts yet" body={empty} />
  return (
    <ul className="divide-y divide-line">
      {rows.map((c) => {
        const pct = c.milestones_total ? Math.round((c.milestones_approved / c.milestones_total) * 100) : 0
        return (
          <li key={c.id}>
            <Link to={`${base}/contracts/${c.id}`} className="group flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-line/30 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate group-hover:text-accent transition-colors">{c.title}</p>
                <p className="text-xs text-muted truncate">
                  {c.side === 'client' ? 'Freelancer' : 'Client'}: {c.other_party} · started {relativeDays(c.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="w-28" aria-label={`${c.milestones_approved} of ${c.milestones_total} milestones approved`}>
                  <div className="h-1.5 rounded-full bg-line overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted tabular">
                    {c.milestones_approved}/{c.milestones_total} approved
                  </p>
                </div>
                <span className="text-sm tabular w-24 text-right">{money(c.amount, c.currency)}</span>
                {c.needs_action ? <span className="text-[11px] font-semibold text-warn w-20 text-right">Your move</span> : <span className="w-20 flex justify-end"><ContractBadge status={c.status} /></span>}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
