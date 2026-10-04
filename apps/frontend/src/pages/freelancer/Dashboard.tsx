// FILE: src/pages/freelancer/Dashboard.tsx
// ROUTE: /freelancer

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import ContractList from '../../components/freelance/ContractList'
import { getFreelancerStats, listContracts, money, type ContractRow } from '../../api/freelance'
import { Alert, ButtonLink, Card, CardHeader, PageContainer, PageHeader, Stat } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

type Stats = Awaited<ReturnType<typeof getFreelancerStats>>['data']

export default function FreelancerDashboard() {
  const name = useAuthStore((s) => s.user?.full_name?.split(' ')[0])
  const [stats, setStats] = useState<Stats | null>(null)
  const [contracts, setContracts] = useState<ContractRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getFreelancerStats(), listContracts()])
      .then(([s, c]) => {
        setStats(s.data)
        setContracts(c.data.filter((x) => x.side === 'freelancer'))
      })
      .catch((e) => setError(apiError(e, 'Couldn’t load your overview.')))
  }, [])

  const earned = stats ? Object.entries(stats.approved_by_currency) : []

  return (
    <>
      <SEO title="Overview | Freelancer | SafeApply.AI" description="Freelancer overview." path="/freelancer" noindex />
      <PageContainer>
        <PageHeader
          title={name ? `Hi ${name}` : 'Overview'}
          description="Your proposals, contracts and approved work in one place."
          actions={
            <>
              <ButtonLink to="/freelancer/clients/invite" variant="secondary" icon="person_add">
                Invite a client
              </ButtonLink>
              <ButtonLink to="/projects" icon="travel_explore">
                Find projects
              </ButtonLink>
            </>
          }
        />
        {error && <Alert>{error}</Alert>}
        {stats && !stats.has_profile && (
          <Alert tone="warn">
            Clients see your profile with every proposal. Set it up before you apply.{' '}
            <Link to="/freelancer/profile" className="underline underline-offset-4 font-medium">
              Set up profile
            </Link>
          </Alert>
        )}
        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat label="Open proposals" value={stats ? stats.proposals_open : '–'} hint={stats ? `${stats.shortlisted} shortlisted` : undefined} />
            <Stat label="Active contracts" value={stats ? stats.active : '–'} />
            <Stat label="Completed" value={stats ? stats.completed : '–'} />
            <Stat
              label="Approved work"
              value={!stats ? '–' : earned.length ? money(earned[0][1], earned[0][0]) : money(0, 'USD')}
              hint={earned.length > 1 ? earned.slice(1).map(([c, n]) => money(n, c)).join(' · ') : 'Sum of approved milestones'}
            />
          </div>
        </Card>
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title="Contracts" action={<ButtonLink to="/freelancer/contracts" variant="ghost" size="sm">See all</ButtonLink>} />
          </div>
          <ContractList rows={contracts?.slice(0, 5) ?? null} base="/freelancer" empty="When a client hires you, the contract and its milestones appear here." />
        </Card>
      </PageContainer>
    </>
  )
}
