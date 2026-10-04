// FILE: src/pages/billing/History.tsx
// ROUTE: /billing/history

import { useEffect, useState } from 'react'
import SEO from '../../components/SEO'
import { METHOD_LABEL, getPayments, pkr, type Payment } from '../../api/billing'
import { billingPathFor } from '../../lib/plans'
import { Alert, Badge, ButtonLink, Card, EmptyState, PageContainer, PageHeader, SkeletonRows, formatDate } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

const TONE = { pending: 'warn', approved: 'accent', rejected: 'danger' } as const
const LABEL = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Not confirmed' } as const

export default function History() {
  const role = useAuthStore((s) => s.user?.role)
  const [rows, setRows] = useState<Payment[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getPayments()
      .then((r) => setRows(r.data))
      .catch((e) => {
        setError(apiError(e, 'Couldn’t load payments.'))
        setRows([])
      })
  }, [])

  return (
    <>
      <SEO title="Payment history | SafeApply.AI" description="Your payments." path="/billing/history" noindex />
      <PageContainer narrow>
        <PageHeader
          back={{ to: billingPathFor(role), label: 'Plan & billing' }}
          title="Payment history"
          actions={
            role !== 'admin' && (
              <ButtonLink to="/billing/checkout" icon="add">
                New payment
              </ButtonLink>
            )
          }
        />
        {error && <Alert>{error}</Alert>}
        <Card padded={false} className="overflow-hidden">
          {!rows ? (
            <div className="p-5">
              <SkeletonRows rows={3} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon="receipt_long" title="No payments yet" body="Payments you submit show up here with their status." />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((p) => (
                <li key={p.id} className="px-5 py-4 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium tabular">
                      {pkr(p.amount_pkr)} · {METHOD_LABEL[p.method]}
                    </span>
                    <Badge tone={TONE[p.status]}>{LABEL[p.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted tabular break-all">
                    Sent {formatDate(p.created_at)} · ID {p.transaction_id}
                    {p.period_end && ` · covers until ${formatDate(p.period_end)}`}
                  </p>
                  {p.admin_note && <p className="text-sm text-muted border-l-2 border-line pl-3 break-words">{p.admin_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageContainer>
    </>
  )
}
