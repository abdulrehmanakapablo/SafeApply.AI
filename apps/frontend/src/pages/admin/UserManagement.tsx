// FILE: src/pages/admin/UserManagement.tsx
// ROUTE: /admin/users
// BACKEND: GET /api/admin/users?search=&plan=&page=, PATCH /api/admin/users/:id

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { getAdminUsers, updateAdminUser, type AdminUser } from '../../api/admin'
import { useAuthStore } from '../../store/authStore'
import { Alert, Badge, Card, ConfirmDialog, EmptyState, Icon, PageContainer, PageHeader, Pagination, SkeletonRows, formatDate, initialsOf } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Plan = AdminUser['plan']
type Role = AdminUser['role']
const PLANS: Plan[] = ['free', 'pro', 'lifetime']

type Pending = { user: AdminUser; patch: { plan?: Plan; role?: Role }; text: string }

export default function UserManagement() {
  const me = useAuthStore((s) => s.user)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState<Plan | ''>('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [input])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminUsers({ search: search || undefined, plan: plan || undefined, page })
      setRows(Array.isArray(res.data) ? res.data : [])
      setTotal(res.total || 0)
      setTotalPages(res.total_pages || 1)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load users.'))
    } finally {
      setLoading(false)
    }
  }, [search, plan, page])

  useEffect(() => {
    void load()
  }, [load])

  async function apply() {
    if (!pending) return
    setSaving(true)
    try {
      const res = await updateAdminUser(pending.user.id, pending.patch)
      if (!res.success) throw new Error(res.error)
      setRows((p) => p.map((u) => (u.id === pending.user.id ? { ...u, ...pending.patch } : u)))
      toast.success('User updated')
      setPending(null)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t update the user.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SEO title="Users | Admin | SafeApply.AI" description="Manage users." path="/admin/users" noindex />
      <PageContainer>
        <PageHeader title="Users" description={loading ? ' ' : `${total.toLocaleString()} ${search || plan ? 'matching' : 'in total'}.`} />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-muted pointer-events-none" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search name or email"
              aria-label="Search users"
              maxLength={80}
              className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm placeholder:text-muted/80 focus:outline-none focus:border-accent"
            />
          </div>
          <select
            aria-label="Filter by plan"
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value as Plan | '')
              setPage(1)
            }}
            className="h-10 px-3 rounded-[var(--radius-input)] bg-surface border border-line text-sm focus:outline-none focus:border-accent"
          >
            <option value="">All plans</option>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <Alert title="Couldn’t load users">
            {error}{' '}
            <button type="button" onClick={load} className="underline underline-offset-2">
              Retry
            </button>
          </Alert>
        )}

        <Card padded={false} className="overflow-hidden">
          {loading ? (
            <div className="p-5">
              <SkeletonRows rows={6} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon="person_search" title="No users found" body={search ? `Nothing matches “${search}”.` : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-line">
                    <th scope="col" className="font-medium px-5 py-3">User</th>
                    <th scope="col" className="font-medium px-3 py-3">Plan</th>
                    <th scope="col" className="font-medium px-3 py-3">Role</th>
                    <th scope="col" className="font-medium px-3 py-3 hidden md:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((u) => {
                    const self = u.id === me?.id
                    return (
                      <tr key={u.id} className="hover:bg-line/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0 max-w-[340px]">
                            <span className="w-8 h-8 rounded-[8px] bg-line flex items-center justify-center text-xs font-semibold shrink-0" aria-hidden>
                              {initialsOf(u.full_name || u.email)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {u.full_name || 'No name'} {self && <span className="text-xs text-muted font-normal">(you)</span>}
                              </p>
                              <p className="text-xs text-muted truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            aria-label={`Plan for ${u.email}`}
                            value={u.plan}
                            onChange={(e) => setPending({ user: u, patch: { plan: e.target.value as Plan }, text: `Change ${u.email} from ${u.plan} to ${e.target.value}?` })}
                            className="h-8 px-2 rounded-[6px] bg-ink border border-line text-[13px] focus:outline-none focus:border-accent"
                          >
                            {PLANS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          {self ? (
                            <Badge tone="danger">admin</Badge>
                          ) : (
                            <select
                              aria-label={`Role for ${u.email}`}
                              value={u.role}
                              onChange={(e) =>
                                setPending({
                                  user: u,
                                  patch: { role: e.target.value as Role },
                                  text: e.target.value === 'admin' ? `Give ${u.email} full admin access?` : `Remove admin access from ${u.email}?`,
                                })
                              }
                              className="h-8 px-2 rounded-[6px] bg-ink border border-line text-[13px] focus:outline-none focus:border-accent"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-3 text-muted tabular hidden md:table-cell whitespace-nowrap">{formatDate(u.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />

        <ConfirmDialog
          open={Boolean(pending)}
          onClose={() => !saving && setPending(null)}
          onConfirm={apply}
          loading={saving}
          tone={pending?.patch.role === 'admin' ? 'danger' : 'primary'}
          title="Confirm change"
          body={pending?.text}
          confirmLabel="Confirm"
        />
      </PageContainer>
    </>
  )
}
