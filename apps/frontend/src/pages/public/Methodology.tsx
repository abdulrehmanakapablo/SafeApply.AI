// FILE: src/pages/public/Methodology.tsx
// ROUTE: /methodology
// PURPOSE: Exactly how every public number is calculated. Keeps the
//          scores honest and defensible.

import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'
import { Reveal } from '../../components/motion/Reveal'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Where the numbers come from',
    body: [
      'Only from things that happened on SafeApply: applications sent through the jobs board, recruiters opening an applicant, stage changes, messages, interviews and hires. Nothing is self-reported by the company, and nothing is copied from other websites.',
      'Numbers refresh every hour.',
    ],
  },
  {
    title: 'CVs opened',
    body: ['The share of applicants whose application page a recruiter at the company opened at least once. The applicant sees the date it was first opened, like a read receipt.', 'Shown once a company has at least 5 applications.'],
  },
  {
    title: 'Replied within 7 days',
    body: [
      'The share of applicants who got any response within 7 days of applying: a stage change (including Not selected), a message, or an interview invitation.',
      'Only applications at least 7 days old are counted, so new applications never drag the number down. Shown once there are at least 5 such applications.',
    ],
  },
  {
    title: 'Never answered',
    body: ['An application with no response at all after 21 days is marked unanswered, and the applicant is told. This is the share of applications older than 7 days that ended up unanswered.'],
  },
  {
    title: 'Ghost jobs',
    body: [
      'A job is flagged as a ghost job when at least 3 people applied and no CV was opened, once the job is closed or 14 days old.',
      'Ghost jobs count against a company for 90 days. 2 ghost jobs limit the company to one open job. 4 ghost jobs add a public warning. Opening applicants brings the count back down automatically. Suspension is only ever decided by a person.',
    ],
  },
  {
    title: 'Closing a job',
    body: ['Companies can’t quietly delete a job. Closing it requires an outcome (hired here, hired elsewhere, not hired, or cancelled), and everyone still waiting gets a final answer at that moment.'],
  },
  {
    title: 'Hires and interviews',
    body: ['A hire or interview counts only after both sides confirm it: the recruiter records it and the candidate confirms it happened. One side alone can’t inflate the number.'],
  },
  {
    title: 'Disagree with a number?',
    body: ['Companies can open a dispute. A person reviews the underlying events and corrects anything recorded wrongly.'],
  },
]

export default function Methodology() {
  return (
    <PublicLayout>
      <SEO title="How we calculate hiring records | SafeApply.AI" description="Exactly how SafeApply calculates CVs opened, reply rates, ghost jobs and verified hires." path="/methodology" />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
        <Reveal>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.05]">How we calculate hiring records</h1>
          <p className="mt-5 text-lg text-muted leading-relaxed">Every public number on SafeApply follows these rules. They apply to every company on every plan.</p>
        </Reveal>
        <div className="mt-12 flex flex-col divide-y divide-line border-y border-line">
          {SECTIONS.map((s) => (
            <Reveal as="section" key={s.title} className="py-7">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-2 text-muted leading-relaxed">
                  {p}
                </p>
              ))}
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Questions?{' '}
          <Link to="/disputes" className="underline underline-offset-4 hover:text-fg">
            Open a dispute
          </Link>{' '}
          or read a company’s record from its company page.
        </p>
      </article>
    </PublicLayout>
  )
}
