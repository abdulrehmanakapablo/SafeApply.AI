// FILE: src/pages/public/SharedReport.tsx
// ROUTE: /share/search/:id
// PURPOSE: A company report its owner chose to publish. Read-only. The
//          owner can turn the link off at any time.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AdaptiveLayout from '../../components/layout/AdaptiveLayout'
import { ReportView } from '../dashboard/CompanyReport'
import { getSharedReport } from '../../api/growth'
import type { CompanyReport } from '../../api/reports'
import { ButtonLink, Card, EmptyState, PageContainer, Skeleton } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function SharedReport() {
  const { id = '' } = useParams<{ id: string }>()
  const [report, setReport] = useState<CompanyReport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getSharedReport(id)
      .then((r) => !cancelled && setReport(r.data))
      .catch((e) => !cancelled && setError(apiError(e, 'This report isn’t shared, or the link was turned off.')))
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <AdaptiveLayout>
      {error ? (
        <PageContainer narrow>
          <SEO title="Report unavailable | SafeApply.AI" description="Shared report." path="/share/search" noindex />
          <Card padded={false} className="mt-10">
            <EmptyState icon="link_off" title="Report unavailable" body={error} action={<ButtonLink to="/">Go to SafeApply</ButtonLink>} />
          </Card>
        </PageContainer>
      ) : !report ? (
        <PageContainer>
          <Skeleton className="h-10 w-72" />
          <div className="grid lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-[16px]" />
            <Skeleton className="h-64 rounded-[16px]" />
          </div>
        </PageContainer>
      ) : (
        <div className="py-6">
          <ReportView report={report} shared />
        </div>
      )}
    </AdaptiveLayout>
  )
}
