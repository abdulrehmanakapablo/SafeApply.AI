// FILE: src/pages/freelancer/InviteClient.tsx
// ROUTE: /freelancer/clients/invite
// PURPOSE: Ask an outside client to confirm work you did for them. Once
//          they confirm, it shows as Verified work on your profile.

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { CURRENCIES, createInvite } from '../../api/freelance'
import { Alert, Button, ButtonLink, Card, CardHeader, Field, Icon, PageContainer, PageHeader, Select, TextArea } from '../../components/ui'
import { apiError } from '../../lib/axios'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InviteClient() {
  const [f, setF] = useState({ client_name: '', client_email: '', title: '', description: '', amount: '', currency: 'USD', completed_on: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ link: string; emailed: boolean } | null>(null)
  const set = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const next: Record<string, string> = {}
    if (f.client_name.trim().length < 2) next.client_name = 'Required'
    if (!EMAIL_RE.test(f.client_email.trim())) next.client_email = 'Enter the client’s email'
    if (f.title.trim().length < 3) next.title = 'What did you do for them?'
    const amount = f.amount.trim() ? parseInt(f.amount.replace(/\D/g, ''), 10) : null
    if (amount !== null && !(amount > 0)) next.amount = 'Whole number, or leave empty'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const r = await createInvite({ ...f, client_name: f.client_name.trim(), client_email: f.client_email.trim(), title: f.title.trim(), description: f.description.trim(), amount, completed_on: f.completed_on || null })
      setDone({ link: `${window.location.origin}${r.data.link}`, emailed: r.data.emailed })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t create the invite.'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <PageContainer narrow>
        <PageHeader back={{ to: '/freelancer/work', label: 'Verified work' }} title="Invite created" />
        <Card>
          <div className="flex items-start gap-3">
            <Icon name="mark_email_read" className="text-[24px] text-accent" />
            <div className="min-w-0">
              <p className="font-medium">{done.emailed ? 'We emailed your client.' : 'Send this link to your client.'}</p>
              <p className="text-sm text-muted mt-1">They confirm with the email address you entered. The link works once, for 14 days. It’s only shown now.</p>
              <div className="mt-4 flex gap-2">
                <input readOnly value={done.link} className="flex-1 min-w-0 h-10 px-3 bg-ink border border-line rounded-[var(--radius-input)] text-sm font-mono" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="secondary" icon="content_copy" onClick={() => navigator.clipboard?.writeText(done.link).then(() => toast.success('Link copied'))}>
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </Card>
        <ButtonLink to="/freelancer/work" className="self-start">
          Back to verified work
        </ButtonLink>
      </PageContainer>
    )
  }

  return (
    <>
      <SEO title="Invite a client | SafeApply.AI" description="Invite a client to confirm your work." path="/freelancer/clients/invite" noindex />
      <PageContainer narrow>
        <PageHeader back={{ to: '/freelancer/work', label: 'Verified work' }} title="Invite a client" description="Worked with someone outside SafeApply? Ask them to confirm it. Confirmed work shows on your profile as verified." />
        <Alert tone="accent">Only list real work. Your client sees exactly what you write and can decline it.</Alert>
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Client" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" required value={f.client_name} onChange={(e) => set('client_name', e.target.value.slice(0, 120))} error={errors.client_name} />
              <Field label="Email" type="email" required value={f.client_email} onChange={(e) => set('client_email', e.target.value)} error={errors.client_email} hint="They must confirm from this address." />
            </div>
          </Card>
          <Card>
            <CardHeader title="The work" />
            <div className="flex flex-col gap-4">
              <Field label="Title" required value={f.title} onChange={(e) => set('title', e.target.value.slice(0, 140))} error={errors.title} placeholder="e.g. Shopify store setup" />
              <TextArea label="Details (optional)" rows={4} value={f.description} onChange={(e) => set('description', e.target.value.slice(0, 2000))} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Amount" optional inputMode="numeric" value={f.amount} onChange={(e) => set('amount', e.target.value)} error={errors.amount} />
                <Select label="Currency" value={f.currency} onChange={(e) => set('currency', e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                <Field label="Finished on" optional type="date" value={f.completed_on} onChange={(e) => set('completed_on', e.target.value)} />
              </div>
            </div>
          </Card>
          <div className="flex items-center justify-between gap-3">
            <Link to="/freelancer/billing" className="text-xs text-muted hover:text-fg">
              Free plan: 3 invites
            </Link>
            <Button type="submit" size="lg" icon="send" loading={busy}>
              Create invite
            </Button>
          </div>
        </form>
      </PageContainer>
    </>
  )
}
