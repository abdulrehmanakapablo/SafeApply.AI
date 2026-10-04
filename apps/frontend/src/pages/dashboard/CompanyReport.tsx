// FILE: src/pages/dashboard/CompanyReport.tsx
// ROUTE: /dashboard/company-report        (new report)
//        /dashboard/company-report/:id    (saved report, shareable)
// BACKEND: POST /api/reports, GET /api/reports/:id
// Shows exactly what the sources returned. No invented "probability" scores.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import { Reveal } from '../../components/motion/Reveal'
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Icon,
  PageContainer,
  PageHeader,
  Skeleton,
  TextArea,
  cn,
  formatDate,
} from '../../components/ui'
import { getReport, runReport, type CompanyReport as Report, type ExtractedJD, type GitHubData } from '../../api/reports'
import { shareReport, unshareReport } from '../../api/growth'
import { apiError } from '../../lib/axios'

const JD_MAX = 10000
const REPOST_ATTENTION = 3

const EMPTY_JD: ExtractedJD = {
  role: null,
  seniority: null,
  experience_years: null,
  required_skills: [],
  nice_to_have_skills: [],
  salary_mentioned: false,
  salary_text: null,
  location: null,
  remote: null,
  employment_type: null,
  company_name: null,
}

const EMPTY_GH: GitHubData = { org_found: false, public_repos: 0, last_commit: null, languages: [], source_url: '' }

type TechStatus = 'both' | 'code_only' | 'ad_only'

function techCheck(skills: string[], langs: string[]): Array<{ name: string; status: TechStatus }> {
  const L = new Set(langs.map((l) => l.toLowerCase()))
  const S = new Set(skills.map((s) => s.toLowerCase()))
  return [
    ...skills.map((s) => ({ name: s, status: (L.has(s.toLowerCase()) ? 'both' : 'ad_only') as TechStatus })),
    ...langs.filter((l) => !S.has(l.toLowerCase())).map((l) => ({ name: l, status: 'code_only' as TechStatus })),
  ]
}

export default function CompanyReport() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(Boolean(id))
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!id) {
      setReport(null)
      setLoadingSaved(false)
      return
    }
    // Already showing this one (just created) — don't refetch.
    if (report?.id === id) return
    let cancelled = false
    setLoadingSaved(true)
    setLoadError('')
    getReport(id)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) setReport(res.data)
        else setLoadError(res.error || 'Report not found')
      })
      .catch((err) => !cancelled && setLoadError(apiError(err, 'Report not found')))
      .finally(() => !cancelled && setLoadingSaved(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (id && loadingSaved) return <ReportSkeleton />

  if (id && !report) {
    return (
      <PageContainer>
        <SEO title="Report not found | SafeApply.AI" description="Report not found" path="/dashboard/company-report" noindex />
        <Card padded={false}>
          <EmptyState
            icon="search_off"
            title="We can’t find that report"
            body={loadError && loadError !== 'Report not found' ? loadError : 'It may have been deleted, or it belongs to a different account.'}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/dashboard/company-report/history" variant="secondary">
                  Report history
                </ButtonLink>
                <ButtonLink to="/dashboard/company-report">New report</ButtonLink>
              </div>
            }
          />
        </Card>
      </PageContainer>
    )
  }

  if (report) {
    return (
      <ReportView
        report={report}
        onNew={() => {
          setReport(null)
          navigate('/dashboard/company-report')
        }}
      />
    )
  }

  return (
    <NewReportForm
      onDone={(r) => {
        setReport(r)
        if (r.id) navigate(`/dashboard/company-report/${r.id}`, { replace: true })
      }}
    />
  )
}

// ─── Form ────────────────────────────────────────────────
function NewReportForm({ onDone }: { onDone: (r: Report) => void }) {
  const [jd, setJd] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const can = (jd.trim().length > 0 || company.trim().length > 0) && jd.length <= JD_MAX && !running

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!can) {
      if (!jd.trim() && !company.trim()) setError('Paste a job post or enter a company name.')
      return
    }
    setRunning(true)
    setError('')
    try {
      const res = await runReport({
        jd_text: jd.trim() || undefined,
        company_name: company.trim() || undefined,
        job_title: role.trim() || undefined,
      })
      if (res.success && res.data) onDone(res.data)
      else setError(res.error || 'The report didn’t finish. Try again in a minute.')
    } catch (err) {
      setError(apiError(err, 'The report didn’t finish. Try again in a minute.'))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <SEO title="New company report | SafeApply.AI" description="Run a company report." path="/dashboard/company-report" noindex />
      <PageContainer>
        <PageHeader
          title="Check a company"
          description="Paste the job post, or just the company name. Add the role to search for repeat postings."
          actions={
            <ButtonLink to="/dashboard/company-report/history" variant="secondary" icon="history">
              History
            </ButtonLink>
          }
        />
        <form onSubmit={submit} noValidate>
          <Card className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <TextArea
              label="Job post"
              optional
              rows={12}
              value={jd}
              onChange={(e) => {
                setJd(e.target.value)
                if (error) setError('')
              }}
              placeholder="Paste the full posting: title, responsibilities, requirements, location, pay."
              hint={`${jd.length.toLocaleString()} / ${JD_MAX.toLocaleString()} characters`}
              error={jd.length > JD_MAX ? `Too long by ${(jd.length - JD_MAX).toLocaleString()} characters` : undefined}
              className="min-h-[260px] text-[13.5px]"
            />
            <div className="flex flex-col gap-5">
              <Field
                label="Company"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value)
                  if (error) setError('')
                }}
                placeholder="e.g. Shopify"
                hint="Used for news and code activity."
                maxLength={200}
              />
              <Field
                label="Role"
                optional
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Product Designer"
                hint="Needed for the repeat-posting search."
                maxLength={200}
              />
              <div className="mt-auto flex flex-col gap-3">
                {error && <Alert>{error}</Alert>}
                <Button type="submit" size="lg" icon="travel_explore" loading={running} disabled={!can && !running} className="w-full">
                  {running ? 'Checking sources' : 'Run report'}
                </Button>
                <p className="text-xs text-muted">Uses 1 of your free reports. Takes about 30 seconds.</p>
              </div>
            </div>
          </Card>
        </form>
        {running && <RunningSources hasRole={Boolean(role.trim())} hasJd={Boolean(jd.trim())} />}
      </PageContainer>
    </>
  )
}

function RunningSources({ hasRole, hasJd }: { hasRole: boolean; hasJd: boolean }) {
  const reduce = useReducedMotion()
  const rows = [
    { icon: 'description', label: 'Reading the job post', on: hasJd },
    { icon: 'newspaper', label: 'Searching recent news', on: true },
    { icon: 'code', label: 'Looking up public code', on: true },
    { icon: 'event_repeat', label: 'Finding repeat postings', on: hasRole },
  ].filter((r) => r.on)
  return (
    <Card aria-live="polite">
      <ul className="grid sm:grid-cols-2 gap-3">
        {rows.map((r, i) => (
          <motion.li
            key={r.label}
            className="flex items-center gap-3 text-sm"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Icon name="progress_activity" className="text-[18px] text-accent animate-spin" />
            <span className="text-muted">{r.label}</span>
          </motion.li>
        ))}
      </ul>
    </Card>
  )
}

function ReportSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </Card>
        ))}
      </div>
    </PageContainer>
  )
}

// ─── Report view ─────────────────────────────────────────
/** `shared` renders the read-only public view at /share/search/:id. */
export function ReportView({ report, onNew, shared = false }: { report: Report & { share_id?: string | null }; onNew?: () => void; shared?: boolean }) {
  const [shareId, setShareId] = useState<string | null>(report.share_id ?? null)
  const [sharing, setSharing] = useState(false)
  const v = useMemo(() => {
    const d = report.report_data || {}
    const jd = d.extracted_jd || EMPTY_JD
    const gh = d.github || EMPTY_GH
    return {
      jd,
      gh,
      hasJd: Boolean(d.extracted_jd && (jd.role || jd.required_skills.length)),
      tech: techCheck(jd.required_skills || [], gh.languages || []),
      postings: d.ghost_posting?.postings || [],
      postingsSource: d.ghost_posting?.source_url || '',
      news: d.news?.articles || [],
      newsSource: d.news?.source_url || '',
    }
  }, [report])

  const publicUrl = (id: string) => `${window.location.origin}/share/search/${id}`

  async function share() {
    if (!report.id) return
    setSharing(true)
    try {
      const id = shareId || (await shareReport(report.id)).data.share_id
      setShareId(id)
      const copied = await navigator.clipboard.writeText(publicUrl(id)).then(() => true, () => false)
      toast.success(copied ? 'Public link copied. Anyone with it can view this report.' : `Public link: ${publicUrl(id)}`)
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t create a public link.'))
    } finally {
      setSharing(false)
    }
  }

  async function unshare() {
    if (!report.id) return
    setSharing(true)
    try {
      await unshareReport(report.id)
      setShareId(null)
      toast.success('Public link turned off')
    } catch (e) {
      toast.error(apiError(e, 'Couldn’t turn off the link.'))
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <SEO
        title={`${report.company_name} report | SafeApply.AI`}
        description={`What public sources say about ${report.company_name}: the job post, code activity, reposts and news.`}
        path={shared ? '/share/search' : '/dashboard/company-report'}
        noindex
      />
      <PageContainer>
        <PageHeader
          back={shared ? undefined : { to: '/dashboard/company-report/history', label: 'All reports' }}
          title={report.company_name}
          description={
            <>
              {report.job_title ? `${report.job_title} · ` : ''}Generated {formatDate(report.created_at)}
              {shared ? ' · shared by a SafeApply user' : ''}
            </>
          }
          actions={
            shared ? (
              <ButtonLink to="/signup" icon="search">
                Check a company yourself
              </ButtonLink>
            ) : (
              <>
                {shareId ? (
                  <>
                    <Button variant="secondary" icon="link" onClick={share} loading={sharing}>
                      Copy public link
                    </Button>
                    <Button variant="ghost" icon="link_off" onClick={unshare} disabled={sharing}>
                      Stop sharing
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" icon="ios_share" onClick={share} loading={sharing} disabled={!report.id}>
                    Share
                  </Button>
                )}
                {onNew && (
                  <Button icon="add" onClick={onNew}>
                    New report
                  </Button>
                )}
              </>
            )
          }
        />

        <div className="grid lg:grid-cols-2 gap-4">
          {/* The job */}
          <Reveal>
            <Card className="h-full">
              <CardHeader title="The job" description="Pulled from the posting text" />
              {!v.hasJd ? (
                <p className="text-sm text-muted">No job post was included. Paste one next time to see role, level, pay and skills here.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
                    <KV k="Role" v={v.jd.role} />
                    <KV k="Level" v={v.jd.seniority} capital />
                    <KV k="Experience" v={v.jd.experience_years ? `${v.jd.experience_years}+ years` : null} />
                    <KV k="Location" v={[v.jd.location, v.jd.remote ? 'Remote' : null].filter(Boolean).join(' · ') || null} />
                    <KV k="Type" v={v.jd.employment_type} capital />
                    <KV k="Pay" v={v.jd.salary_text} fallback="Not listed" />
                  </dl>
                  {v.jd.required_skills.length > 0 && (
                    <div>
                      <p className="text-xs text-muted mb-2">Required</p>
                      <div className="flex flex-wrap gap-1.5">
                        {v.jd.required_skills.map((s) => (
                          <Badge key={s} tone="accent">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {v.jd.nice_to_have_skills.length > 0 && (
                    <div>
                      <p className="text-xs text-muted mb-2">Nice to have</p>
                      <div className="flex flex-wrap gap-1.5">
                        {v.jd.nice_to_have_skills.map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <ButtonLink to="/dashboard/cv-match" variant="secondary" size="sm" icon="compare_arrows" className="self-start">
                    Match my CV to this
                  </ButtonLink>
                </div>
              )}
            </Card>
          </Reveal>

          {/* Code */}
          <Reveal delay={0.04}>
            <Card className="h-full">
              <CardHeader
                title="Engineering activity"
                description="From the company’s public code"
                action={v.gh.source_url ? <SourceLink href={v.gh.source_url} label="GitHub" /> : undefined}
              />
              {!v.gh.org_found ? (
                <p className="text-sm text-muted">No public GitHub organisation matched this name. Many companies keep their code private, so this alone isn’t a warning sign.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <dl className="grid grid-cols-2 gap-4">
                    <KV k="Public repositories" v={String(v.gh.public_repos)} />
                    <KV k="Last commit" v={v.gh.last_commit} />
                  </dl>
                  {v.tech.length > 0 ? (
                    <div>
                      <p className="text-xs text-muted mb-2">Listed in the ad vs. seen in code</p>
                      <ul className="flex flex-col divide-y divide-line max-h-72 overflow-y-auto pr-1">
                        {v.tech.map((t) => (
                          <li key={`${t.name}-${t.status}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="truncate">{t.name}</span>
                            <span className={cn('text-xs shrink-0', t.status === 'both' ? 'text-accent' : 'text-muted')}>
                              {t.status === 'both' ? 'In ad and code' : t.status === 'code_only' ? 'Code only' : 'Ad only'}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-muted leading-relaxed">
                        “Ad only” often just means the tool isn’t in a public repo. Worth a question in the interview.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No languages reported.</p>
                  )}
                </div>
              )}
            </Card>
          </Reveal>

          {/* Postings */}
          <Reveal delay={0.08}>
            <Card className="h-full">
              <CardHeader
                title="Repeat postings"
                description="Where this role shows up in job search results"
                action={v.postingsSource ? <SourceLink href={v.postingsSource} label="Search" /> : undefined}
              />
              {!report.job_title ? (
                <p className="text-sm text-muted">Add the role when you run a report to search for repeat postings.</p>
              ) : v.postings.length === 0 ? (
                <p className="text-sm text-muted">No other listings found for this role right now.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {v.postings.length >= REPOST_ATTENTION && (
                    <Alert tone="warn" title={`Listed ${v.postings.length} times`}>
                      Reposting can mean high turnover, a slow process, or an opening kept up after it’s filled. Ask the recruiter how long it’s been open.
                    </Alert>
                  )}
                  <ol className="flex flex-col">
                    {v.postings.map((p, i) => (
                      <li key={`${p.url}-${i}`} className="relative flex items-center gap-3 py-2.5 pl-5">
                        <span aria-hidden className="absolute left-[3px] top-0 bottom-0 w-px bg-line" />
                        <span aria-hidden className={cn('absolute left-0 w-[7px] h-[7px] rounded-full', i === 0 ? 'bg-accent' : 'bg-muted')} />
                        <span className="text-sm min-w-0 flex-1">
                          <span className="font-medium">{p.date}</span>
                          <span className="text-muted"> · {p.platform}</span>
                        </span>
                        <a href={safeUrl(p.url)} target="_blank" rel="noopener noreferrer nofollow" className="text-muted hover:text-accent transition-colors" aria-label={`Open listing on ${p.platform}`}>
                          <Icon name="open_in_new" className="text-[18px]" />
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          </Reveal>

          {/* News */}
          <Reveal delay={0.12}>
            <Card className="h-full">
              <CardHeader title="Recent news" description="Last 30 days" action={v.newsSource ? <SourceLink href={v.newsSource} label="NewsAPI" /> : undefined} />
              {v.news.length === 0 ? (
                <p className="text-sm text-muted">No coverage in the last 30 days. Normal for smaller companies.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line -my-2">
                  {v.news.map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      <a href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer nofollow" className="group flex items-start justify-between gap-3 py-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-snug group-hover:text-accent transition-colors">{a.title}</span>
                          <span className="block text-xs text-muted mt-1">
                            {a.source} · {a.published_at}
                          </span>
                        </span>
                        <Icon name="arrow_outward" className="text-[18px] text-muted group-hover:text-accent transition-colors shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>

        <p className="text-xs text-muted leading-relaxed max-w-[80ch]">
          Everything above comes from third-party public sources and is linked so you can check it. SafeApply doesn’t verify it, and none of it is career advice.{' '}
          <Link to="/terms" className="underline underline-offset-2 hover:text-fg">
            Terms
          </Link>
        </p>
      </PageContainer>
    </>
  )
}

function KV({ k, v, fallback = '-', capital }: { k: string; v: string | null | undefined; fallback?: string; capital?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className={cn('text-sm mt-1 break-words', !v && 'text-muted', capital && v && 'capitalize')}>{v || fallback}</dd>
    </div>
  )
}

// Links in a report come from third-party APIs. Only http(s) URLs become
// links; anything else (javascript:, data:) is dropped.
function safeUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={safeUrl(href)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors">
      {label}
      <Icon name="arrow_outward" className="text-[14px]" />
    </a>
  )
}
