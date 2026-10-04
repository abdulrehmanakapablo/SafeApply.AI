// FILE: src/pages/admin/Projects.tsx
// ROUTE: /admin/projects
// BACKEND: GET /api/freelance/admin/projects, PATCH /api/freelance/admin/projects/:id
// PURPOSE: Moderate freelance projects: close spam or scams, reopen mistakes.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { ProjectBadge } from '../../components/freelance/Bits'
import { adminListProjects, adminSetProject, budgetLabel, type Project } from '../../api/freelance'
import { Alert, Button, Card, EmptyState, PageContainer, PageHeader, Pagination, SkeletonRows, Tabs, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Row = Project & { client: { name: string; email: string } | null }
type Filter = 'open' | 'closed' | 'in_progress' | 'all'

export default function AdminProjects() {
  const [filter, setFilter] = useState<Filter>('open')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [pages, setPages] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRows(null)
    setError('')
    try {
      const r = await adminListProjects({ status: filter === 'all' ? undefined : filter, page })
      setRows(r.data || [])
      setPages(r.total_pages || 1)
    } catch (e) {
      setError(apiError(e, 'Couldn’t load projects.'))
      setRows([])
    }
  }, [filter, page])
  useEffect(() => {
    void load()
  }, [load])

  async function set(p: Row, status: 'open' | 'closed') {
    if (busy) return
    setBusy(p.id)
    try {
      await adminSetProject(p.id, status)
      setRows((rs) => rs && (filter === 'all' ? rs.map((x) => (x.id === p.id ? { ...x, status } : x)) : rs.filter((x) => x.id !== p.id)))
      toast.success(status === 'closed' ? 'Project closed' : 'Project reopened')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t change the project.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SEO title="Projects | Admin | SafeApply.AI" description="Freelance projects." path="/admin/projects" noindex />
      <PageContainer>
        <PageHeader title="Freelance projects" description="Close anything that asks for upfront fees, off-platform payment, or personal data. The client is notified." />
        <Tabs
          label="Filter projects"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
          items={[
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'closed', label: 'Closed' },
            { value: 'all', label: 'All' },
          ]}
          className="self-start"
        />
        {error && <Alert>{error}</Alert>}
        <Card padded={false} className="overflow-hidden">
          {!rows ? (
            <div className="p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon="folder_open" title="Nothing here" />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((p) => (
                <li key={p.id} className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <Link to={`/projects/${p.id}`} className="font-medium hover:text-accent break-words">
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted truncate">
                      {p.client ? `${p.client.name} · ${p.client.email}` : 'Unknown client'} · {budgetLabel(p)} · {formatDate(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ProjectBadge status={p.status} />
                    {(p.status === 'open' || p.status === 'draft') && (
                      <Button size="sm" variant="danger" loading={busy === p.id} onClick={() => set(p, 'closed')}>
                        Close
                      </Button>
                    )}
                    {p.status === 'closed' && (
                      <Button size="sm" variant="secondary" loading={busy === p.id} onClick={() => set(p, 'open')}>
                        Reopen
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Pagination page={page} totalPages={pages} onChange={setPage} />
      </PageContainer>
    </>
  )
}
