// FILE: src/pages/admin/AdminDashboard.tsx
// ROUTE: /admin
// BACKEND: GET /api/admin/stats, GET /api/admin/users, GET /api/admin/reviews?status=pending

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { getAdminReviews, getAdminStats, getAdminUsers, type AdminReview, type AdminStats, type AdminUser } from '../../api/admin'
import { Alert, Badge, ButtonLink, Card, CardHeader, PageContainer, PageHeader, SkeletonRows, Stat, initialsOf, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pending, setPending] = useState<AdminReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [s, u, r] = await Promise.allSettled([getAdminStats(), getAdminUsers({ page: 1 }), getAdminReviews({ status: 'pending', page: 1 })])
    if (s.status === 'fulfilled' && s.value.data) setStats(s.value.data)
    else setError(apiError(s.status === 'rejected' ? s.reason : null, 'Couldn’t load stats.'))
    if (u.status === 'fulfilled') setUsers((u.value.data || []).slice(0, 6))
    if (r.status === 'fulfilled') setPending((r.value.data || []).slice(0, 5))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pendingCount = stats?.pending_reviews ?? pending.length

  return (
    <>
      <SEO title="Admin | SafeApply.AI" description="Admin overview." path="/admin" noindex />
      <PageContainer>
        <PageHeader title="Overview" description="Live counts from the database." />

        {error && (
          <Alert title="Something didn’t load">
            {error}{' '}
            <button type="button" onClick={load} className="underline underline-offset-2">
              Retry
            </button>
          </Alert>
        )}

        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <Stat label="Users" value={loading ? '–' : (stats?.total_users ?? 0).toLocaleString()} hint={stats?.signups_7d !== undefined ? `${stats.signups_7d} in the last 7 days` : undefined} />
            <Stat label="Paid plans" value={loading ? '–' : (stats?.pro_users ?? 0).toLocaleString()} hint="Pro or lifetime" />
            <Stat label="Reports, 24h" value={loading ? '–' : (stats?.reports_today ?? 0).toLocaleString()} />
            <Stat label="Reviews" value={loading ? '–' : (stats?.total_reviews ?? 0).toLocaleString()} />
            <Stat label="Waiting for review" value={loading ? '–' : pendingCount.toLocaleString()} hint={pendingCount > 0 ? 'Needs moderation' : 'Queue is clear'} />
          </div>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader
              title="Moderation queue"
              description="Oldest first is best. Nothing is public until approved."
              action={
                <ButtonLink to="/admin/reviews" size="sm" variant="secondary">
                  Open queue
                </ButtonLink>
              }
            />
            {loading ? (
              <SkeletonRows rows={4} />
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted">No reviews waiting.</p>
            ) : (
              <ul className="divide-y divide-line -my-3">
                {pending.map((r) => (
                  <li key={r.id} className="py-3 flex items-start gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{r.company_name}</p>
                      <p className="text-xs text-muted truncate">
                        {r.role_type} · {r.overall_rating}/5 · {relativeDays(r.created_at)}
                      </p>
                    </div>
                    <Badge tone="warn">Pending</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Newest users"
              action={
                <ButtonLink to="/admin/users" size="sm" variant="secondary">
                  All users
                </ButtonLink>
              }
            />
            {loading ? (
              <SkeletonRows rows={5} />
            ) : users.length === 0 ? (
              <p className="text-sm text-muted">No users yet.</p>
            ) : (
              <ul className="divide-y divide-line -my-3">
                {users.map((u) => (
                  <li key={u.id} className="py-3 flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-[8px] bg-line flex items-center justify-center text-xs font-semibold shrink-0" aria-hidden>
                      {initialsOf(u.full_name || u.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.full_name || 'No name'}</p>
                      <p className="text-xs text-muted truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.role === 'admin' && <Badge tone="danger">Admin</Badge>}
                      <Badge tone={u.plan === 'free' ? 'neutral' : 'accent'}>{u.plan}</Badge>
                      <span className="text-xs text-muted tabular hidden sm:inline w-16 text-right">{relativeDays(u.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <p className="text-xs text-muted">
          Need to change someone’s plan? Use{' '}
          <Link to="/admin/users" className="underline underline-offset-2 hover:text-fg">
            Users
          </Link>
          .
        </p>
      </PageContainer>
    </>
  )
}
