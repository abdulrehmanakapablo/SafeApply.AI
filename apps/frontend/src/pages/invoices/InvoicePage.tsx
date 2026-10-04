// FILE: src/pages/invoices/InvoicePage.tsx
// ROUTES: /freelancer/invoices/new, /freelancer/invoices/:id, /client/invoices/:id
// PURPOSE: Edit drafts, move through Sent → Paid (or Void), and print /
//          save as PDF. The paper preview is always light so prints match.

import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { CURRENCIES, INVOICE_STATUS_LABEL, createInvoice, getInvoice, listContracts, money, updateInvoice, type ContractRow, type Invoice, type InvoiceItem } from '../../api/freelance'
import { Alert, Badge, Button, Card, CardHeader, Field, Icon, PageContainer, PageHeader, Select, Skeleton, TextArea } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

type Full = Invoice & { side: 'freelancer' | 'client'; from: { name: string; email: string } }
const today = () => new Date().toISOString().slice(0, 10)
const blank = (): InvoiceItem => ({ description: '', qty: 1, unit_amount: 0 })
const TONE = { draft: 'neutral', sent: 'warn', paid: 'accent', void: 'danger' } as const

export default function InvoicePage() {
  const { id = 'new' } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const clientView = useLocation().pathname.startsWith('/client')
  const navigate = useNavigate()
  const me = useAuthStore((s) => s.user)
  const [inv, setInv] = useState<Full | null>(null)
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [form, setForm] = useState({ contract_id: '', client_name: '', client_email: '', currency: 'USD', issued_on: today(), due_on: '', notes: '' })
  const [items, setItems] = useState<InvoiceItem[]>([blank()])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (!clientView) listContracts().then((r) => setContracts(r.data.filter((c) => c.side === 'freelancer' && c.status !== 'cancelled'))).catch(() => {})
    if (isNew) return
    getInvoice(id)
      .then((r) => {
        setInv(r.data)
        setForm({ contract_id: r.data.contract_id || '', client_name: r.data.client_name, client_email: r.data.client_email || '', currency: r.data.currency, issued_on: r.data.issued_on, due_on: r.data.due_on || '', notes: r.data.notes || '' })
        setItems(r.data.items)
      })
      .catch((e) => setError(apiError(e, 'Invoice not found.')))
  }, [id, isNew, clientView])

  const editable = !clientView && (isNew || inv?.status === 'draft')
  const total = useMemo(() => items.reduce((n, i) => n + Math.round((Number(i.qty) || 0) * (Number(i.unit_amount) || 0)), 0), [items])

  function pickContract(cid: string) {
    const c = contracts.find((x) => x.id === cid)
    setForm((f) => ({ ...f, contract_id: cid, client_name: c ? c.other_party : f.client_name, currency: c ? c.currency : f.currency }))
    if (c && items.length === 1 && !items[0].description) setItems([{ description: c.title, qty: 1, unit_amount: c.amount }])
  }

  function validate(): boolean {
    if (form.client_name.trim().length < 2) return toast.error('Add the client’s name.'), false
    if (items.some((i) => !i.description.trim() || !(i.qty > 0) || i.unit_amount < 0)) return toast.error('Every line needs a description, quantity and price.'), false
    return true
  }

  async function save(status?: 'sent' | 'paid' | 'void') {
    if (busy || (!status && !validate())) return
    setBusy(status || 'save')
    try {
      const payload = { client_name: form.client_name.trim(), client_email: form.client_email.trim() || undefined, currency: form.currency, issued_on: form.issued_on, due_on: form.due_on || undefined, notes: form.notes.trim(), items: items.map((i) => ({ description: i.description.trim(), qty: Number(i.qty), unit_amount: Math.round(Number(i.unit_amount)) })) }
      if (isNew) {
        const r = await createInvoice({ ...payload, ...(form.contract_id ? { contract_id: form.contract_id } : {}) })
        toast.success(`Invoice ${r.data.number} created`)
        navigate(`/freelancer/invoices/${r.data.id}`, { replace: true })
        return
      }
      const r = await updateInvoice(id, status ? { status } : payload)
      setInv((cur) => (cur ? { ...cur, ...r.data } : cur))
      toast.success(status ? `Marked ${INVOICE_STATUS_LABEL[status].toLowerCase()}` : 'Saved')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t save the invoice.'))
    } finally {
      setBusy('')
    }
  }

  if (error) {
    return (
      <PageContainer narrow>
        <Alert>{error}</Alert>
      </PageContainer>
    )
  }
  if (!isNew && !inv) {
    return (
      <PageContainer>
        <Skeleton className="h-96 rounded-[16px]" />
      </PageContainer>
    )
  }

  const fromName = inv?.from.name || me?.full_name || ''
  const fromEmail = inv?.from.email || me?.email || ''
  const back = clientView ? '/client/invoices' : '/freelancer/invoices'

  return (
    <>
      <SEO title={`${inv?.number || 'New invoice'} | SafeApply.AI`} description="Invoice." path={back} noindex />
      <PageContainer className="max-w-6xl">
        <PageHeader
          back={{ to: back, label: 'Invoices' }}
          title={
            <span className="flex items-center gap-3">
              {inv?.number || 'New invoice'}
              {inv && <Badge tone={TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>}
            </span>
          }
          actions={
            <>
              {inv && (
                <Button variant="secondary" icon="picture_as_pdf" onClick={() => window.print()}>
                  Save as PDF
                </Button>
              )}
              {!clientView && inv?.status === 'draft' && (
                <Button icon="send" onClick={() => save('sent')} loading={busy === 'sent'}>
                  Mark as sent
                </Button>
              )}
              {!clientView && inv?.status === 'sent' && (
                <Button icon="paid" onClick={() => save('paid')} loading={busy === 'paid'}>
                  Mark as paid
                </Button>
              )}
              {!clientView && (inv?.status === 'draft' || inv?.status === 'sent') && (
                <Button variant="ghost" className="hover:text-danger" onClick={() => save('void')} loading={busy === 'void'}>
                  Void
                </Button>
              )}
            </>
          }
        />
        {inv?.status === 'sent' && inv.client_id && !clientView && <p className="text-xs text-muted -mt-2">The client sees this invoice in their SafeApply account.</p>}

        <div className={editable ? 'grid lg:grid-cols-[1fr_1fr] gap-6 items-start' : ''}>
          {editable && (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader title="Bill to" />
                <div className="flex flex-col gap-4">
                  {isNew && contracts.length > 0 && (
                    <Select
                      label="SafeApply contract (optional)"
                      value={form.contract_id}
                      onChange={(e) => pickContract(e.target.value)}
                      options={[{ value: '', label: 'Outside client' }, ...contracts.map((c) => ({ value: c.id, label: `${c.title} · ${c.other_party}` }))]}
                    />
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Client name" required value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value.slice(0, 120) })} />
                    <Field label="Client email" optional type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Select label="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                    <Field label="Issued" type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
                    <Field label="Due" optional type="date" value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} />
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Lines" />
                <div className="flex flex-col gap-3">
                  {items.map((it, i) => (
                    <div key={i} className="grid grid-cols-[1fr_64px_110px_32px] gap-2 items-end">
                      <input aria-label={`Line ${i + 1} description`} value={it.description} maxLength={300} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Description" className="h-10 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm focus:outline-none focus:border-accent" />
                      <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={it.qty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 } : x)))} className="h-10 px-2 bg-ink border border-line rounded-[var(--radius-input)] text-sm tabular text-right focus:outline-none focus:border-accent" />
                      <input aria-label={`Line ${i + 1} price`} inputMode="numeric" value={it.unit_amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit_amount: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } : x)))} className="h-10 px-2 bg-ink border border-line rounded-[var(--radius-input)] text-sm tabular text-right focus:outline-none focus:border-accent" />
                      <button type="button" disabled={items.length === 1} onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove line ${i + 1}`} className="h-10 inline-flex items-center justify-center rounded-[8px] text-muted hover:text-danger disabled:opacity-30">
                        <Icon name="close" className="text-[18px]" />
                      </button>
                    </div>
                  ))}
                  {items.length < 50 && (
                    <Button size="sm" variant="ghost" icon="add" className="self-start" onClick={() => setItems([...items, blank()])}>
                      Add line
                    </Button>
                  )}
                </div>
                <TextArea label="Notes (optional)" rows={3} className="mt-4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 2000) })} hint="Payment details, thanks, terms." />
              </Card>
              <Button size="lg" onClick={() => save()} loading={busy === 'save'} className="self-end">
                {isNew ? 'Create invoice' : 'Save draft'}
              </Button>
            </div>
          )}

          {/* Paper: light on purpose so it prints the same in both themes. */}
          <div className="print-area bg-white text-neutral-900 rounded-[12px] border border-line p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.25)] text-sm">
            <div className="flex justify-between gap-6">
              <div>
                <p className="text-2xl font-bold tracking-tight">Invoice</p>
                <p className="text-neutral-500 tabular">{inv?.number || 'INV-draft'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{fromName}</p>
                <p className="text-neutral-500">{fromEmail}</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">Bill to</p>
                <p className="mt-1 font-medium">{form.client_name || 'Client name'}</p>
                {form.client_email && <p className="text-neutral-500">{form.client_email}</p>}
              </div>
              <div className="text-right tabular">
                <p>
                  <span className="text-neutral-500">Issued </span>
                  {form.issued_on}
                </p>
                {form.due_on && (
                  <p>
                    <span className="text-neutral-500">Due </span>
                    {form.due_on}
                  </p>
                )}
                {inv?.paid_on && <p className="text-green-700 font-medium">Paid {inv.paid_on}</p>}
              </div>
            </div>
            <table className="mt-8 w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 border-b border-neutral-200">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium text-right">Qty</th>
                  <th className="py-2 font-medium text-right">Price</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2.5 pr-3 break-words">{it.description || 'Untitled line'}</td>
                    <td className="py-2.5 text-right">{it.qty}</td>
                    <td className="py-2.5 text-right">{money(it.unit_amount, form.currency)}</td>
                    <td className="py-2.5 text-right">{money(Math.round(it.qty * it.unit_amount), form.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end">
              <p className="text-lg font-bold tabular">Total {money(total, form.currency)}</p>
            </div>
            {form.notes && <p className="mt-8 text-neutral-600 whitespace-pre-line break-words">{form.notes}</p>}
            {inv?.status === 'void' && <p className="mt-6 text-red-600 font-bold uppercase tracking-wide">Void</p>}
          </div>
        </div>
      </PageContainer>
    </>
  )
}
