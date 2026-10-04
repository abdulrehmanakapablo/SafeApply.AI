// FILE: src/pages/dashboard/ApplicationDetail.tsx
// ROUTE: /dashboard/tracker/:id
// BACKEND: GET/PATCH/DELETE /api/tracker/:id, POST /api/tracker/:id/communication

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import ApplicationForm from '../../components/tracker/ApplicationForm'
import {
  addCommunication,
  deleteApplication,
  getApplication,
  updateApplication,
  type ApplicationDetail as Detail,
  type ApplicationStatus,
  type CommunicationType,
} from '../../api/tracker'
import {
  APPLICATION_STATUSES,
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Icon,
  PageContainer,
  PageHeader,
  STATUS_META,
  Select,
  Skeleton,
  StatusBadge,
  TextArea,
  cn,
  formatDate,
  relativeDays,
} from '../../components/ui'
import { apiError } from '../../lib/axios'

const COMM: Record<CommunicationType, { label: string; icon: string }> = {
  email: { label: 'Email', icon: 'mail' },
  call: { label: 'Call', icon: 'call' },
  interview: { label: 'Interview', icon: 'groups' },
  follow_up: { label: 'Follow-up', icon: 'reply' },
  rejection: { label: 'Rejection', icon: 'block' },
}

const today = () => new Date().toISOString().slice(0, 10)

function salary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null
  const f = (n: number) => n.toLocaleString()
  if (min && max && min !== max) return `${f(min)} to ${f(max)}`
  return f((min || max) as number)
}

function safeHref(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

export default function ApplicationDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [app, setApp] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [statusBusy, setStatusBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)

  const [notes, setNotes] = useState('')
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const savedNotes = useRef('')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [comm, setComm] = useState<{ type: CommunicationType; notes: string; date: string }>({ type: 'email', notes: '', date: today() })
  const [commBusy, setCommBusy] = useState(false)
  const [commError, setCommError] = useState('')

  const refresh = useCallback(async () => {
    const res = await getApplication(id)
    if (res.success && res.data) setApp(res.data)
  }, [id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setError('')
    getApplication(id)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) {
          setApp(res.data)
          setNotes(res.data.notes || '')
          savedNotes.current = res.data.notes || ''
        } else setNotFound(true)
      })
      .catch((e) => {
        if (cancelled) return
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status === 404 || status === 400) setNotFound(true)
        else setError(apiError(e, 'Couldn’t load this application.'))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [id])

  // Notes autosave (debounced)
  useEffect(() => {
    if (!app || notes === savedNotes.current) return
    if (notesTimer.current) clearTimeout(notesTimer.current)
    setNotesState('saving')
    notesTimer.current = setTimeout(async () => {
      try {
        const res = await updateApplication(app.id, { notes })
        if (!res.success) throw new Error(res.error)
        savedNotes.current = notes
        setNotesState('saved')
      } catch {
        setNotesState('error')
      }
    }, 1200)
    return () => {
      if (notesTimer.current) clearTimeout(notesTimer.current)
    }
  }, [notes, app])

  // Warn before leaving with unsaved notes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (notes !== savedNotes.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [notes])

  async function changeStatus(next: ApplicationStatus) {
    if (!app || app.status === next || statusBusy) return
    const prev = app.status
    setApp({ ...app, status: next })
    setStatusBusy(true)
    try {
      const res = await updateApplication(app.id, { status: next })
      if (!res.success) throw new Error(res.error)
      await refresh()
      toast.success(`Moved to ${STATUS_META[next].label}`)
    } catch (e) {
      setApp((c) => (c ? { ...c, status: prev } : c))
      toast.error(apiError(e, 'Couldn’t change the status.'))
    } finally {
      setStatusBusy(false)
    }
  }

  async function submitComm(e: FormEvent) {
    e.preventDefault()
    if (!app || commBusy) return
    if (!comm.notes.trim()) return setCommError('Write what happened')
    if (comm.date > today()) return setCommError('Date can’t be in the future')
    setCommBusy(true)
    setCommError('')
    try {
      const res = await addCommunication(app.id, { type: comm.type, notes: comm.notes.trim().slice(0, 2000), date: comm.date })
      if (!res.success) throw new Error(res.error)
      await refresh()
      setComm({ type: 'email', notes: '', date: today() })
      toast.success('Added to the log')
    } catch (err) {
      setCommError(apiError(err, 'Couldn’t add it.'))
    } finally {
      setCommBusy(false)
    }
  }

  async function confirmDelete() {
    if (!app) return
    setDeleting(true)
    try {
      const res = await deleteApplication(app.id)
      if (!res.success) throw new Error(res.error)
      toast.success('Application deleted')
      navigate('/dashboard/tracker', { replace: true })
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t delete it.'))
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-72" />
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <Skeleton className="h-72 rounded-[16px]" />
          <Skeleton className="h-72 rounded-[16px]" />
        </div>
      </PageContainer>
    )
  }

  if (notFound || error || !app) {
    return (
      <PageContainer narrow>
        <Card padded={false}>
          <EmptyState
            icon={notFound ? 'search_off' : 'error'}
            title={notFound ? 'Application not found' : 'Couldn’t load this application'}
            body={notFound ? 'It may have been deleted, or the link is wrong.' : error}
            action={<ButtonLink to="/dashboard/tracker">Back to applications</ButtonLink>}
          />
        </Card>
      </PageContainer>
    )
  }

  const link = safeHref(app.job_link)
  const pay = salary(app.salary_min, app.salary_max)
  const timeline = [...(app.timeline || [])].sort((a, b) => +new Date(b.changed_at) - +new Date(a.changed_at))
  const log = [...(app.communication_log || [])].sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const lastTouch = log[0]?.date || timeline[0]?.changed_at || app.date_applied
  const quietDays = Math.floor((Date.now() - new Date(lastTouch).getTime()) / 86_400_000)
  const waiting = ['applied', 'screening'].includes(app.status) && quietDays >= 14

  return (
    <>
      <SEO title={`${app.company_name} | Applications | SafeApply.AI`} description="Application details." path={`/dashboard/tracker/${app.id}`} noindex />
      <PageContainer>
        <PageHeader
          back={{ to: '/dashboard/tracker', label: 'Applications' }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <span className="break-words">{app.company_name}</span>
              <StatusBadge status={app.status} />
            </span>
          }
          description={app.job_title}
          actions={
            <>
              <Button variant="secondary" icon="edit" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="ghost" icon="delete" onClick={() => setDeleteOpen(true)} className="hover:text-danger" aria-label="Delete application">
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          }
        />

        {waiting && (
          <Alert tone="warn" title={`No activity for ${quietDays} days`}>
            Consider a short follow-up, or mark it as No reply so your stats stay accurate.
          </Alert>
        )}

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <Card>
              <CardHeader
                title="Notes"
                description="Saved automatically."
                action={
                  <span className={cn('text-xs', notesState === 'error' ? 'text-danger' : 'text-muted')} aria-live="polite">
                    {notesState === 'saving' ? 'Saving…' : notesState === 'saved' ? 'Saved' : notesState === 'error' ? 'Not saved. Keep typing to retry.' : ''}
                  </span>
                }
              />
              <TextArea aria-label="Notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 5000))} placeholder="Interviewers, questions they asked, salary talk, next steps." />
            </Card>

            <Card>
              <CardHeader title="Contact log" description="Emails, calls and interviews with this company." />
              <form onSubmit={submitComm} className="flex flex-col gap-3 pb-5 mb-5 border-b border-line" noValidate>
                <div className="grid sm:grid-cols-[160px_160px_1fr] gap-3">
                  <Select
                    aria-label="Type"
                    value={comm.type}
                    onChange={(e) => setComm((c) => ({ ...c, type: e.target.value as CommunicationType }))}
                    options={(Object.keys(COMM) as CommunicationType[]).map((k) => ({ value: k, label: COMM[k].label }))}
                  />
                  <Field aria-label="Date" type="date" max={today()} value={comm.date} onChange={(e) => setComm((c) => ({ ...c, date: e.target.value }))} />
                  <Field
                    aria-label="What happened"
                    value={comm.notes}
                    onChange={(e) => {
                      setComm((c) => ({ ...c, notes: e.target.value }))
                      if (commError) setCommError('')
                    }}
                    placeholder="e.g. Recruiter call, next round on Friday"
                    error={commError}
                    maxLength={2000}
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary" icon="add" loading={commBusy} className="self-end">
                  Add to log
                </Button>
              </form>
              {log.length === 0 ? (
                <p className="text-sm text-muted">Nothing logged yet.</p>
              ) : (
                <ol className="flex flex-col">
                  <AnimatePresence initial={false}>
                    {log.map((c) => (
                      <motion.li
                        key={c.id}
                        initial={reduce ? false : { opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3 py-3 border-b border-line last:border-0"
                      >
                        <span className="w-8 h-8 rounded-[8px] bg-line flex items-center justify-center shrink-0">
                          <Icon name={COMM[c.type]?.icon || 'chat'} className="text-[16px] text-muted" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium">{COMM[c.type]?.label || c.type}</span>
                            <time dateTime={c.date} className="text-xs text-muted tabular whitespace-nowrap">
                              {formatDate(c.date)}
                            </time>
                          </div>
                          <p className="text-sm text-muted mt-0.5 whitespace-pre-line break-words">{c.notes}</p>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
              )}
            </Card>

            {app.jd_text && (
              <Card>
                <button type="button" onClick={() => setJdOpen((o) => !o)} aria-expanded={jdOpen} className="w-full flex items-center justify-between gap-3 text-left">
                  <span>
                    <span className="block text-[15px] font-semibold">Job description</span>
                    <span className="block text-[13px] text-muted mt-1">The copy you saved when you added this.</span>
                  </span>
                  <Icon name="expand_more" className={cn('text-[22px] text-muted transition-transform', jdOpen && 'rotate-180')} />
                </button>
                <AnimatePresence initial={false}>
                  {jdOpen && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pt-5 text-sm text-muted leading-relaxed whitespace-pre-line break-words max-h-[480px] overflow-y-auto">{app.jd_text}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )}
          </div>

          <aside className="flex flex-col gap-6 order-first lg:order-none lg:sticky lg:top-20">
            <Card>
              <Select
                label="Status"
                value={app.status}
                disabled={statusBusy}
                onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}
                options={APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              />
              <dl className="mt-5 flex flex-col divide-y divide-line text-sm">
                <Row label="Applied" value={`${formatDate(app.date_applied)} (${relativeDays(app.date_applied)})`} />
                <Row label="Location" value={app.location || 'Not set'} muted={!app.location} />
                <Row label="Salary" value={pay || 'Not set'} muted={!pay} />
                {typeof app.match_score === 'number' && app.match_score > 0 && <Row label="CV match" value={`${Math.round(app.match_score)}%`} />}
                <Row
                  label="Job post"
                  value={
                    link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-fg hover:text-accent underline underline-offset-2">
                        Open
                        <Icon name="open_in_new" className="text-[14px]" />
                      </a>
                    ) : (
                      'Not set'
                    )
                  }
                  muted={!link}
                />
              </dl>
            </Card>

            <Card>
              <CardHeader title="History" className="mb-4" />
              {timeline.length === 0 ? (
                <p className="text-sm text-muted">No status changes yet.</p>
              ) : (
                <ol className="relative flex flex-col gap-4 pl-5 before:absolute before:left-[5px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-line">
                  {timeline.map((t, i) => (
                    <li key={t.id} className="relative">
                      <span className={cn('absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-surface', i === 0 ? 'bg-accent' : 'bg-line')} aria-hidden />
                      <p className="text-sm font-medium">{STATUS_META[t.status as ApplicationStatus]?.label || t.status}</p>
                      <time dateTime={t.changed_at} className="text-xs text-muted tabular">
                        {formatDate(t.changed_at)}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Link
              to="/dashboard/company-report"
              className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-4 hover:border-muted/40 transition-colors"
            >
              <Icon name="travel_explore" className="text-[20px] text-accent" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Check {app.company_name}</span>
                <span className="block text-xs text-muted">News, engineering activity, repeat postings</span>
              </span>
              <Icon name="arrow_forward" className="text-[18px] text-muted group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </aside>
        </div>

        <ApplicationForm
          open={editOpen}
          mode="edit"
          initial={app}
          onClose={() => setEditOpen(false)}
          onSubmit={async (payload) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { jd_text: _jd, notes: _n, ...rest } = payload
              const res = await updateApplication(app.id, rest)
              if (!res.success) return res.error || 'Couldn’t save changes.'
              await refresh()
              setEditOpen(false)
              toast.success('Saved')
              return null
            } catch (e) {
              return apiError(e, 'Couldn’t save changes.')
            }
          }}
        />
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => !deleting && setDeleteOpen(false)}
          onConfirm={confirmDelete}
          loading={deleting}
          title="Delete this application?"
          body={`${app.company_name}, ${app.job_title}. Notes, history and the contact log are deleted too.`}
        />
      </PageContainer>
    </>
  )
}

function Row({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className={cn('text-right min-w-0 break-words', muted && 'text-muted/70')}>{value}</dd>
    </div>
  )
}
