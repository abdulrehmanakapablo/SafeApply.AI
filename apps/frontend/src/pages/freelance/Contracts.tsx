// FILE: src/pages/freelance/Contracts.tsx
// ROUTES: /freelancer/contracts, /client/contracts
// PURPOSE: The caller's contracts on one side of the marketplace.

import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import SEO from '../../components/SEO'
import ContractList from '../../components/freelance/ContractList'
import { listContracts, type ContractRow, type ContractStatus } from '../../api/freelance'
import { Alert, Card, PageContainer, PageHeader, Tabs } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function Contracts() {
  const side = useLocation().pathname.startsWith('/client') ? 'client' : 'freelancer'
  const [rows, setRows] = useState<ContractRow[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | ContractStatus>('all')

  useEffect(() => {
    listContracts()
      .then((r) => setRows(r.data.filter((c) => c.side === side)))
      .catch((e) => {
        setError(apiError(e, 'Couldn’t load contracts.'))
        setRows([])
      })
  }, [side])

  const shown = useMemo(() => (rows ? rows.filter((c) => filter === 'all' || c.status === filter) : null), [rows, filter])
  const count = (s: ContractStatus) => rows?.filter((c) => c.status === s).length

  return (
    <>
      <SEO title="Contracts | SafeApply.AI" description="Your contracts." path={`/${side}/contracts`} noindex />
      <PageContainer>
        <PageHeader title="Contracts" description={side === 'client' ? 'Approve handed-in work milestone by milestone.' : 'Hand in each milestone and get it approved.'} />
        {error && <Alert>{error}</Alert>}
        <Tabs
          label="Filter contracts"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: rows?.length },
            { value: 'active', label: 'Active', count: count('active') },
            { value: 'completed', label: 'Completed', count: count('completed') },
            { value: 'cancelled', label: 'Cancelled', count: count('cancelled') },
          ]}
          className="self-start"
        />
        <Card padded={false} className="overflow-hidden">
          <ContractList rows={shown} base={`/${side}`} empty={side === 'client' ? 'Hire a freelancer from one of your projects to start a contract.' : 'When a client hires you, the contract appears here.'} />
        </Card>
      </PageContainer>
    </>
  )
}
