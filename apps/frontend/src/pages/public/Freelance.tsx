// FILE: src/pages/public/Freelance.tsx
// ROUTE: /freelance
// PURPOSE: Freelance landing. <FreelanceStory> (two cliffs, six trust
//          planks, handshake, push into the badge), then the hero with the
//          role choice, how it works for each side, and the rules.
//          No invented counts, logos or testimonials.

import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import FreelanceStory from '../../components/landing/FreelanceStory'
import { Reveal } from '../../components/motion/Reveal'
import { ButtonLink, Icon } from '../../components/ui'
import { useAuthStore, useIsAuthed } from '../../store/authStore'

const EASE = [0.16, 1, 0.3, 1] as const
type Item = readonly [icon: string, title: string, body: string]

const CLIENT_STEPS: readonly Item[] = [
  ['edit_note', 'Post a project with a budget', 'Describe the work and set a range. Projects without a budget can’t be posted.'],
  ['send', 'Compare proposals', 'Each proposal comes with the freelancer’s finished contracts and client reviews.'],
  ['flag', 'Hire with milestones', 'Split the agreed price into milestones. They must add up exactly.'],
  ['check_circle', 'Approve as work lands', 'Approve each milestone, or send it back with what needs to change.'],
] as const

const FREELANCER_STEPS: readonly Item[] = [
  ['badge', 'Build your profile', 'Headline, skills, rate and portfolio. Your contact details stay private.'],
  ['travel_explore', 'Find projects with budgets', 'Every project shows what the client can pay. Stale projects drop off after 30 days.'],
  ['upload', 'Hand in each milestone', 'Send a note with what you delivered. The client is notified straight away.'],
  ['reviews', 'Review the client too', 'When the contract ends, both sides leave a review. Nobody can delete one.'],
] as const

const RULES: readonly Item[] = [
  ['payments', 'Budget on every project', 'A project can’t go live without a budget range.'],
  ['flag', 'Milestones add up', 'The milestones always total the agreed price, so nothing is left vague.'],
  ['block', 'No cancelling after hand-in', 'Once work is handed in, neither side can quietly cancel the contract.'],
  ['event_busy', 'No ghost projects', 'Projects leave the board after 30 days without activity.'],
  ['shield_person', 'Moderated', 'Projects asking for upfront fees or off-platform payment get closed.'],
] as const

export default function Freelance() {
  const reduce = useReducedMotion()
  const authed = useIsAuthed()
  const role = useAuthStore((s) => s.user?.role)
  const hire = role === 'client' || role === 'admin' ? { to: '/client', label: 'Open client portal' } : { to: '/signup?role=client', label: 'I want to hire' }
  const work = role === 'freelancer' || role === 'admin' ? { to: '/freelancer', label: 'Open freelancer portal' } : { to: '/signup?role=freelancer', label: 'I want to work' }
  const fade = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
    transition: { duration: 0.7, ease: EASE, delay },
  })

  return (
    <>
      <SEO
        title="Freelance | SafeApply.AI"
        description="Hire freelancers or find freelance work with budgets on every project, milestones agreed up front, and reviews both ways."
        path="/freelance"
      />
      <PublicLayout transparentNav>
        <FreelanceStory />

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[820px] h-[820px] rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(closest-side, var(--c-accent), transparent)' }} />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-16 lg:pb-24 text-center">
            <motion.p {...fade(0)} className="text-xs font-medium text-accent tracking-wide uppercase">
              SafeApply freelance
            </motion.p>
            <motion.h1 {...fade(0.05)} className="mt-3 text-[40px] sm:text-5xl lg:text-[60px] font-semibold tracking-[-0.035em] leading-[1.04]">
              Meet in the middle. <span className="text-accent">Build on trust.</span>
            </motion.h1>
            <motion.p {...fade(0.12)} className="mt-5 text-[17px] text-muted leading-relaxed max-w-[52ch] mx-auto">
              Budgets on every project, milestones agreed before work starts, and reviews in both directions.
            </motion.p>
            <motion.div {...fade(0.2)} className="mt-9 grid sm:grid-cols-2 gap-3 max-w-xl mx-auto">
              <ButtonLink to={hire.to} size="lg" icon="handshake" className="w-full">
                {hire.label}
              </ButtonLink>
              <ButtonLink to={work.to} size="lg" variant="secondary" icon="laptop_mac" className="w-full">
                {work.label}
              </ButtonLink>
            </motion.div>
            <motion.p {...fade(0.26)} className="mt-4 text-sm text-muted">
              {authed ? (
                <Link to="/projects" className="underline underline-offset-4 hover:text-fg">
                  Browse open projects
                </Link>
              ) : (
                <>
                  Already have an account?{' '}
                  <Link to="/login?role=client" className="underline underline-offset-4 hover:text-fg">
                    Client login
                  </Link>{' '}
                  ·{' '}
                  <Link to="/login?role=freelancer" className="underline underline-offset-4 hover:text-fg">
                    Freelancer login
                  </Link>
                </>
              )}
            </motion.p>
          </div>
        </section>

        {/* Two sides */}
        <section className="border-t border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <Reveal className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.1]">Both sides of the bridge</h2>
              <p className="mt-4 text-muted leading-relaxed">The same contract, seen from each end. Every step is visible to both of you.</p>
            </Reveal>
            <div className="mt-10 grid lg:grid-cols-2 gap-6">
              {(
                [
                  ['For clients', CLIENT_STEPS],
                  ['For freelancers', FREELANCER_STEPS],
                ] as const
              ).map(([title, steps], col) => (
                <Reveal key={title} delay={col * 0.06} className="bg-surface border border-line rounded-[16px] p-6 sm:p-8">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <ol className="mt-6 flex flex-col gap-6">
                    {steps.map(([icon, t, body], i) => (
                      <li key={t} className="grid grid-cols-[auto_1fr] gap-4">
                        <span className="w-10 h-10 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center">
                          <Icon name={icon} className="text-[20px]" />
                        </span>
                        <div>
                          <p className="font-medium flex items-baseline gap-2">
                            <span className="text-xs text-muted tabular">0{i + 1}</span>
                            {t}
                          </p>
                          <p className="mt-1 text-sm text-muted leading-relaxed">{body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Rules */}
        <section className="border-t border-line bg-surface/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.1] max-w-[22ch]">The planks that hold the bridge</h2>
            </Reveal>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {RULES.map(([icon, t, body], i) => (
                <Reveal key={t} delay={i * 0.05} className={`bg-surface border border-line rounded-[16px] p-6 ${i < 2 ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
                  <Icon name={icon} className="text-[22px] text-accent" />
                  <h3 className="mt-4 text-[17px] font-semibold">{t}</h3>
                  <p className="mt-1.5 text-sm text-muted leading-relaxed">{body}</p>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8 flex gap-3 items-start text-sm text-muted max-w-3xl">
              <Icon name="info" className="text-[18px] shrink-0 mt-0.5" />
              <p>Payments don’t run through SafeApply yet. Contract amounts are a shared record of what you agreed, and payment is arranged between you.</p>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line">
          <Reveal className="max-w-3xl mx-auto px-4 sm:px-6 py-20 lg:py-28 text-center">
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.05]">
              Which side are <span className="text-accent">you on?</span>
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink to={hire.to} size="lg" icon="handshake">
                {hire.label}
              </ButtonLink>
              <ButtonLink to={work.to} size="lg" variant="secondary" icon="laptop_mac">
                {work.label}
              </ButtonLink>
            </div>
          </Reveal>
        </section>
      </PublicLayout>
    </>
  )
}
