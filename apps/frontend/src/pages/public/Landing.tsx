// FILE: src/pages/public/Landing.tsx
// ROUTE: /
// PURPOSE: Marketing page.
//   • <ScrollStory>: scroll-driven opening (confused → bulb → laptop →
//     types safeapply.ai → click → camera pushes into the screen → hero).
//   • <LadderRail>: then the same man climbs down a ladder on the right as
//     you scroll the rest of the page (all sizes; data-bubble attrs).
//   • #demo: anonymous JD extraction (backend caps 8,000 chars and 1 try
//     per IP per day in production; localStorage flag is a UX shortcut).
//   • No invented reviews, ratings or user counts.

import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import ScrollStory from '../../components/landing/ScrollStory'
import LadderRail from '../../components/landing/LadderRail'
import { Arrived, StoryScene } from '../../components/landing/Character'
import { Reveal } from '../../components/motion/Reveal'
import PlanCards from '../../components/PlanCards'
import LiveFigures from '../../components/landing/LiveFigures'
import { FREE_LIMIT } from '../../lib/plans'
import { Alert, Badge, Button, ButtonLink, Icon, cn } from '../../components/ui'
import { demoExtract, type ExtractedJD } from '../../api/reports'
import { apiError } from '../../lib/axios'

const DEMO_MAX = 8000
const DEMO_WARN = 6000
const DEMO_MIN = 50
const DEMO_USED_KEY = 'safeapply_demo_jd_used'

function readDemoUsed(): boolean {
  try {
    return localStorage.getItem(DEMO_USED_KEY) === '1'
  } catch {
    return false
  }
}
function writeDemoUsed() {
  try {
    localStorage.setItem(DEMO_USED_KEY, '1')
  } catch {
    /* ignore */
  }
}

const STEPS = [
  {
    icon: 'content_paste',
    title: 'Paste the job post',
    body: 'Drop in the full description, or just the company name and role. We pull out the role, level, location, pay and the skills it actually asks for.',
  },
  {
    icon: 'travel_explore',
    title: 'We check public sources',
    body: 'Recent news coverage, the company’s public code activity, and every place the same role has been posted before.',
  },
  {
    icon: 'fact_check',
    title: 'You decide, with links',
    body: 'No score, no verdict. Each finding links to where it came from, so you can judge it yourself in a minute.',
  },
]

export default function Landing() {
  const reduce = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <SEO
        title="SafeApply.AI | Check the company before you apply"
        description="News, engineering activity and repeat job postings for any employer in one report, with every source linked. Match your CV to the job and track every application."
        path="/"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'SafeApply.AI',
          url: 'https://safeapply.ai/',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://safeapply.ai/companies?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }}
      />

      <LadderRail targetRef={contentRef} />

      <PublicLayout transparentNav>
        <ScrollStory />
        {/* Right padding keeps text clear of the ladder until the page margin is wide enough. */}
        <div ref={contentRef} className="pr-10 sm:pr-16 2xl:pr-0">
          {/* ── Hero ───────────────────────────────────── */}
          <section data-bubble="Is this job even real?" className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-48 right-[-10%] w-[720px] h-[720px] rounded-full opacity-[0.07]"
              style={{ background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }}
            />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-16 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-6 items-center">
              <div className="max-w-xl">
                <motion.h1
                  className="text-[40px] sm:text-5xl lg:text-[58px] font-semibold tracking-[-0.035em] leading-[1.04]"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                >
                  Check the company before you send the <span className="text-accent">CV.</span>
                </motion.h1>
                <motion.p
                  className="mt-5 text-[17px] text-muted leading-relaxed max-w-[46ch]"
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
                >
                  News, engineering activity and repeat job postings for any employer, in one report. Every claim links to its source.
                </motion.p>
                <motion.div
                  className="mt-8 flex flex-wrap items-center gap-3"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                >
                  <ButtonLink to="/signup" size="lg" iconRight="arrow_forward">
                    Start free
                  </ButtonLink>
                  <ButtonLink to="/#demo" size="lg" variant="secondary">
                    Try a job post
                  </ButtonLink>
                  <ButtonLink to="/recruiters" size="lg" variant="ghost" icon="badge">
                    For recruiters
                  </ButtonLink>
                </motion.div>
              </div>

              <motion.div
                className="relative"
                initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              >
                <StoryScene phase="calm" person={false} viewBox="400 230 400 250" className="w-full h-auto" />
              </motion.div>
            </div>
          </section>

          {/* ── The problem ────────────────────────────── */}
          <section data-bubble="Hmm. That happened to me." className="border-t border-line">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
              <Reveal>
                <p className="text-[26px] sm:text-[34px] lg:text-[40px] font-medium tracking-[-0.025em] leading-[1.2] max-w-[30ch]">
                  A posting can stay up long after the role is filled.{' '}
                  <span className="text-muted">
                    The stack in the ad might not be the one they use. Most people find out three interviews in.
                  </span>
                </p>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-8 text-[17px] text-muted leading-relaxed max-w-[56ch]">
                  SafeApply reads the public record first, so your time goes to companies that are actually hiring for the job they describe.
                </p>
              </Reveal>
              <LiveFigures />
            </div>
          </section>

          {/* ── How it works ───────────────────────────── */}
          <section id="how" data-bubble="Paste. Check. Decide." className="border-t border-line scroll-mt-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-20">
              <div className="lg:sticky lg:top-28 self-start">
                <Reveal>
                  <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">How it works</h2>
                  <p className="mt-4 text-muted leading-relaxed max-w-[38ch]">
                    About thirty seconds from pasting a job post to a report you can act on.
                  </p>
                </Reveal>
              </div>
              <ol className="flex flex-col">
                {STEPS.map((s, i) => (
                  <Reveal as="li" key={s.title} delay={i * 0.06} className="relative flex gap-5 pb-12 last:pb-0">
                    {i < STEPS.length - 1 && <span aria-hidden className="absolute left-5 top-12 bottom-0 w-px bg-line" />}
                    <span className="relative w-10 h-10 rounded-[10px] bg-surface border border-line flex items-center justify-center text-accent shrink-0">
                      <Icon name={s.icon} className="text-[20px]" />
                    </span>
                    <div className="pt-1.5">
                      <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                      <p className="mt-2 text-muted leading-relaxed max-w-[52ch]">{s.body}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </section>

          {/* ── What's in a report (bento) ─────────────── */}
          <section data-bubble="Posted again. And again?" className="border-t border-line">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
              <Reveal>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight max-w-[20ch]">
                  What a report shows you
                </h2>
              </Reveal>
              <div className="mt-12 grid gap-4 md:grid-cols-3 md:grid-rows-2">
                <Reveal className="md:col-span-2 md:row-span-1">
                  <BentoCell
                    icon="event_repeat"
                    title="Repeat postings"
                    body="Every place the same role has appeared, with dates. The same opening reposted for months is worth asking about."
                    visual={<RepostVisual />}
                    tint
                  />
                </Reveal>
                <Reveal delay={0.06} className="md:row-span-2">
                  <BentoCell
                    icon="code"
                    title="Engineering activity"
                    body="Public repositories, recent commits and the languages they actually write, next to the ones the ad lists."
                    visual={<StackVisual />}
                    tall
                  />
                </Reveal>
                <Reveal delay={0.1}>
                  <BentoCell
                    icon="newspaper"
                    title="Recent news"
                    body="Coverage from the last thirty days. Funding, layoffs, launches."
                    visual={<NewsVisual />}
                  />
                </Reveal>
                <Reveal delay={0.14}>
                  <BentoCell
                    icon="checklist"
                    title="The job, decoded"
                    body="Role, level, pay and required skills pulled out of the posting text."
                    visual={<ChipsVisual />}
                  />
                </Reveal>
              </div>
            </div>
          </section>

          {/* ── Live demo ──────────────────────────────── */}
          <section id="demo" data-bubble="Let’s try one." className="border-t border-line scroll-mt-16 bg-surface/40">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
              <Reveal>
                <Badge tone="accent">No account needed</Badge>
                <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">Paste a job post</h2>
                <p className="mt-3 text-muted leading-relaxed max-w-[52ch]">
                  We’ll pull out what the role really asks for. One free try per visitor, then it’s on your account.
                </p>
              </Reveal>
              <Reveal delay={0.06} className="mt-10">
                <DemoExtractor />
              </Reveal>
            </div>
          </section>

          {/* ── CV + tracker ───────────────────────────── */}
          <section data-bubble="Now the CV fits." className="border-t border-line">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              <Reveal>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight max-w-[18ch]">
                  Then make the CV fit the job
                </h2>
                <p className="mt-4 text-muted leading-relaxed max-w-[48ch]">
                  Once a company checks out, compare your CV against the posting, accept the rewrites you agree with, and export a clean version.
                </p>
              </Reveal>
              <ul className="flex flex-col gap-3">
                {[
                  { icon: 'compare_arrows', title: 'CV match', body: 'Skills you have, skills you’re missing, and wording the screening software looks for.' },
                  { icon: 'edit_document', title: 'CV builder', body: 'Import your existing CV or start blank. Export to PDF, Word or plain text.' },
                  { icon: 'view_kanban', title: 'Application tracker', body: 'Every application on one board, with a timeline of calls, emails and interviews.' },
                ].map((f, i) => (
                  <Reveal as="li" key={f.title} delay={i * 0.06}>
                    <div className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-muted/40 transition-colors">
                      <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Icon name={f.icon} className="text-[20px]" />
                      </span>
                      <div>
                        <p className="font-semibold">{f.title}</p>
                        <p className="text-sm text-muted mt-1 leading-relaxed">{f.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* ── Pricing ────────────────────────────────── */}
          <section id="pricing" data-bubble="Free to start." className="border-t border-line scroll-mt-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
              <Reveal>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">Start free. Pay only if it earns it.</h2>
                <p className="mt-4 text-muted leading-relaxed max-w-[52ch]">
                  One check without an account. {FREE_LIMIT} of each after you sign up. Writing reviews is always unlimited.
                </p>
              </Reveal>
              <Reveal delay={0.06} className="mt-10">
                <PlanCards />
              </Reveal>
            </div>
          </section>

          {/* ── Final CTA ──────────────────────────────── */}
          <section data-bubble="" className="border-t border-line relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[-420px] w-[900px] h-[600px] rounded-full opacity-[0.08]"
              style={{ background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }}
            />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 grid md:grid-cols-[1fr_auto] gap-10 items-end">
              <Reveal>
                <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05] max-w-[16ch]">
                  Apply to the ones worth it.
                </h2>
                <p className="mt-4 text-muted leading-relaxed max-w-[42ch]">
                  Create an account, run your first report, and see what the posting didn’t tell you.
                </p>
                <div className="mt-8">
                  <ButtonLink to="/signup" size="lg" iconRight="arrow_forward">
                    Start free
                  </ButtonLink>
                </div>
              </Reveal>
              <Reveal delay={0.1} className="hidden md:block">
                <Arrived className="w-44 h-auto" />
              </Reveal>
            </div>
          </section>
        </div>
      </PublicLayout>
    </>
  )
}

// ─── Bento cell ──────────────────────────────────────────
function BentoCell({
  icon,
  title,
  body,
  visual,
  tint,
  tall,
}: {
  icon: string
  title: string
  body: string
  visual?: ReactNode
  tint?: boolean
  tall?: boolean
}) {
  void tall
  return (
    <article
      className={cn(
        'relative h-full rounded-[var(--radius-card)] border border-line overflow-hidden p-6 flex flex-col',
        tint ? 'bg-[radial-gradient(120%_120%_at_100%_0%,color-mix(in_srgb,var(--c-accent)_10%,transparent),transparent_55%),var(--c-surface)]' : 'bg-surface',
      )}
    >
      <Icon name={icon} className="text-[22px] text-accent" />
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-[44ch]">{body}</p>
      {visual && <div className="mt-6 flex-1 flex items-end">{visual}</div>}
    </article>
  )
}

// Abstract illustration: the same role appearing again and again.
function RepostVisual() {
  const reduce = useReducedMotion()
  return (
    <div className="relative w-full h-16" aria-hidden>
      <div className="absolute left-0 right-0 top-1/2 h-px bg-line" />
      {[6, 22, 41, 58, 79, 94].map((left, i) => (
        <motion.span
          key={left}
          className={cn('absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2', i === 5 ? 'border-warn bg-warn/20' : 'border-muted bg-ink')}
          style={{ left: `${left}%` }}
          initial={reduce ? false : { scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.09, type: 'spring', stiffness: 400, damping: 18 }}
        />
      ))}
    </div>
  )
}

// Abstract illustration: a short stack of headlines.
function NewsVisual() {
  return (
    <div className="w-full flex flex-col gap-3" aria-hidden>
      {[92, 74, 58].map((w, i) => (
        <div key={w} className="flex items-center gap-3">
          <span className={cn('w-8 h-8 rounded-[6px] shrink-0', i === 0 ? 'bg-accent/15' : 'bg-line')} />
          <div className="flex-1 flex flex-col gap-1.5">
            <span className="h-1.5 rounded-full bg-fg/70" style={{ width: `${w}%` }} />
            <span className="h-1.5 rounded-full bg-line" style={{ width: `${w - 30}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Abstract illustration: requirements turned into tags.
function ChipsVisual() {
  return (
    <div className="w-full flex flex-wrap gap-1.5" aria-hidden>
      {[56, 72, 44, 64, 50, 38].map((w, i) => (
        <span key={i} className={cn('h-6 rounded-full', i < 3 ? 'bg-accent/15' : 'bg-line')} style={{ width: w }} />
      ))}
    </div>
  )
}

// Abstract illustration: listed stack vs. what the code shows.
function StackVisual() {
  const reduce = useReducedMotion()
  const rows = [
    { w: 86, on: true },
    { w: 64, on: true },
    { w: 48, on: false },
    { w: 72, on: true },
    { w: 34, on: false },
  ]
  return (
    <div className="w-full flex flex-col gap-2.5" aria-hidden>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={cn('w-4 h-4 rounded-full flex items-center justify-center shrink-0', r.on ? 'bg-accent/15' : 'bg-line')}>
            <span className={cn('w-1.5 h-1.5 rounded-full', r.on ? 'bg-accent' : 'bg-muted')} />
          </span>
          <motion.span
            className={cn('h-2 rounded-full origin-left', r.on ? 'bg-fg/80' : 'bg-line')}
            style={{ width: `${r.w}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Demo extractor ──────────────────────────────────────
function DemoExtractor() {
  const navigate = useNavigate()
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractedJD | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [used, setUsed] = useState<boolean>(readDemoUsed)

  const len = jd.length
  const over = len > DEMO_MAX
  const near = len > DEMO_WARN && !over
  const short = jd.trim().length < DEMO_MIN
  const can = !loading && !used && !over && !short

  async function run() {
    if (!can) return
    setLoading(true)
    setError(null)
    try {
      const res = await demoExtract(jd.trim())
      const data = res.data?.extracted_jd
      if (!res.success || !data) {
        setError(res.error || 'We couldn’t read that posting. Try again in a moment.')
        return
      }
      setResult(data)
      writeDemoUsed()
      setUsed(true)
    } catch (err) {
      const msg = apiError(err)
      if (/free extraction|DEMO_EXHAUSTED/i.test(msg) || (err as { response?: { status?: number } })?.response?.status === 429) {
        writeDemoUsed()
        setUsed(true)
        navigate('/signup?reason=demo_used')
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-stretch">
      <div className="rounded-[var(--radius-card)] border border-line bg-ink p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label htmlFor="demo-jd" className="text-[13px] font-medium">
            Job description
          </label>
          <span className={cn('text-xs tabular', over ? 'text-danger' : near ? 'text-warn' : 'text-muted')}>
            {len.toLocaleString()} / {DEMO_MAX.toLocaleString()}
          </span>
        </div>
        <textarea
          id="demo-jd"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          disabled={used || loading}
          rows={11}
          placeholder="Paste the full job post here. Title, responsibilities, requirements, location, pay if listed."
          className="w-full flex-1 min-h-[220px] bg-surface border border-line rounded-[var(--radius-input)] p-3 text-sm leading-relaxed placeholder:text-muted/80 focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-60"
        />
        {error && <Alert>{error}</Alert>}
        {used ? (
          <Button onClick={() => navigate('/signup?reason=demo_used')} icon="person_add" className="w-full">
            Create a free account to keep going
          </Button>
        ) : (
          <Button onClick={run} disabled={!can} loading={loading} icon="bolt" className="w-full">
            {loading ? 'Reading the post…' : over ? `Shorten to ${DEMO_MAX.toLocaleString()} characters` : short ? `Paste at least ${DEMO_MIN} characters` : 'Extract'}
          </Button>
        )}
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-ink p-5 min-h-[320px] flex flex-col" aria-live="polite">
        <p className="text-[13px] font-medium">What it’s really asking for</p>
        {loading ? (
          <div className="mt-6 flex flex-col gap-4" aria-busy="true">
            <div className="skeleton h-5 w-3/5 rounded-[6px]" />
            <div className="grid grid-cols-2 gap-3">
              <div className="skeleton h-10 rounded-[6px]" />
              <div className="skeleton h-10 rounded-[6px]" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[64, 80, 52, 72, 60].map((w, i) => (
                <div key={i} className="skeleton h-7 rounded-full" style={{ width: w }} />
              ))}
            </div>
          </div>
        ) : result ? (
          <DemoResult jd={result} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Icon name="data_object" className="text-[28px] text-muted" />
            <p className="mt-3 text-sm text-muted max-w-[32ch]">Role, level, location, pay and skills will show up here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function DemoResult({ jd }: { jd: ExtractedJD }) {
  const reduce = useReducedMotion()
  const rows: Array<[string, string]> = [
    ['Location', [jd.location, jd.remote ? 'Remote' : null].filter(Boolean).join(' · ') || 'Not stated'],
    ['Pay', jd.salary_text || 'Not stated'],
    ['Experience', jd.experience_years ? `${jd.experience_years}+ years` : 'Not stated'],
    ['Type', jd.employment_type || 'Not stated'],
  ]
  return (
    <motion.div
      className="mt-5 flex flex-col gap-6"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xl font-semibold tracking-tight break-words">{jd.role || 'Role not stated'}</p>
        {jd.seniority && <Badge className="capitalize">{jd.seniority}</Badge>}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="text-sm mt-1 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {jd.required_skills.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">Required</p>
          <div className="flex flex-wrap gap-1.5">
            {jd.required_skills.map((s) => (
              <Badge key={s} tone="accent">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {jd.nice_to_have_skills.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">Nice to have</p>
          <div className="flex flex-wrap gap-1.5">
            {jd.nice_to_have_skills.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-muted">
        A full report adds news, engineering activity and repeat postings.{' '}
        <Link to="/signup" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </motion.div>
  )
}
