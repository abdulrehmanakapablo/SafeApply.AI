// FILE: src/pages/interviews/InterviewNew.tsx
// ROUTE: /recruiter/interviews/new?applicant=<id>
// PURPOSE: Offer an applicant up to 5 times. Video interviews get a private
//          Jitsi link automatically; phone/in-person need details.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import SlotPicker, { localInput, toIso } from '../../components/interviews/SlotPicker'
import { MODE_LABEL, createInterview, type InterviewMode } from '../../api/interviews'
import { getApplicant, type Applicant } from '../../api/recruiter'
import { Alert, Button, Card, CardHeader, EmptyState, Field, PageContainer, PageHeader, Select, Skeleton, TextArea, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

const MODES: InterviewMode[] = ['video', 'phone', 'onsite']

export default function InterviewNew() {
  const [params] = useSearchParams()
  const appId = params.get('applicant') || ''
  const navigate = useNavigate()
  const [app, setApp] = useState<Applicant | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<InterviewMode>('video')
  const [duration, setDuration] = useState('30')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const [slots, setSlots] = useState<string[]>([localInput(24 * 60), localInput(48 * 60)])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!appId) return setError('Choose an applicant first.')
    getApplicant(appId)
      .then((r) => setApp(r.data))
      .catch((e) => setError(apiError(e, 'Applicant not found.')))
  }, [appId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !app) return
    const filled = slots.filter(Boolean)
    if (!filled.length) return toast.error('Add at least one time.')
    if (filled.some((s) => new Date(s).getTime() < Date.now() + 30 * 60_000)) return toast.error('Times must be at least 30 minutes from now.')
    if (mode !== 'video' && location.trim().length < 3) return toast.error(mode === 'phone' ? 'Add the number you’ll call from or ask them to call.' : 'Add the address.')
    setBusy(true)
    try {
      const r = await createInterview({ application_id: app.id, mode, duration_min: Number(duration), location: location.trim(), note: note.trim(), slots: filled.map(toIso) })
      toast.success('Times sent to the candidate')
      navigate(`/interviews/${r.data.id}`, { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t schedule the interview.'))
      setBusy(false)
    }
  }

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="event_busy" title="Can’t schedule" body={error} />
        </Card>
      </PageContainer>
    )
  }

  return (
    <>
      <SEO title="Schedule interview | SafeApply.AI" description="Schedule an interview." path="/recruiter/interviews/new" noindex />
      <PageContainer narrow>
        <PageHeader back={{ to: app ? `/recruiter/applicants/${app.id}` : '/recruiter/interviews', label: 'Applicant' }} title={app ? `Interview ${app.candidate.full_name}` : 'Schedule interview'} description={app ? `For ${app.job.title}. They pick one of your times.` : undefined} />
        {!app ? (
          <Skeleton className="h-80 rounded-[16px]" />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Format" />
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={cn('h-11 rounded-[10px] border text-sm font-medium transition-colors', mode === m ? 'border-accent bg-accent/10 text-fg' : 'border-line text-muted hover:text-fg')}
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid sm:grid-cols-[160px_1fr] gap-4">
                <Select label="Length" value={duration} onChange={(e) => setDuration(e.target.value)} options={['15', '30', '45', '60', '90', '120'].map((v) => ({ value: v, label: `${v} minutes` }))} />
                {mode === 'video' ? (
                  <Alert tone="accent">A private video link is created for you both. No account needed to join.</Alert>
                ) : (
                  <Field label={mode === 'phone' ? 'Phone details' : 'Address'} required value={location} onChange={(e) => setLocation(e.target.value.slice(0, 300))} placeholder={mode === 'phone' ? 'We’ll call the number on your CV' : 'Office address and floor'} />
                )}
              </div>
            </Card>
            <Card>
              <SlotPicker value={slots} onChange={setSlots} />
            </Card>
            <Card>
              <TextArea label="Message (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} hint="Who they’ll meet, what to prepare." />
            </Card>
            <div className="flex justify-end">
              <Button type="submit" size="lg" icon="send" loading={busy}>
                Send times
              </Button>
            </div>
          </form>
        )}
      </PageContainer>
    </>
  )
}
