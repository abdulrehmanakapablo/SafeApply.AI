// FILE: src/pages/public/About.tsx
// ROUTE: /about (public)

import { Link } from 'react-router-dom';
import SEO, { SITE_URL, SITE_NAME } from '../../components/SEO';
import Logo from '../../components/ui/Logo';

const FAQS = [
  {
    q: 'What is SafeApply.AI?',
    a: 'SafeApply.AI is a job search intelligence platform. It aggregates publicly available data about companies — news, engineering activity, hiring signals, and anonymous employee reviews — into a single cited report, so you can research a company before you apply instead of relying on a polished careers page.',
  },
  {
    q: 'Where does SafeApply.AI\'s data come from?',
    a: 'Every report is built from public sources: company news from the last 90 days, GitHub engineering activity, search results used for ghost-job detection, and a moderated database of anonymous reviews submitted by users. Each data point in a report links directly to its source. We do not scrape private or restricted data, and we never present opinion as fact.',
  },
  {
    q: 'Is SafeApply.AI free?',
    a: 'Yes. SafeApply.AI currently operates on a free model with no paywall. Paid plans may be introduced later for heavier usage, but company research, CV matching, application tracking, and review access are free today.',
  },
  {
    q: 'How is SafeApply.AI different from Glassdoor or LinkedIn?',
    a: 'Glassdoor shows reviews; LinkedIn shows people. SafeApply.AI shows evidence. Instead of one signal, each report cross-references news, engineering activity, and hiring patterns, and every claim carries a citation to its public source. The platform gives you raw cited data — never a verdict — so the decision stays yours.',
  },
  {
    q: 'Are anonymous reviews really anonymous?',
    a: 'Yes. Reviews are stored without any public reviewer identity — review listings never expose who wrote them. Reviews are moderated for authenticity, must be at least 100 characters, and are labeled by the reviewer\'s relationship to the company (current employee, former employee, applicant, or knows someone) so you can weigh them appropriately.',
  },
  {
    q: 'How does the CV matching work?',
    a: 'Paste a job description or upload your CV as a PDF/DOCX. SafeApply.AI extracts the skills, requirements, and keywords from the job description, compares them against your CV, and returns a match score, the specific skills you are missing, ATS formatting warnings, and AI-suggested rewrites for weak bullet points.',
  },
  {
    q: 'Does SafeApply.AI guarantee I\'ll get hired?',
    a: 'No — and be skeptical of any tool that claims to. SafeApply.AI gives you better information: whether a posting is real, what the company\'s last 90 days looked like, how your CV scores against the role, and what employees actually say. What you do with that information is up to you.',
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.svg`,
  description:
    'SafeApply.AI aggregates cited public data — news, GitHub activity, hiring signals, and anonymous reviews — so job seekers can research companies, match their CV to job descriptions, track applications, and decide for themselves.',
  sameAs: [],
};

export default function About() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SEO
        title="About SafeApply.AI — Cited Company Research for Job Seekers"
        description="SafeApply.AI aggregates news, GitHub activity, hiring signals, and anonymous employee reviews into cited company reports — with CV matching, application tracking, and zero opinions."
        path="/about"
        jsonLd={[ORG_JSONLD, FAQ_JSONLD]}
      />

      {/* Header — logo left, back to website right */}
      <header className="w-full max-w-[80rem] mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Logo className="h-8 w-auto" />
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1 text-[#737373] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to website
        </Link>
      </header>

      {/* Hero */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-[#22C55E]">
            About {SITE_NAME}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Job seekers deserve the same intelligence that companies have about them
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#737373]">
            Employers run background checks, reference calls, and assessment batteries on you.
            SafeApply.AI levels the field: a cited intelligence report on any company —
            news, engineering activity, hiring signals, and anonymous reviews — so you decide
            with evidence, not vibes.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Our mission</h2>
            <p className="mt-4 leading-relaxed text-[#737373]">
              Every year, millions of candidates apply to companies they have not researched —
              and waste weeks on ghost jobs, dying products, and cultures that would have been
              visible from a 90-day news search. We think the single highest-leverage skill in
              a job search is due diligence, and it should take minutes, not weekends.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Our method</h2>
            <p className="mt-4 leading-relaxed text-[#737373]">
              No scores. No verdicts. No "this company is a 7.4." Every SafeApply.AI report shows
              raw, cited data from public sources — with a link for every claim — because the
              candidate, not an algorithm, should be the one making the call.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold">How it works</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: 'description',
                title: 'Paste a job description',
                text: 'Drop in the JD and company name. We extract the skills, seniority signals, and requirements the posting is really asking for.',
              },
              {
                icon: 'travel_explore',
                title: 'Get a cited report',
                text: 'News from the last 90 days, GitHub engineering activity, ghost-posting signals, and aggregated anonymous reviews — each claim linked to its source.',
              },
              {
                icon: 'fact_check',
                title: 'Decide for yourself',
                text: 'We never stamp a verdict on a company. The report is evidence; the decision is yours. That is the whole point.',
              },
            ].map((s) => (
              <div key={s.title} className="rounded-[16px] border border-[#1A1A1A] bg-[#0D0D0D] p-6">
                <span className="material-symbols-outlined text-3xl text-[#22C55E]">{s.icon}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#737373]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold">Where the data comes from</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[#737373]">
            Every input is public, cited, and linkable. No scraped private data. No black boxes.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: 'newspaper', name: 'News', desc: 'The last 90 days of company news: funding, layoffs, leadership, lawsuits.' },
              { icon: 'code', name: 'GitHub', desc: 'Public engineering activity: commit recency, real tech stacks, open-source culture.' },
              { icon: 'search', name: 'Search signals', desc: 'Repost patterns and recruiter overlap used to detect ghost job postings.' },
              { icon: 'reviews', name: 'Anonymous reviews', desc: 'Moderated, relationship-labeled reviews from employees and applicants.' },
            ].map((s) => (
              <div key={s.name} className="rounded-[16px] border border-[#1A1A1A] bg-[#0D0D0D] p-5">
                <span className="material-symbols-outlined text-2xl text-[#22C55E]">{s.icon}</span>
                <h3 className="mt-3 font-semibold">{s.name}</h3>
                <p className="mt-1 text-sm text-[#737373]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beyond reports */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold">More than reports</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'CV Match', desc: 'Score your CV against any job description. See missing skills, ATS warnings, and AI rewrites of weak bullets.' },
              { title: 'CV Builder', desc: 'Build an ATS-approved CV with AI-generated summaries and export to PDF, DOCX, or TXT.' },
              { title: 'Application Tracker', desc: 'Kanban + list tracking with status timelines, communication logs, and honest analytics.' },
              { title: 'Anonymous Reviews', desc: 'Read and write relationship-labeled company reviews that never expose reviewer identity.' },
            ].map((f) => (
              <div key={f.title} className="rounded-[16px] border border-[#1A1A1A] bg-[#0D0D0D] p-5">
                <h3 className="font-semibold text-[#22C55E]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#737373]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-[#1A1A1A]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-center text-3xl font-semibold">Frequently asked questions</h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-[16px] border border-[#1A1A1A] bg-[#0D0D0D] px-5 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="material-symbols-outlined text-[#737373] transition-transform group-open:rotate-45">
                    add
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[#737373]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold">Research before you apply</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#737373]">
            Paste one job description and see what a cited company report looks like.
            Free, no credit card, no verdicts.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              to="/signup"
              className="rounded-lg bg-[#22C55E] px-6 py-3 font-medium text-black transition-colors hover:bg-[#16A34A]"
            >
              Get started free
            </Link>
            <Link
              to="/companies"
              className="rounded-lg border border-[#1A1A1A] px-6 py-3 font-medium text-white transition-colors hover:border-[#22C55E]"
            >
              Browse companies
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}