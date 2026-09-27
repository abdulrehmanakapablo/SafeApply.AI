// FILE: src/pages/admin/UserManagement.tsx
// BACKEND: GET /api/admin/users, PATCH /api/admin/users/:id

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../components/ui/Logo'

interface User {
  id: string
  email: string
  full_name: string
  plan: string
  role: string
  created_at: string
  last_active?: string
  banned?: boolean
}

interface Stats {
  total_users: number
  pro_users: number
  reports_today: number
  total_reviews: number
}

const PLAN_OPTIONS = ['free', 'pro', 'lifetime']

function StatusBadge({ banned }: { banned: boolean }) {
  if (banned) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/40 text-xs font-semibold">
        <span className="material-symbols-outlined text-[12px]">gpp_bad</span>
        BANNED
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 text-xs font-semibold">
      ACTIVE
    </span>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const LIMIT = 50

  const token = localStorage.getItem('access_token')
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(planFilter !== 'all' && { plan: planFilter }),
      })
      const res = await fetch(`/api/admin/users?${params}`, { headers })
      const data = await res.json()
      if (data.success) {
        setUsers(data.data || [])
        setTotal(data.total || 0)
      }
    } catch (e) {
      console.error('Failed to fetch users', e)
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { headers })
      const data = await res.json()
      if (data.success) setStats(data.data)
    } catch (e) {
      console.error('Failed to fetch stats', e)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchStats() }, [fetchStats])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers() }, 400)
    return () => clearTimeout(t)
  }, [search])

  async function handlePlanChange(userId: string, plan: string) {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ plan }),
      })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plan } : u))
    } catch (e) {
      console.error('Failed to update plan', e)
    }
  }

  async function handleToggleBan(user: User) {
    const newBanned = !user.banned
    try {
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ banned: newBanned }),
      })
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, banned: newBanned } : u))
    } catch (e) {
      console.error('Failed to toggle ban', e)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  // Keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('user-search')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1]">

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0e0e0e] border-b border-[#2a2a2a] h-16 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <Logo className="h-8 w-auto" />
          <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-[#2a2a2a]">
            <span className="text-[#bccbb9] text-xs font-semibold uppercase tracking-wider">Terminal</span>
            <span className="text-[#22C55E] text-xs font-bold font-mono">CTRL-SYS</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#201f1f] border border-[#2a2a2a] rounded text-xs">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span className="text-[#bccbb9] uppercase tracking-wider text-[11px]">
              Operator: <span className="text-white font-semibold">SEC-01 (ACTIVE)</span>
            </span>
          </div>
          <Link to="/companies" className="hidden md:block text-[#bccbb9] hover:text-white text-sm transition-colors">Public View</Link>
          <div className="w-8 h-8 rounded-full bg-[#2a2a2a] border border-[#353534] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#22C55E] text-[18px]">shield_person</span>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="fixed top-16 left-0 bottom-0 w-64 z-40 bg-[#0e0e0e] border-r border-[#2a2a2a] flex flex-col justify-between py-4">
        <div className="flex flex-col gap-6 px-2">
          <div className="flex flex-col gap-1">
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#737373] mb-1">Administration</span>
            {[
              { label: 'Admin Dashboard', path: '/admin' },
              { label: 'Review Moderation', path: '/admin/reviews' },
              { label: 'User Management', path: '/admin/users', active: true },
              { label: 'Revenue Dashboard', path: '/admin/revenue' },
            ].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded text-sm transition-colors border-l-2 ${
                  item.active
                    ? 'bg-[#201f1f] text-[#22C55E] border-[#22C55E] font-semibold'
                    : 'text-[#bccbb9] hover:text-white hover:bg-[#1c1b1b] border-transparent'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#737373] mb-1">System Resources</span>
            {[
              { label: 'Public Reviews', path: '/companies' },
              { label: 'API Telemetry', path: '/admin/api-status' },
            ].map((item) => (
              <Link key={item.path} to={item.path} className="px-3 py-2 rounded text-sm text-[#bccbb9] hover:text-white hover:bg-[#1c1b1b] border-l-2 border-transparent transition-colors">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="px-4 border-t border-[#2a2a2a]/60 pt-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[#bccbb9]">
            <span className="text-[11px] font-semibold uppercase">Network</span>
            <span className="text-[#22C55E] text-xs font-mono">99.98% OK</span>
          </div>
          <div className="text-[11px] text-[#737373]">SafeApply Core v4.1</div>
        </div>
      </aside>

      {/* Main */}
      <main className="pt-16 pl-64 min-h-screen bg-[#131313]">
        <div className="px-6 py-6 max-w-[80rem] mx-auto flex flex-col gap-6">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#2a2a2a] pb-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[#bccbb9]">
                <span className="material-symbols-outlined text-[#22C55E] text-[18px]">admin_panel_settings</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider">Access Control Core // Node SEC-USR</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">User Directory & Access Control</h1>
              <p className="text-sm text-[#bccbb9] max-w-2xl">
                Search, inspect accounts, manage subscription tiers, and enforce platform security policies.
              </p>
            </div>
            {/* Stat pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: 'Total', value: stats ? stats.total_users.toLocaleString() : '—', color: 'text-white', dot: 'bg-[#22C55E] animate-pulse' },
                { label: 'Pro', value: stats ? stats.pro_users.toLocaleString() : '—', color: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
              ].map((s) => (
                <div key={s.label} className="bg-[#1c1b1b] border border-[#2a2a2a] px-3 py-1 rounded flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-[#bccbb9] text-[11px] font-semibold uppercase">{s.label}:</span>
                  <span className={`font-mono text-xs font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search */}
            <div className="flex flex-1 items-center max-w-lg relative">
              <span className="material-symbols-outlined absolute left-3 text-[#737373] text-[20px] pointer-events-none">search</span>
              <input
                id="user-search"
                type="text"
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-16 bg-[#1c1b1b] border border-[#2a2a2a] rounded text-white placeholder:text-[#737373] text-sm focus:outline-none focus:border-[#22C55E] transition-colors"
              />
              <span className="absolute right-3 text-[#737373] text-[10px] font-mono px-1.5 py-0.5 bg-[#201f1f] rounded border border-[#2a2a2a]">
                CTRL+K
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Plan filter */}
              <div className="relative inline-flex items-center">
                <select
                  value={planFilter}
                  onChange={(e) => { setPlanFilter(e.target.value); setPage(1) }}
                  className="appearance-none h-10 pl-3 pr-8 bg-[#1c1b1b] border border-[#2a2a2a] rounded text-white text-sm cursor-pointer focus:outline-none focus:border-[#22C55E] transition-colors"
                >
                  <option value="all">Plan: All</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="lifetime">Lifetime</option>
                </select>
                <span className="material-symbols-outlined absolute right-2 text-[#737373] text-[18px] pointer-events-none">expand_more</span>
              </div>

              {/* Status filter */}
              <div className="relative inline-flex items-center">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none h-10 pl-3 pr-8 bg-[#1c1b1b] border border-[#2a2a2a] rounded text-white text-sm cursor-pointer focus:outline-none focus:border-[#22C55E] transition-colors"
                >
                  <option value="all">Status: All</option>
                  <option value="active">Active</option>
                  <option value="banned">Banned</option>
                </select>
                <span className="material-symbols-outlined absolute right-2 text-[#737373] text-[18px] pointer-events-none">expand_more</span>
              </div>

              <button className="h-10 px-3 bg-[#1c1b1b] border border-[#2a2a2a] hover:border-[#22C55E] hover:text-[#22C55E] text-white rounded text-sm flex items-center gap-1 transition-colors">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export Log
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1c1b1b] border border-[#2a2a2a] rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#0e0e0e] border-b border-[#2a2a2a]">
                    {['Email', 'Name', 'Plan', 'Joined', 'Last Active', 'Status', ''].map((h) => (
                      <th key={h} className="py-3 px-4 text-[11px] font-semibold text-[#737373] uppercase tracking-wider text-right last:text-right first:text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a2a] text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-[#737373]">
                        <span className="material-symbols-outlined animate-spin text-[32px] text-[#22C55E]">sync</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-[#737373]">No users found</td>
                    </tr>
                  ) : (
                    users
                      .filter((u) => {
                        if (statusFilter === 'active') return !u.banned
                        if (statusFilter === 'banned') return u.banned
                        return true
                      })
                      .map((user) => (
                        <tr
                          key={user.id}
                          className="transition-colors duration-150"
                          style={
                            user.banned
                              ? { backgroundColor: 'rgba(239,68,68,0.05)', borderLeft: '3px solid #EF4444' }
                              : undefined
                          }
                        >
                          {/* Email */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${user.banned ? 'bg-red-400' : 'bg-[#22C55E]'}`} />
                              <span className={`font-mono text-xs select-all ${user.banned ? 'line-through text-[#737373]' : 'text-white'}`}>
                                {user.email}
                              </span>
                            </div>
                          </td>

                          {/* Name */}
                          <td className="py-3 px-4 text-sm font-medium text-white">{user.full_name}</td>

                          {/* Plan dropdown */}
                          <td className="py-3 px-4">
                            <select
                              value={user.plan}
                              onChange={(e) => handlePlanChange(user.id, e.target.value)}
                              className={`bg-[#201f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs font-mono focus:border-[#22C55E] focus:outline-none cursor-pointer ${
                                user.plan === 'pro' || user.plan === 'lifetime' ? 'text-[#22C55E]' : 'text-[#737373]'
                              }`}
                            >
                              {PLAN_OPTIONS.map((p) => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                              ))}
                            </select>
                          </td>

                          {/* Joined */}
                          <td className="py-3 px-4 text-[#737373] text-xs">
                            {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>

                          {/* Last active */}
                          <td className="py-3 px-4 text-[#737373] text-xs font-mono">
                            {user.last_active ? new Date(user.last_active).toLocaleDateString() : '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <StatusBadge banned={!!user.banned} />
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button className="text-[#bccbb9] hover:text-white text-xs px-2 py-1 transition-colors">
                                View Profile
                              </button>
                              <button
                                onClick={() => handleToggleBan(user)}
                                className={`text-xs px-2 py-1 rounded border border-transparent transition-colors ${
                                  user.banned
                                    ? 'text-[#bccbb9] hover:text-[#22C55E] hover:bg-[#22C55E]/10 hover:border-[#22C55E]/30'
                                    : 'text-red-400 hover:bg-red-500/10 hover:border-red-500/30'
                                }`}
                              >
                                {user.banned ? 'Unban Account' : 'Ban Account'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 bg-[#0e0e0e] border-t border-[#2a2a2a] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-6 text-[#737373] text-sm">
                <span>
                  Showing <strong className="text-white font-mono">{Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)}</strong> of{' '}
                  <strong className="text-white font-mono">{total.toLocaleString()}</strong> users
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded bg-[#1c1b1b] border border-[#2a2a2a] text-[#737373] hover:text-white hover:border-[#353534] disabled:opacity-40 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>

                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded font-mono text-xs transition-colors ${
                      page === p
                        ? 'bg-[#22C55E] text-black font-bold'
                        : 'bg-[#1c1b1b] border border-[#2a2a2a] text-white hover:border-[#22C55E]'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                {totalPages > 3 && (
                  <>
                    <span className="px-1 text-[#737373] font-mono text-xs">...</span>
                    <button
                      onClick={() => setPage(totalPages)}
                      className="w-8 h-8 flex items-center justify-center rounded bg-[#1c1b1b] border border-[#2a2a2a] text-white font-mono text-xs hover:border-[#22C55E] transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="w-8 h-8 flex items-center justify-center rounded bg-[#1c1b1b] border border-[#2a2a2a] text-[#737373] hover:text-white hover:border-[#353534] disabled:opacity-40 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: 'Candidate Verification Rate',
                icon: 'verified_user',
                iconColor: 'text-[#22C55E]',
                value: '98.4%',
                sub: '+0.8% from prior 24h cycle',
                subColor: 'text-[#22C55E]',
                subIcon: 'trending_up',
              },
              {
                label: 'Automated Ban Trigger',
                icon: 'shield',
                iconColor: 'text-red-400',
                value: '14',
                sub: 'Heuristic bot mitigations today',
                subColor: 'text-[#737373]',
                subIcon: null,
              },
              {
                label: 'ATS API Ingestion Queue',
                icon: 'sync_alt',
                iconColor: 'text-[#62df7d]',
                value: '128 ops/s',
                sub: 'Telemetry synchronizer nominal',
                subColor: 'text-[#62df7d]',
                subIcon: null,
              },
            ].map((card) => (
              <div key={card.label} className="bg-[#1c1b1b] border border-[#2a2a2a] p-4 rounded flex flex-col gap-1">
                <div className="flex items-center justify-between text-[#bccbb9]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{card.label}</span>
                  <span className={`material-symbols-outlined text-[18px] ${card.iconColor}`}>{card.icon}</span>
                </div>
                <div className="text-2xl font-bold text-white">{card.value}</div>
                <div className={`text-xs flex items-center gap-1 ${card.subColor}`}>
                  {card.subIcon && <span className="material-symbols-outlined text-[14px]">{card.subIcon}</span>}
                  <span>{card.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}