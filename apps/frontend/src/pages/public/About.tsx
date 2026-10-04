// FILE: src/pages/public/About.tsx
// ROUTE: /about

import SEO, { SITE_URL, SITE_NAME } from '../../components/SEO'
import PublicLayout, { CONTACT_EMAIL } from '../../components/layout/PublicLayout'
import { Reveal } from '../../components/motion/Reveal'
import { ButtonLink, Icon } from '../../components/ui'

const SOURCES = [
  { icon: 'newspaper', name: 'News', desc: 'Coverage from the last 30 days: funding, layoffs, leadership changes, launches.' },
  { icon: 'code', name: 'Public code', desc: 'Repository activity, commit recency and the languages a team actually writes.' },
  { icon: 'event_repeat', name: 'Job search results', desc: 'Where and when the same role has been posted, so reposting patterns are visible.' },
  { icon: 'reviews', name: 'Member reviews', desc: 'Moderated reviews labelled by the writer’s relationship to the company.' },
]

const FAQS = [
  {
    q: 'Where does the data come from?',
    a: 'Public sources only: news coverage from the last 30 days, public code repositories, and job search results. Reviews come from SafeApply members and are moderated before they appear. Every item in a report links to where it came from.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, to start. Without an account you can check one job post. A free account gets 3 company reports, 3 CV matches and 3 tracked applications, and writing reviews is unlimited. A paid complete setup is coming; tell us if you would pay for it.',
  },
  {
    q: 'Do you give companies a score?',
    a: 'No. A single number hides the reasons behind it. You see the findings and their sources, and you make the call.',
  },
  {
    q: 'Are reviews anonymous?',
    a: 'Yes. Reviewer identity is never shown publicly. Reviews need at least 100 characters and are labelled current employee, former employee, interviewed here, or knows someone there.',
  },
  {
    q: 'Can it guarantee I get hired?',
    a: 'No, and be wary of anything that claims to. It helps you spend your effort on the right companies and present your CV in the language each job uses.',
  },
]

export default function About() {
  return (
    <PublicLayout>
      <SEO
        title="About | SafeApply.AI"
        description="SafeApply.AI pulls public information about employers into one report with every source linked, plus CV matching and application tracking."
        path="/about"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/logo.svg`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]}
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16">
        <Reveal>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-[-0.03em] leading-[1.05] max-w-[18ch]">
            Employers check you. Now you can check them.
          </h1>
          <p className="mt-6 text-lg text-muted leading-relaxed max-w-[58ch]">
            Companies run background checks, call references and test candidates. Candidates mostly get a careers page. SafeApply puts the public record about an
            employer in one place, so you can decide where your time goes.
          </p>
        </Reveal>
      </section>

      <section className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 grid md:grid-cols-2 gap-10 md:gap-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">Why</h2>
            <p className="mt-4 text-muted leading-relaxed">
              People lose weeks to postings that were never going to hire, and to teams that changed direction months before the ad went up. Most of that was visible
              in public. It just took an afternoon to find. We think it should take a minute.
            </p>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="text-2xl font-semibold tracking-tight">How we work</h2>
            <p className="mt-4 text-muted leading-relaxed">
              No scores and no verdicts. We show what we found and link to where we found it. If a source is unavailable we say so instead of guessing.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Where the information comes from</h2>
          </Reveal>
          <div className="mt-10 grid sm:grid-cols-2 gap-px bg-line border border-line rounded-[var(--radius-card)] overflow-hidden">
            {SOURCES.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.04} className="bg-ink p-6 sm:p-8 flex gap-4">
                <Icon name={s.icon} className="text-[22px] text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="mt-1.5 text-sm text-muted leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Questions</h2>
            <p className="mt-3 text-muted">
              Something else?{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-fg underline underline-offset-4 hover:text-accent">
                {CONTACT_EMAIL}
              </a>
            </p>
          </Reveal>
          <dl className="flex flex-col divide-y divide-line">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.03} className="py-6 first:pt-0">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-2 text-muted leading-relaxed">{f.a}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-[22ch]">Run your first report in under a minute.</h2>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/signup" size="lg" iconRight="arrow_forward">
              Start free
            </ButtonLink>
            <ButtonLink to="/companies" size="lg" variant="secondary">
              Browse reviews
            </ButtonLink>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
