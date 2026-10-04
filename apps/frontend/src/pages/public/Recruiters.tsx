// FILE: src/pages/public/Recruiters.tsx
// ROUTE: /recruiters
// PURPOSE: Recruiter landing. <RecruiterStory> (tired recruiter → idea →
//          laptop → safeapply.ai → "For recruiters" → push into screen),
//          then the hero and the rules recruiters agree to. No invented
//          customer logos, counts or testimonials.

import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import RecruiterStory from '../../components/landing/RecruiterStory'
import { Reveal } from '../../components/motion/Reveal'
import { ButtonLink, Icon } from '../../components/ui'
import { useAuthStore, useIsAuthed } from '../../store/authStore'
import { STAGE_LABEL, STAGE_ORDER } from '../../api/recruiter'

const EASE = [0.16, 1, 0.3, 1] as const

const STEPS = [
  { icon: 'domain_verification', title: 'Verify your company', body: 'Sign up with your work email and add your company website. We check the domain and approve the company. Drafts are open while you wait.' },
  { icon: 'payments', title: 'Post with a salary range', body: 'Every job shows pay. Candidates apply with the CV they already keep on SafeApply, plus a short note.' },
  { icon: 'view_kanban', title: 'Move people through stages', body: 'Each move updates the candidate’s own tracker and sends them a notification. No more silent rejections.' },
  { icon: 'forum', title: 'Talk in one place', body: 'Message each applicant from their profile. Your first reply counts toward your public response rate.' },
]

const RULES = [
  { icon: 'payments', title: 'Salary on every job', body: 'A job without a pay range cannot be published.' },
  { icon: 'schedule', title: 'Response rate is public', body: 'Shown on your company page: the share of applicants who heard back within 14 days.' },
  { icon: 'event_busy', title: 'No ghost jobs', body: 'Jobs leave the board after 60 days without activity from your team.' },
  { icon: 'verified', title: 'Verified companies only', body: 'Only approved companies can publish, move applicants or reply to reviews.' },
  { icon: 'rate_review', title: 'Reply, never remove', body: 'You can post one public reply to each review. Reviews stay, and reviewers stay anonymous.' },
]

export default function Recruiters() {
  const reduce = useReducedMotion()
  const authed = useIsAuthed()
  const role = useAuthStore((s) => s.user?.role)
  const portal = authed && (role === 'recruiter' || role === 'admin')
  const cta = portal ? { to: '/recruiter', label: 'Open recruiter portal' } : { to: '/signup?role=recruiter', label: 'Start hiring' }
  const login = !authed && (
    <ButtonLink to="/login?role=recruiter" size="lg" variant="secondary">
      Recruiter login
    </ButtonLink>
  )
  const fade = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.7, ease: EASE, delay },
  })

  return (
    <>
      <SEO
        title="For recruiters | SafeApply.AI"
        description="Hire on SafeApply. Verified companies, salary on every job, a public response rate and a pipeline that keeps candidates informed."
        path="/recruiters"
      />
      <PublicLayout transparentNav>
        <RecruiterStory />

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-48 left-[-12%] w-[720px] h-[720px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-16 lg:pb-24 grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-10 items-center">
            <div className="max-w-xl">
              <motion.p {...fade(0)} className="text-xs font-medium text-accent tracking-wide uppercase">
                SafeApply for recruiters
              </motion.p>
              <motion.h1 {...fade(0.05)} className="mt-3 text-[40px] sm:text-5xl lg:text-[56px] font-semibold tracking-[-0.035em] leading-[1.04]">
                Hire from people who can <span className="text-accent">trust you.</span>
              </motion.h1>
              <motion.p {...fade(0.12)} className="mt-5 text-[17px] text-muted leading-relaxed max-w-[46ch]">
                Candidates on SafeApply check companies before they apply. Show them a verified company, a real salary and a team that replies.
              </motion.p>
              <motion.div {...fade(0.2)} className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink to={cta.to} size="lg" iconRight="arrow_forward">
                  {cta.label}
                </ButtonLink>
                {login || (
                  <ButtonLink to="/jobs" size="lg" variant="secondary">
                    See the jobs board
                  </ButtonLink>
                )}
              </motion.div>
              <motion.p {...fade(0.26)} className="mt-4 text-xs text-muted">
                Free during early access. A work email is required.
              </motion.p>
            </div>

            {/* Pipeline sketch: structure only, no invented candidates */}
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: EASE }}
              aria-hidden
              className="relative bg-surface border border-line rounded-[16px] p-4 sm:p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-sm font-semibold">Your job</span>
                </div>
                <span className="text-[11px] text-accent bg-accent/10 rounded-full px-2.5 py-1">Salary shown</span>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {STAGE_ORDER.slice(0, 4).map((s, col) => (
                  <div key={s} className="flex flex-col gap-2">
                    <span className="text-[11px] text-muted truncate">{STAGE_LABEL[s]}</span>
                    {Array.from({ length: 3 - Math.min(col, 2) }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, ease: EASE, delay: 0.2 + col * 0.08 + i * 0.05 }}
                        className="bg-ink border border-line rounded-[10px] p-2.5 flex flex-col gap-1.5"
                      >
                        <span className="h-2 w-4/5 rounded-full bg-line" />
                        <span className="h-1.5 w-1/2 rounded-full bg-line/70" />
                        {col === 0 && i === 0 && <span className="h-1.5 w-1/3 rounded-full bg-accent/60" />}
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted border-t border-line pt-3">
                <Icon name="notifications_active" className="text-[16px] text-accent" />
                Every move reaches the candidate’s tracker.
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
            <Reveal className="lg:sticky lg:top-24 self-start">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.1]">How hiring works here</h2>
              <p className="mt-4 text-muted leading-relaxed max-w-[42ch]">Four steps. Candidates see the same pipeline from their side, so nobody waits in the dark.</p>
            </Reveal>
            <ol className="flex flex-col divide-y divide-line border-y border-line">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 0.05} className="py-6 grid grid-cols-[auto_1fr] gap-5">
                  <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center">
                    <Icon name={s.icon} className="text-[20px]" />
                  </span>
                  <div>
                    <h3 className="text-[17px] font-semibold flex items-baseline gap-3">
                      <span className="text-xs text-muted tabular">0{i + 1}</span>
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted leading-relaxed max-w-[56ch]">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Rules */}
        <section className="border-t border-line bg-surface/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.1] max-w-[20ch]">The rules every company plays by</h2>
              <p className="mt-4 text-muted leading-relaxed max-w-[56ch]">They are what makes candidates willing to apply. They apply to everyone, on every plan.</p>
            </Reveal>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {RULES.map((r, i) => (
                <Reveal key={r.title} delay={i * 0.05} className={`bg-surface border border-line rounded-[16px] p-6 ${i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                  <Icon name={r.icon} className="text-[22px] text-accent" />
                  <h3 className="mt-4 text-[17px] font-semibold">{r.title}</h3>
                  <p className="mt-1.5 text-sm text-muted leading-relaxed">{r.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line">
          <Reveal className="max-w-3xl mx-auto px-4 sm:px-6 py-20 lg:py-28 text-center">
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.05]">
              Put the coffee down. <span className="text-accent">Start hiring.</span>
            </h2>
            <p className="mt-5 text-muted leading-relaxed">Create a recruiter account with your work email. We verify the company, then your jobs go live.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink to={cta.to} size="lg" iconRight="arrow_forward">
                {cta.label}
              </ButtonLink>
              {login}
            </div>
          </Reveal>
        </section>
      </PublicLayout>
    </>
  )
}
