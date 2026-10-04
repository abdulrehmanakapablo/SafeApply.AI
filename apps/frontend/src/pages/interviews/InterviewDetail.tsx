// FILE: src/pages/interviews/InterviewDetail.tsx
// ROUTE: /interviews/:id   (shared by the candidate and the company)
// PURPOSE: Time, format and link; candidate picks a slot or asks for new
//          times; company re-proposes; either side cancels; after the time
//          passes both confirm whether it happened.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import SlotPicker, { localInput, toIso } from '../../components/interviews/SlotPicker'
import {
  MODE_ICON,
  MODE_LABEL,
  STATUS_LABEL,
  cancelInterview,
  confirmInterview,
  fmtSlot,
  getInterview,
  isPast,
  pickSlot,
  proposeSlots,
  requestReschedule,
  type InterviewDetail as Detail,
} from '../../api/interviews'
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, Dialog, EmptyState, Icon, PageContainer, PageHeader, Skeleton, TextArea, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

export default function InterviewDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const [iv, setIv] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [dialog, setDialog] = useState<'cancel' | 'reschedule' | 'slots' | null>(null)

  const load = useCallback(async () => {
    try {
      setIv((await getInterview(id)).data)
    } catch (e) {
      setError(apiError(e, 'Interview not found.'))
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    if (busy) return
    setBusy(key)
    try {
      await fn()
      toast.success(ok)
      setDialog(null)
      await load()
    } catch (e) {
      toast.error(apiError(e, 'That didn’t work. Try again.'))
    } finally {
      setBusy('')
    }
  }

  if (error) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState icon="event_busy" title="Interview not found" body={error} />
        </Card>
      </PageContainer>
    )
  }
  if (!iv) {
    return (
      <PageContainer narrow>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 rounded-[16px]" />
      </PageContainer>
    )
  }

  const candidate = iv.side === 'candidate'
  const company = iv.side === 'company'
  const active = iv.status !== 'cancelled'
  const past = iv.status === 'scheduled' && isPast(iv)
  const myConfirm = candidate ? iv.candidate_confirmed : iv.company_confirmed
  const other = candidate ? iv.company.name : iv.candidate_name || 'the candidate'

  return (
    <>
      <SEO title={`Interview: ${iv.job.title} | SafeApply.AI`} description="Interview." path={`/interviews/${id}`} noindex />
      <PageContainer narrow>
        <PageHeader
          back={{ to: candidate ? '/dashboard/interviews' : '/recruiter/interviews', label: 'Interviews' }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{iv.job.title}</span>
              <Badge tone={iv.status === 'scheduled' ? 'accent' : iv.status === 'cancelled' ? 'danger' : 'warn'}>{STATUS_LABEL[iv.status]}</Badge>
            </span>
          }
          description={`With ${other}`}
        />
        {iv.side === 'admin' && <Alert tone="warn">Viewing as admin. Actions are disabled.</Alert>}
        {iv.status === 'cancelled' && <Alert>Cancelled by the {iv.cancelled_by}. {iv.cancel_reason}</Alert>}
        {iv.status === 'reschedule_requested' && (
          <Alert tone="warn">
            {candidate ? 'You asked for new times.' : 'The candidate asked for new times.'} {iv.candidate_note && `“${iv.candidate_note}”`}
          </Alert>
        )}

        <Card>
          <div className="flex items-start gap-4">
            <span className="w-12 h-12 rounded-[12px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Icon name={MODE_ICON[iv.mode]} className="text-[24px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {MODE_LABEL[iv.mode]} · {iv.duration_min} minutes
              </p>
              <p className="text-sm text-muted mt-0.5">{iv.scheduled_at && iv.status === 'scheduled' ? fmtSlot(iv.scheduled_at) : 'Time not set yet'}</p>
              {iv.location && <p className="text-sm mt-2 break-words">{iv.location}</p>}
              {iv.note && <p className="text-sm text-muted mt-2 whitespace-pre-line break-words">{iv.note}</p>}
            </div>
          </div>
          {iv.video_url && iv.status === 'scheduled' && !past && (
            <a href={iv.video_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-[8px] bg-accent text-ink text-sm font-semibold hover:bg-accent-hover transition-colors">
              <Icon name="videocam" className="text-[18px]" />
              Join video call
            </a>
          )}
        </Card>

        {/* Candidate picks a time */}
        {candidate && iv.status === 'proposed' && (
          <Card>
            <CardHeader title="Pick a time" description="Shown in your time zone." />
            <ul className="grid sm:grid-cols-2 gap-2">
              {iv.slots.map((s) => {
                const gone = new Date(s.starts_at).getTime() < Date.now()
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      disabled={gone || Boolean(busy)}
                      onClick={() => run(`pick-${s.id}`, () => pickSlot(iv.id, s.id), 'Interview booked')}
                      className={cn('w-full h-12 rounded-[10px] border text-sm font-medium tabular transition-colors', gone ? 'border-line text-muted line-through' : 'border-line hover:border-accent hover:text-accent')}
                    >
                      {busy === `pick-${s.id}` ? 'Booking…' : fmtSlot(s.starts_at)}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {/* Did it happen? */}
        {past && iv.side !== 'admin' && (
          <Card>
            <CardHeader title="Did this interview happen?" description="Only interviews the candidate confirms count on the company’s public record." />
            {myConfirm === null ? (
              <div className="flex flex-wrap gap-2">
                <Button icon="check" onClick={() => run('yes', () => confirmInterview(iv.id, true), 'Thanks for confirming')} loading={busy === 'yes'}>
                  Yes, it happened
                </Button>
                <Button variant="secondary" onClick={() => run('no', () => confirmInterview(iv.id, false), 'Noted')} loading={busy === 'no'}>
                  No, it didn’t
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">You answered: {myConfirm ? 'it happened' : 'it didn’t happen'}.</p>
            )}
          </Card>
        )}

        {/* Actions */}
        {active && !past && iv.side !== 'admin' && (
          <div className="flex flex-wrap gap-2">
            {company && (
              <Button variant="secondary" icon="edit_calendar" onClick={() => setDialog('slots')}>
                Offer new times
              </Button>
            )}
            {candidate && iv.status !== 'reschedule_requested' && (
              <Button variant="secondary" icon="schedule" onClick={() => setDialog('reschedule')}>
                Ask for other times
              </Button>
            )}
            <Button variant="ghost" className="hover:text-danger" onClick={() => setDialog('cancel')}>
              {candidate ? 'Decline' : 'Cancel interview'}
            </Button>
            {company && (
              <ButtonLink to={`/recruiter/applicants/${iv.application_id}`} variant="ghost">
                Applicant
              </ButtonLink>
            )}
            {candidate && (
              <Link to={`/dashboard/applications/${iv.application_id}`} className="self-center text-sm text-muted hover:text-fg underline-offset-4 hover:underline">
                Application
              </Link>
            )}
          </div>
        )}
      </PageContainer>

      {dialog === 'cancel' && (
        <TextDialog
          title={candidate ? 'Decline this interview?' : 'Cancel this interview?'}
          label="Reason"
          min={3}
          confirm={candidate ? 'Decline' : 'Cancel interview'}
          busy={busy === 'cancel'}
          onClose={() => setDialog(null)}
          onSubmit={(t) => run('cancel', () => cancelInterview(iv.id, t), candidate ? 'Declined' : 'Cancelled')}
        />
      )}
      {dialog === 'reschedule' && (
        <TextDialog
          title="Ask for other times"
          label="When suits you? (optional)"
          min={0}
          confirm="Send request"
          busy={busy === 'reschedule'}
          onClose={() => setDialog(null)}
          onSubmit={(t) => run('reschedule', () => requestReschedule(iv.id, t), 'Request sent')}
        />
      )}
      {dialog === 'slots' && <SlotsDialog busy={busy === 'slots'} onClose={() => setDialog(null)} onSubmit={(s) => run('slots', () => proposeSlots(iv.id, s), 'New times sent')} />}
    </>
  )
}

function TextDialog({ title, label, min, confirm, busy, onClose, onSubmit }: { title: string; label: string; min: number; confirm: string; busy: boolean; onClose: () => void; onSubmit: (t: string) => void }) {
  const [text, setText] = useState('')
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button onClick={() => (text.trim().length >= min ? onSubmit(text.trim()) : toast.error('Add a short note.'))} loading={busy}>
            {confirm}
          </Button>
        </>
      }
    >
      <TextArea label={label} rows={3} value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} />
    </Dialog>
  )
}

function SlotsDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (s: string[]) => void }) {
  const [slots, setSlots] = useState<string[]>([localInput(24 * 60)])
  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title="Offer new times"
      description="This replaces the current options. The candidate picks again."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button onClick={() => onSubmit(slots.filter(Boolean).map(toIso))} loading={busy}>
            Send times
          </Button>
        </>
      }
    >
      <SlotPicker value={slots} onChange={setSlots} />
    </Dialog>
  )
}
