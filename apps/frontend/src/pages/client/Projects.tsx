// FILE: src/pages/client/Projects.tsx
// ROUTE: /client/projects

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import { ProjectBadge } from '../../components/freelance/Bits'
import { budgetLabel, listClientProjects, type Project, type ProjectStatus } from '../../api/freelance'
import { Alert, ButtonLink, Card, EmptyState, PageContainer, PageHeader, SkeletonRows, Tabs, relativeDays } from '../../components/ui'
import { apiError } from '../../lib/axios'

type Filter = 'all' | ProjectStatus

export default function ClientProjects() {
  const [rows, setRows] = useState<Project[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    listClientProjects()
      .then((r) => setRows(r.data))
      .catch((e) => {
        setError(apiError(e, 'Couldn’t load projects.'))
        setRows([])
      })
  }, [])

  const shown = useMemo(() => (rows || []).filter((p) => filter === 'all' || p.status === filter), [rows, filter])
  const count = (s: ProjectStatus) => (rows || []).filter((p) => p.status === s).length

  return (
    <>
      <SEO title="My projects | Client | SafeApply.AI" description="Your projects." path="/client/projects" noindex />
      <PageContainer>
        <PageHeader
          title="My projects"
          description="Open projects stay on the board while you keep them active. 30 days without activity takes them down."
          actions={
            <ButtonLink to="/client/projects/new" icon="add">
              Post a project
            </ButtonLink>
          }
        />
        {error && <Alert>{error}</Alert>}
        <Tabs
          label="Filter projects"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: rows?.length },
            { value: 'open', label: 'Open', count: count('open') },
            { value: 'in_progress', label: 'In progress', count: count('in_progress') },
            { value: 'draft', label: 'Drafts', count: count('draft') },
            { value: 'completed', label: 'Completed', count: count('completed') },
          ]}
          className="self-start"
        />
        <Card padded={false} className="overflow-hidden">
          {!rows ? (
            <div className="p-5">
              <SkeletonRows rows={4} />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon="folder_open"
              title={rows.length ? 'Nothing here' : 'No projects yet'}
              body={rows.length ? undefined : 'Describe the work, set a budget, and freelancers start sending proposals.'}
              action={!rows.length && <ButtonLink to="/client/projects/new">Post a project</ButtonLink>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((p) => (
                <li key={p.id}>
                  <Link to={`/client/projects/${p.id}`} className="group flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 hover:bg-line/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate group-hover:text-accent transition-colors">{p.title}</p>
                      <p className="text-xs text-muted tabular">
                        {budgetLabel(p)} · updated {relativeDays(p.last_activity_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-sm tabular">
                        {p.proposals_count ?? 0} <span className="text-muted text-xs">proposal{p.proposals_count === 1 ? '' : 's'}</span>
                      </span>
                      <ProjectBadge status={p.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageContainer>
    </>
  )
}
