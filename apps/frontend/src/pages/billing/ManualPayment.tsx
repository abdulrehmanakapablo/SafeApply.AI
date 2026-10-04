// FILE: src/pages/billing/ManualPayment.tsx
// ROUTE: /billing/manual/:method   (jazzcash | easypaisa | bank)
// PURPOSE: Account details to send money to, then a short form with the
//          transaction ID. An admin confirms it and the plan starts.

import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { METHOD_LABEL, getBillingConfig, invalidateBillingStatus, pkr, submitManualPayment, type BillingConfig, type Method, type PlanKey } from '../../api/billing'
import { Alert, Button, Card, CardHeader, Field, Icon, PageContainer, PageHeader, Skeleton } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'
import { apiError } from '../../lib/axios'

const METHODS: Method[] = ['jazzcash', 'easypaisa', 'bank']
const ROLE_PLAN: Record<string, PlanKey> = { user: 'seeker', freelancer: 'freelancer', client: 'client', recruiter: 'recruiter' }

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-medium tabular break-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`), () => toast.error('Copy failed'))}
        className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-[8px] text-muted hover:text-fg hover:bg-line"
        aria-label={`Copy ${label}`}
      >
        <Icon name="content_copy" className="text-[18px]" />
      </button>
    </div>
  )
}

export default function ManualPayment() {
  const { method = '' } = useParams<{ method: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const planKey = ROLE_PLAN[user?.role || '']
  const [cfg, setCfg] = useState<BillingConfig | null>(null)
  const [txn, setTxn] = useState('')
  const [sender, setSender] = useState(user?.full_name || '')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getBillingConfig()
      .then((c) => {
        setCfg(c)
        if (planKey) setAmount(String(c.plans[planKey].pkr))
      })
      .catch(() => toast.error('Couldn’t load payment details.'))
  }, [planKey])

  if (!METHODS.includes(method as Method) || !planKey) return <Navigate to="/billing/checkout" replace />
  const m = method as Method
  const acct = cfg?.methods[m]
  const price = cfg?.plans[planKey].pkr

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !price) return
    const next: Record<string, string> = {}
    const t = txn.trim()
    if (!/^[A-Za-z0-9-]{6,40}$/.test(t)) next.txn = 'Use the ID exactly as shown on your receipt (6 to 40 letters, numbers or dashes).'
    if (sender.trim().length < 2) next.sender = 'Enter the name on the sending account.'
    const n = parseInt(amount.replace(/[^0-9]/g, ''), 10)
    if (!Number.isFinite(n) || n < price) next.amount = `At least ${pkr(price)}.`
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await submitManualPayment({ method: m, transaction_id: t, sender_name: sender.trim(), amount_pkr: n })
      invalidateBillingStatus()
      toast.success('Payment submitted. We’ll confirm it shortly.')
      navigate('/billing/history', { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t submit the payment.'))
      setBusy(false)
    }
  }

  return (
    <>
      <SEO title={`Pay with ${METHOD_LABEL[m]} | SafeApply.AI`} description="Manual payment." path={`/billing/manual/${m}`} noindex />
      <PageContainer narrow>
        <PageHeader back={{ to: '/billing/checkout', label: 'Payment options' }} title={`Pay with ${METHOD_LABEL[m]}`} description="Two steps: send the money, then tell us the transaction ID." />
        {cfg && !acct && <Alert tone="warn">{METHOD_LABEL[m]} isn’t available right now. Pick another option.</Alert>}

        <Card>
          <CardHeader title="1. Send the payment" />
          {!cfg ? (
            <Skeleton className="h-28 w-full" />
          ) : acct ? (
            <div className="divide-y divide-line">
              <CopyRow label="Amount" value={pkr(price!)} />
              {'iban' in acct ? (
                <>
                  <CopyRow label="Bank" value={acct.bank} />
                  <CopyRow label="Account title" value={acct.title} />
                  <CopyRow label="IBAN" value={acct.iban} />
                </>
              ) : (
                <>
                  <CopyRow label={`${METHOD_LABEL[m]} number`} value={acct.number} />
                  <CopyRow label="Account name" value={acct.name} />
                </>
              )}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted">Send from an account in your own name. Keep the receipt until your plan is active.</p>
        </Card>

        <Card>
          <CardHeader title="2. Confirm it" />
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label="Transaction ID" required value={txn} onChange={(e) => setTxn(e.target.value.slice(0, 40))} error={errors.txn} hint="Shown on the confirmation SMS or receipt." autoComplete="off" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Sender name" required value={sender} onChange={(e) => setSender(e.target.value.slice(0, 80))} error={errors.sender} />
              <Field label="Amount sent (PKR)" required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
            </div>
            <Button type="submit" size="lg" loading={busy} disabled={!acct}>
              Submit for review
            </Button>
            <p className="text-xs text-muted">A person checks every payment, usually within a few hours. You’ll get a notification and an email when it’s active.</p>
          </form>
        </Card>
      </PageContainer>
    </>
  )
}
