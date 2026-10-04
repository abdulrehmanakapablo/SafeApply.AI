// FILE: src/pages/invoices/InvoiceList.tsx
// ROUTES: /freelancer/invoices (yours), /client/invoices (sent to you)

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from '../../components/SEO'
import { INVOICE_STATUS_LABEL, listClientInvoices, listMyInvoices, money, type Invoice } from '../../api/freelance'
import { Alert, Badge, ButtonLink, Card, EmptyState, PageContainer, PageHeader, SkeletonRows, formatDate } from '../../components/ui'
import { apiError } from '../../lib/axios'

const TONE = { draft: 'neutral', sent: 'warn', paid: 'accent', void: 'danger' } as const

export default function InvoiceList() {
  const client = useLocation().pathname.startsWith('/client')
  const base = client ? '/client/invoices' : '/freelancer/invoices'
  const [rows, setRows] = useState<Invoice[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(client ? listClientInvoices() : listMyInvoices())
      .then((r) => setRows(r.data))
      .catch((e) => {
        setError(apiError(e, 'Couldn’t load invoices.'))
        setRows([])
      })
  }, [client])

  return (
    <>
      <SEO title="Invoices | SafeApply.AI" description="Invoices." path={base} noindex />
      <PageContainer>
        <PageHeader
          title="Invoices"
          description={client ? 'Invoices your freelancers sent you.' : 'Create invoices for SafeApply contracts or outside clients. Save any invoice as a PDF.'}
          actions={
            !client && (
              <ButtonLink to="/freelancer/invoices/new" icon="add">
                New invoice
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
            <EmptyState icon="receipt_long" title="No invoices yet" body={client ? 'Invoices from freelancers on your contracts appear here.' : 'Your first 3 invoices are free.'} />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((i) => (
                <li key={i.id}>
                  <Link to={`${base}/${i.id}`} className="group flex items-center gap-3 px-5 py-4 hover:bg-line/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate group-hover:text-accent transition-colors">
                        {i.number} · {client ? i.freelancer_name : i.client_name}
                      </p>
                      <p className="text-xs text-muted">
                        Issued {formatDate(i.issued_on)}
                        {i.due_on && ` · due ${formatDate(i.due_on)}`}
                      </p>
                    </div>
                    <span className="text-sm tabular">{money(i.total, i.currency)}</span>
                    <Badge tone={TONE[i.status]}>{INVOICE_STATUS_LABEL[i.status]}</Badge>
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
