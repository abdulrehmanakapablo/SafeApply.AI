// FILE: src/pages/dashboard/CVMatch.tsx
// ROUTE: /dashboard/cv-match
// BACKEND: POST /api/cv/upload, POST /api/cv/match, POST /api/cv/structure (streamed)
// PURPOSE: Compare a CV with a job post, review suggested rewrites (optional),
//          then build the tailored CV in the Build tab. State lives in
//          cvStore so it survives navigation.

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import CVEditor from '../../components/cv/CVEditor'
import AIProgressPopup, { EMPTY_PROGRESS, type AIProgressState } from '../../components/cv/AIProgressPopup'
import { applyRewritesLocally, matchCV, payloadToCVData, structureCVStream, uploadCV, type StructureEvent } from '../../api/cv'
import { useCVStore } from '../../store/cvStore'
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Icon, PageContainer, PageHeader, Tabs, TextArea, cn } from '../../components/ui'
import { apiError } from '../../lib/axios'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
const CV_MIN = 100
const CV_MAX = 15000
const JD_MIN = 50
const JD_MAX = 10000

function fileProblem(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return 'That file is over 5 MB.'
  const n = file.name.toLowerCase()
  if (!ALLOWED_MIME.has(file.type) || !/\.(pdf|docx)$/.test(n)) return 'Upload a PDF or Word (.docx) file.'
  return null
}

function scoreTone(pct: number): { text: string; bar: string; label: string } {
  if (pct >= 70) return { text: 'text-accent', bar: 'bg-accent', label: 'Strong match' }
  if (pct >= 40) return { text: 'text-warn', bar: 'bg-warn', label: 'Partial match' }
  return { text: 'text-danger', bar: 'bg-danger', label: 'Weak match' }
}

export default function CVMatch() {
  const reduce = useReducedMotion()
  const s = useCVStore()
  const { cvText, jdText, uploadedFileName, matchResult: result, acceptedIndices, skippedIndices, activeCvTab, hasBuilt } = s

  const [saveToProfile, setSaveToProfile] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [running, setRunning] = useState(false)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState<AIProgressState>(EMPTY_PROGRESS)
  const [buildKey, setBuildKey] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cvLen = cvText.trim().length
  const jdLen = jdText.trim().length
  const cvOk = cvLen >= CV_MIN && cvLen <= CV_MAX
  const jdOk = jdLen >= JD_MIN && jdLen <= JD_MAX
  const accepted = new Set(acceptedIndices)
  const skipped = new Set(skippedIndices)

  async function processFile(file: File) {
    const p = fileProblem(file)
    if (p) return toast.error(p)
    setUploading(true)
    try {
      const res = await uploadCV(file, saveToProfile)
      if (res.success && res.data?.text) {
        s.setCvText(res.data.text)
        s.setUploadedFileName(file.name)
        toast.success('CV read')
      } else toast.error(res.error || 'We couldn’t read that file.')
    } catch (e) {
      toast.error(apiError(e, 'Upload failed. Try again.'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function runAnalysis() {
    if (running) return
    if (cvLen < CV_MIN) return toast.error(`Your CV needs at least ${CV_MIN} characters.`)
    if (cvLen > CV_MAX) return toast.error(`Your CV is over ${CV_MAX.toLocaleString()} characters.`)
    if (jdLen < JD_MIN) return toast.error(`The job post needs at least ${JD_MIN} characters.`)
    if (jdLen > JD_MAX) return toast.error(`The job post is over ${JD_MAX.toLocaleString()} characters.`)
    setRunning(true)
    try {
      const res = await matchCV(cvText.trim(), jdText.trim(), saveToProfile)
      if (res.success && res.data) {
        s.setMatchResult(res.data)
        toast.success('Match ready')
      } else toast.error(res.error || 'Matching is unavailable right now.')
    } catch (e) {
      toast.error(apiError(e, 'Matching is unavailable right now.'))
    } finally {
      setRunning(false)
    }
  }

  // Rewrites are optional. Building works with zero accepted.
  const buildCV = useCallback(async () => {
    if (building || !result) return
    if (cvText.trim().length < CV_MIN) return toast.error('Your CV text is missing or too short.')
    setProgress({ ...EMPTY_PROGRESS })
    const res = await structureCVStream(cvText.trim(), false, (event: StructureEvent) => {
      if (event.type === 'start') {
        setBuilding(true)
        setProgress({ started: true, totalChunks: event.total_chunks, completedChunks: 0, merging: false, cached: false, error: null })
      } else if (event.type === 'progress') setProgress((p) => ({ ...p, completedChunks: event.chunk }))
      else if (event.type === 'merging') setProgress((p) => ({ ...p, merging: true }))
      else if (event.type === 'error') setProgress((p) => ({ ...p, error: event.message }))
    })
    if (!res.success || !res.data) {
      toast.error(res.error || 'Couldn’t build the CV. Try again.')
      setBuilding(false)
      setProgress(EMPTY_PROGRESS)
      return
    }
    const chosen = result.bullet_rewrites.filter((_, i) => accepted.has(i))
    const { cv, appliedCount } = applyRewritesLocally(payloadToCVData(res.data), chosen)
    s.setMatchCV(cv)
    s.setHasBuilt(true)
    s.setActiveCvTab('build')
    setBuildKey((k) => k + 1)
    if (chosen.length && appliedCount < chosen.length)
      toast(`${appliedCount} of ${chosen.length} rewrites applied. Edit the rest by hand.`)
    else toast.success(appliedCount ? `CV built with ${appliedCount} rewrite${appliedCount === 1 ? '' : 's'}` : 'CV built')
    await new Promise((r) => setTimeout(r, 450))
    setBuilding(false)
    setProgress(EMPTY_PROGRESS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building, cvText, result, acceptedIndices])

  const pct = result ? Math.min(100, Math.max(0, Math.round(result.match_percentage))) : 0
  const tone = scoreTone(pct)
  const rewrites = result?.bullet_rewrites ?? []
  const reviewed = rewrites.filter((_, i) => accepted.has(i) || skipped.has(i)).length

  return (
    <>
      <SEO title="CV match | SafeApply.AI" description="Compare your CV with a job post." path="/dashboard/cv-match" noindex />
      <PageContainer>
        <PageHeader title="CV match" description="See which skills the job asks for that your CV doesn’t show, then build a tailored version." />

        <Tabs
          label="CV match views"
          value={activeCvTab}
          onChange={s.setActiveCvTab}
          items={[
            { value: 'analysis', label: 'Compare', icon: 'compare_arrows' },
            { value: 'build', label: 'Tailored CV', icon: 'description', disabled: !hasBuilt },
          ]}
          className="self-start"
        />

        {activeCvTab === 'analysis' ? (
          <>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="flex flex-col gap-4">
                <CardHeader
                  title="Your CV"
                  description="Upload a file or paste the text."
                  className="mb-0"
                  action={uploadedFileName ? <Badge tone="accent">{uploadedFileName}</Badge> : undefined}
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload a CV. PDF or Word, up to 5 MB."
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileRef.current?.click()
                    }
                  }}
                  onDragOver={(e: DragEvent<HTMLDivElement>) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e: DragEvent<HTMLDivElement>) => {
                    e.preventDefault()
                    setDragOver(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) void processFile(f)
                  }}
                  className={cn(
                    'rounded-[12px] border-2 border-dashed px-4 py-5 flex items-center gap-3 cursor-pointer transition-colors',
                    dragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-muted/60',
                  )}
                >
                  <Icon name={uploading ? 'progress_activity' : 'upload_file'} className={cn('text-[24px] text-muted shrink-0', uploading && 'animate-spin text-accent')} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{uploading ? 'Reading your file…' : 'Drop a PDF or Word file, or click to choose'}</p>
                    <p className="text-xs text-muted">Up to 5 MB. The text appears below for you to check.</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const f = e.target.files?.[0]
                      if (f) void processFile(f)
                    }}
                  />
                </div>
                <TextArea
                  aria-label="CV text"
                  rows={10}
                  value={cvText}
                  onChange={(e) => s.setCvText(e.target.value)}
                  placeholder="Or paste your CV text here."
                  hint={`${cvLen.toLocaleString()} / ${CV_MAX.toLocaleString()} characters`}
                  error={cvLen > CV_MAX ? `Over the ${CV_MAX.toLocaleString()} character limit` : undefined}
                />
                <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none w-fit">
                  <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} className="w-4 h-4 accent-accent" />
                  Keep this CV on my account for next time
                </label>
              </Card>

              <Card className="flex flex-col gap-4">
                <CardHeader title="The job post" description="Paste the full description, including requirements." className="mb-0" />
                <TextArea
                  aria-label="Job description"
                  rows={15}
                  value={jdText}
                  onChange={(e) => s.setJdText(e.target.value)}
                  placeholder="Paste the job description."
                  hint={`${jdLen.toLocaleString()} / ${JD_MAX.toLocaleString()} characters`}
                  error={jdLen > JD_MAX ? `Over the ${JD_MAX.toLocaleString()} character limit` : undefined}
                  className="flex-1"
                  wrapClassName="flex-1 flex flex-col"
                />
                <Button size="lg" icon="compare_arrows" loading={running} onClick={runAnalysis} disabled={!cvOk || !jdOk} className="w-full">
                  {running ? 'Comparing…' : result ? 'Compare again' : 'Compare'}
                </Button>
                {(!cvOk || !jdOk) && !running && (
                  <p className="text-xs text-muted text-center -mt-2">
                    {!cvOk ? `Add your CV (${CV_MIN}+ characters)` : `Add the job post (${JD_MIN}+ characters)`}
                  </p>
                )}
              </Card>
            </div>

            {running && !result && (
              <Card>
                <div className="flex flex-col gap-4" aria-live="polite" aria-busy="true">
                  <div className="skeleton h-6 w-40 rounded-[6px]" />
                  <div className="skeleton h-2 w-full rounded-full" />
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton h-24 rounded-[10px]" />
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {!result && !running && (
              <Card padded={false}>
                <EmptyState icon="fact_check" title="No comparison yet" body="Add your CV and a job post above. You’ll see matched and missing skills, wording differences and suggested rewrites." />
              </Card>
            )}

            {result && (
              <motion.div
                key={pct + rewrites.length}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn('flex flex-col gap-6', running && 'opacity-60 pointer-events-none')}
              >
                <Card>
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div>
                      <p className="text-sm text-muted">Match</p>
                      <p className={cn('mt-1 text-5xl font-semibold tracking-tight tabular leading-none', tone.text)}>{pct}%</p>
                      <p className="mt-2 text-sm text-muted">{tone.label}. A rough guide based on skills and wording, not a hiring prediction.</p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <Button size="lg" icon="build" loading={building} onClick={buildCV}>
                        Build tailored CV
                      </Button>
                      <span className="text-xs text-muted tabular">
                        {accepted.size > 0 ? `${accepted.size} rewrite${accepted.size === 1 ? '' : 's'} will be applied` : 'Rewrites are optional'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 h-1.5 w-full rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Match">
                    <motion.div
                      className={cn('h-full rounded-full origin-left', tone.bar)}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </Card>

                <div className="grid md:grid-cols-3 gap-6">
                  <SkillList title="Already on your CV" icon="check_circle" tone="accent" items={result.matched_skills} empty="None of the job’s key skills were found." />
                  <SkillList title="Missing from your CV" icon="cancel" tone="danger" items={result.missing_skills} empty="Nothing obvious is missing." />
                  <SkillList
                    title="You may have these"
                    icon="help"
                    tone="warn"
                    items={result.probably_have}
                    empty="Nothing to flag."
                    note="Implied by your experience but not written. Add them if true."
                  />
                </div>

                {(result.keyword_mismatches.length > 0 || result.seniority_gaps.length > 0 || result.ats_warnings.length > 0) && (
                  <div className="grid lg:grid-cols-2 gap-6">
                    {result.keyword_mismatches.length > 0 && (
                      <Card>
                        <CardHeader title="Different wording" description="Use the job’s term if it describes the same thing." />
                        <ul className="divide-y divide-line">
                          {result.keyword_mismatches.map((k, i) => (
                            <li key={i} className="py-2.5 flex items-center gap-3 text-sm min-w-0">
                              <span className="text-muted truncate">{k.cv_term}</span>
                              <Icon name="arrow_forward" className="text-[16px] text-muted shrink-0" />
                              <span className="font-medium truncate">{k.jd_term}</span>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}
                    {(result.seniority_gaps.length > 0 || result.ats_warnings.length > 0) && (
                      <Card className="flex flex-col gap-5">
                        {result.seniority_gaps.length > 0 && (
                          <div>
                            <h2 className="text-[15px] font-semibold mb-3">Experience level</h2>
                            <Bullets items={result.seniority_gaps} icon="trending_up" tone="text-warn" />
                          </div>
                        )}
                        {result.ats_warnings.length > 0 && (
                          <div>
                            <h2 className="text-[15px] font-semibold mb-3">Formatting</h2>
                            <Bullets items={result.ats_warnings} icon="warning" tone="text-warn" />
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                )}

                <Card>
                  <CardHeader
                    title="Suggested rewrites"
                    description="Accept the ones that are true to your experience. You can build without any."
                    action={rewrites.length > 0 ? <span className="text-xs text-muted tabular">{reviewed} of {rewrites.length} reviewed</span> : undefined}
                  />
                  {rewrites.length === 0 ? (
                    <p className="text-sm text-muted">No rewrites suggested for this job.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      <AnimatePresence initial={false}>
                        {rewrites.map((r, i) => {
                          const isA = accepted.has(i)
                          const isS = skipped.has(i)
                          return (
                            <motion.li
                              key={i}
                              layout={!reduce}
                              className={cn(
                                'rounded-[12px] border p-4 flex flex-col gap-3 transition-colors',
                                isA ? 'border-accent/40 bg-accent/5' : isS ? 'border-line opacity-60' : 'border-line',
                              )}
                            >
                              <div className="grid md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-muted mb-1">Now</p>
                                  <p className="text-muted leading-relaxed break-words">{r.original}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted mb-1">Suggested</p>
                                  <p className="leading-relaxed break-words">{r.suggested}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                {(isA || isS) && <span className="mr-auto text-xs text-muted">{isA ? 'Will be applied' : 'Skipped'}</span>}
                                <Button size="sm" variant={isS ? 'secondary' : 'ghost'} onClick={() => s.skipRewrite(i)} disabled={isS}>
                                  Skip
                                </Button>
                                <Button size="sm" variant={isA ? 'primary' : 'secondary'} icon={isA ? 'check' : undefined} onClick={() => s.acceptRewrite(i)} disabled={isA}>
                                  {isA ? 'Accepted' : 'Accept'}
                                </Button>
                              </div>
                            </motion.li>
                          )
                        })}
                      </AnimatePresence>
                    </ul>
                  )}
                </Card>
              </motion.div>
            )}
          </>
        ) : hasBuilt ? (
          <>
            <Alert tone="accent" title="Tailored CV">
              Built from your CV{accepted.size ? ` with ${accepted.size} accepted rewrite${accepted.size === 1 ? '' : 's'}` : ''}. Check every section before you send it.
            </Alert>
            <CVEditor key={buildKey} variant="match" contextLabel="Tailored" />
          </>
        ) : (
          <Card padded={false}>
            <EmptyState
              icon="description"
              title="Nothing built yet"
              body="Run a comparison first, then press Build tailored CV."
              action={
                <Button size="sm" onClick={() => s.setActiveCvTab('analysis')}>
                  Go to compare
                </Button>
              }
            />
          </Card>
        )}
      </PageContainer>
      <AIProgressPopup open={building} state={progress} title="Building your CV" />
    </>
  )
}

function SkillList({ title, icon, tone, items, empty, note }: { title: string; icon: string; tone: 'accent' | 'danger' | 'warn'; items: string[]; empty: string; note?: string }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-warn'
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon name={icon} fill className={cn('text-[18px]', color)} />
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="ml-auto text-xs text-muted tabular">{items.length}</span>
      </div>
      {note && items.length > 0 && <p className="text-xs text-muted">{note}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((x) => (
            <li key={x} className="h-7 px-2.5 inline-flex items-center rounded-full bg-line text-[13px] max-w-full">
              <span className="truncate">{x}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Bullets({ items, icon, tone }: { items: string[]; icon: string; tone: string }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((x, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted leading-relaxed">
          <Icon name={icon} className={cn('text-[16px] mt-0.5 shrink-0', tone)} />
          <span className="break-words">{x}</span>
        </li>
      ))}
    </ul>
  )
}
