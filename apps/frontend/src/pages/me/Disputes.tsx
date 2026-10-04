// FILE: src/pages/me/Disputes.tsx
// ROUTE: /disputes
// PURPOSE: Contest a ghost flag, penalty or trust level with evidence.
//          An admin accepts or rejects each one with a note.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { DISPUTE_LABEL, createDispute, getMyDisputes, type DisputeType, type MyDisputes } from '../../api/growth'
import { apiError } from '../../lib/axios'
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageContainer, PageHeader, Select, SkeletonRows, TextArea, formatDate } from '../../components/ui'

const STATUS_TONE = { open: 'warn', accepted: 'accent', rejected: 'neutral' } as const

export default function Disputes() {
  const [d, setD] = useState<MyDisputes | null>(null)
  const [type, setType] = useState<DisputeType>('trust_level')
  const [ref, setRef] = useState('')
  const [reason, setReason] = useState('')
  const [evidence, setEvidence] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const r = (await getMyDisputes()).data
      setD(r)
      if (r.ghost_jobs.length) setType((t) => (t === 'trust_level' ? 'ghost_flag' : t))
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t load disputes.'))
      setD({ disputes: [], ghost_jobs: [], company: null })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const types: DisputeType[] = [
    ...(d?.ghost_jobs.length ? (['ghost_flag'] as const) : []),
    ...(d?.company && d.company.penalty_level > 0 ? (['penalty'] as const) : []),
    'trust_level',
    'other',
  ]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (reason.trim().length < 20) return setErr('Explain in at least 20 characters.')
    if (evidence && !/^https:\/\//i.test(evidence.trim())) return setErr('Evidence must be an https:// link.')
    if (type === 'ghost_flag' && !ref) return setErr('Pick the flagged job.')
    setBusy(true)
    try {
      await createDispute({ subject_type: type, subject_ref: type === 'ghost_flag' ? ref : null, reason: reason.trim(), evidence_url: evidence.trim() || null })
      toast.success('Dispute sent. An admin will review it.')
      setReason('')
      setEvidence('')
      setRef('')
      await load()
    } catch (e2) {
      setErr(apiError(e2, 'Couldn’t send the dispute.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SEO title="Disputes | SafeApply.AI" description="Dispute a flag or level." path="/disputes" noindex />
      <PageContainer narrow>
        <PageHeader title="Disputes" description="Think a flag, penalty or level is wrong? Tell us why and link evidence. A person reviews every dispute." />
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Select label="What are you disputing?" value={type} onChange={(e) => setType(e.target.value as DisputeType)} options={types.map((t) => ({ value: t, label: DISPUTE_LABEL[t] }))} />
            {type === 'ghost_flag' && d && (
              <Select label="Flagged job" value={ref} onChange={(e) => setRef(e.target.value)} options={[{ value: '', label: 'Pick a job' }, ...d.ghost_jobs.map((j) => ({ value: j.id, label: j.title }))]} hint="Example evidence: you reviewed applicants outside SafeApply and can show it." />
            )}
            {type === 'penalty' && d?.company && <p className="text-sm text-muted">Disputing the penalty on {d.company.name}.</p>}
            <TextArea label="Why is it wrong?" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 2000))} rows={5} hint={`${reason.trim().length} / 2000, at least 20`} />
            <Field label="Evidence link" optional value={evidence} onChange={(e) => setEvidence(e.target.value.slice(0, 500))} placeholder="https://" hint="A document or screenshot link. Make sure it’s viewable." />
            {err && <p className="text-sm text-danger">{err}</p>}
            <div>
              <Button type="submit" loading={busy} icon="gavel">
                Send dispute
              </Button>
            </div>
          </form>
        </Card>

        <Card padded={false}>
          <CardHeader title="Your disputes" className="px-5 pt-5 pb-3" />
          {!d ? (
            <div className="p-5">
              <SkeletonRows rows={2} />
            </div>
          ) : d.disputes.length === 0 ? (
            <EmptyState icon="gavel" title="No disputes yet" />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {d.disputes.map((x) => (
                <li key={x.id} className="px-5 py-4 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{DISPUTE_LABEL[x.subject_type]}</span>
                    <Badge tone={STATUS_TONE[x.status]}>{x.status}</Badge>
                    <span className="text-xs text-muted ml-auto">{formatDate(x.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted break-words whitespace-pre-line">{x.reason}</p>
                  {x.admin_note && <p className="text-sm border-l-2 border-line pl-3 break-words">Admin: {x.admin_note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageContainer>
    </>
  )
}
