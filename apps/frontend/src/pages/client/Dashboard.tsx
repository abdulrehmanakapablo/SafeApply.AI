// FILE: src/pages/client/Dashboard.tsx
// ROUTE: /client

import { useEffect, useState } from 'react'
import SEO from '../../components/SEO'
import ContractList from '../../components/freelance/ContractList'
import { getClientStats, listContracts, type ContractRow } from '../../api/freelance'
import { Alert, ButtonLink, Card, CardHeader, PageContainer, PageHeader, Stat } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

type Stats = Awaited<ReturnType<typeof getClientStats>>['data']

export default function ClientDashboard() {
  const name = useAuthStore((s) => s.user?.full_name?.split(' ')[0])
  const [stats, setStats] = useState<Stats | null>(null)
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getClientStats(), listContracts()])
      .then(([s, c]) => {
        setStats(s.data)
        setContracts(c.data.filter((x) => x.side === 'client'))
      })
      .catch((e) => setError(apiError(e, 'Couldn’t load your overview.')))
  }, [])

  return (
    <>
      <SEO title="Overview | Client | SafeApply.AI" description="Client overview." path="/client" noindex />
      <PageContainer>
        <PageHeader
          title={name ? `Hi ${name}` : 'Overview'}
          description="Post projects, compare proposals, and approve work one milestone at a time."
          actions={
            <>
              <ButtonLink to="/client/invoices" variant="secondary" icon="receipt_long">
                Invoices
              </ButtonLink>
              <ButtonLink to="/client/projects/new" icon="add">
                Post a project
              </ButtonLink>
            </>
          }
        />
        {error && <Alert>{error}</Alert>}
        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat label="Open projects" value={stats ? stats.open : '–'} hint={stats?.drafts ? `${stats.drafts} draft${stats.drafts === 1 ? '' : 's'}` : undefined} />
            <Stat label="New proposals" value={stats ? stats.new_proposals : '–'} hint="Waiting for your review" />
            <Stat label="Active contracts" value={stats ? stats.active : '–'} />
            <Stat label="Completed" value={stats ? stats.completed : '–'} />
          </div>
        </Card>
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Contracts" action={<ButtonLink to="/client/contracts" variant="ghost" size="sm">See all</ButtonLink>} />
          </div>
          <ContractList rows={contracts?.slice(0, 5) ?? null} base="/client" empty="Hire a freelancer from one of your projects to start a contract." />
        </Card>
      </PageContainer>
    </>
  )
}
