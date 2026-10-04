// FILE: src/components/freelance/ContractExtras.tsx
// PURPOSE: On a contract page: the other side's contact details (shared
//          openly once you're working together) and a log of payments made
//          outside SafeApply, each confirmed by the other side.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { PAY_METHOD_LABEL, confirmPaymentLog, getContacts, listPaymentLogs, logPayment, money, type ContactDetails, type ContractDetail, type PayMethod, type PaymentLog } from '../../api/freelance'
import { Badge, Button, Card, CardHeader, Field, Icon, Select, Skeleton, formatDate } from '../ui'
import { apiError } from '../../lib/axios'

const safeHref = (url: string | null) => {
  try {
    const u = new URL(url || '')
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

export function ContactCard({ c }: { c: ContractDetail }) {
  const [d, setD] = useState<ContactDetails | null>(null)
  const [shown, setShown] = useState(false)
  const other = c.side === 'client' ? d?.freelancer : d?.client
  const portfolio = c.side === 'client' ? safeHref(d?.freelancer.portfolio_url ?? null) : null

  async function reveal() {
    try {
      setD((await getContacts(c.id)).data)
      setShown(true)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t load contact details.'))
    }
  }

  if (c.side === 'admin' || c.status === 'cancelled') return null
  return (
    <Card>
      <CardHeader title="Contact details" description="Work together however suits you. Keeping milestones here keeps your record verified." />
      {!shown ? (
        <Button variant="secondary" icon="contact_mail" onClick={reveal}>
          Show contact details
        </Button>
      ) : !other ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex gap-3">
            <dt className="text-muted w-20 shrink-0">Name</dt>
            <dd className="break-words">{other.name}</dd>
          </div>
          {other.email && (
            <div className="flex gap-3">
              <dt className="text-muted w-20 shrink-0">Email</dt>
              <dd className="break-all">
                <a href={`mailto:${other.email}`} className="hover:text-accent underline-offset-4 hover:underline">
                  {other.email}
                </a>
              </dd>
            </div>
          )}
          {other.phone && (
            <div className="flex gap-3">
              <dt className="text-muted w-20 shrink-0">Phone</dt>
              <dd className="tabular">
                <a href={`tel:${other.phone.replace(/[^+\d]/g, '')}`} className="hover:text-accent">
                  {other.phone}
                </a>
              </dd>
            </div>
          )}
          {portfolio && (
            <div className="flex gap-3">
              <dt className="text-muted w-20 shrink-0">Portfolio</dt>
              <dd className="break-all">
                <a href={portfolio} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-accent underline-offset-4 hover:underline">
                  {portfolio}
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  )
}

export function PaymentLogPanel({ c }: { c: ContractDetail }) {
  const [rows, setRows] = useState<PaymentLog[] | null>(null)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ amount: '', method: 'bank' as PayMethod, paid_on: new Date().toISOString().slice(0, 10), milestone_id: '', note: '' })
  const [busy, setBusy] = useState('')

  const load = useCallback(() => {
    listPaymentLogs(c.id)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
  }, [c.id])
  useEffect(load, [load])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseInt(f.amount.replace(/\D/g, ''), 10)
    if (!(amount > 0)) return toast.error('Enter the amount.')
    setBusy('log')
    try {
      await logPayment(c.id, { amount, method: f.method, paid_on: f.paid_on, milestone_id: f.milestone_id || null, note: f.note.trim() })
      toast.success('Payment logged. The other side will be asked to confirm.')
      setOpen(false)
      setF({ ...f, amount: '', note: '' })
      load()
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t log the payment.'))
    } finally {
      setBusy('')
    }
  }

  async function confirm(p: PaymentLog, ok: boolean) {
    setBusy(p.id)
    try {
      await confirmPaymentLog(c.id, p.id, ok)
      setRows((rs) => rs && rs.map((x) => (x.id === p.id ? { ...x, confirmed: ok } : x)))
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save.'))
    } finally {
      setBusy('')
    }
  }

  if (c.side === 'admin' && !rows?.length) return null
  const confirmedTotal = (rows || []).filter((p) => p.confirmed).reduce((n, p) => n + p.amount, 0)
  return (
    <Card padded={false}>
      <div className="px-5 h-12 flex items-center justify-between border-b border-line">
        <span className="text-[15px] font-semibold">Payments outside SafeApply</span>
        {rows && rows.length > 0 && <span className="text-xs text-muted tabular">{money(confirmedTotal, c.currency)} confirmed</span>}
      </div>
      {!rows ? (
        <div className="p-5">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.length === 0 && <li className="px-5 py-4 text-sm text-muted">Paid by bank, wallet or cash? Log it so both of you have a shared record.</li>}
          {rows.map((p) => (
            <li key={p.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
              <Icon name="payments" className="text-[20px] text-muted" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular">
                  {money(p.amount, c.currency)} · {PAY_METHOD_LABEL[p.method]}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(p.paid_on)} · logged by the {p.by}
                  {p.note && ` · ${p.note}`}
                </p>
              </div>
              {p.confirmed === null ? (
                !p.mine && c.side !== 'admin' ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => confirm(p, true)} loading={busy === p.id}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => confirm(p, false)} disabled={busy === p.id}>
                      Not received
                    </Button>
                  </div>
                ) : (
                  <Badge tone="warn">Awaiting confirmation</Badge>
                )
              ) : (
                <Badge tone={p.confirmed ? 'accent' : 'danger'}>{p.confirmed ? 'Confirmed' : 'Disputed'}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      {c.side !== 'admin' && c.status !== 'cancelled' && (
        <div className="px-5 py-4 border-t border-line">
          {!open ? (
            <Button size="sm" variant="secondary" icon="add" onClick={() => setOpen(true)}>
              Log a payment
            </Button>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label={`Amount (${c.currency})`} inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
                <Select label="Method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PayMethod })} options={(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((m) => ({ value: m, label: PAY_METHOD_LABEL[m] }))} />
                <Field label="Paid on" type="date" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} />
              </div>
              <Select label="For milestone (optional)" value={f.milestone_id} onChange={(e) => setF({ ...f, milestone_id: e.target.value })} options={[{ value: '', label: 'Not linked' }, ...c.milestones.map((m) => ({ value: m.id, label: `${m.position}. ${m.title}` }))]} />
              <Field label="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value.slice(0, 500) })} placeholder="Reference number, etc." />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" loading={busy === 'log'}>
                  Log payment
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  )
}
