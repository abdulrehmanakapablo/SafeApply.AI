// FILE: src/pages/public/Terms.tsx
// ROUTE: /terms (public)
// PURPOSE: Terms of Service — legal protections for user content,
// aggregated data, AI output, indemnification, arbitration.

import { Link } from 'react-router-dom'
import SEO, { SITE_URL, SITE_NAME } from '../../components/SEO'
import Logo from '../../components/ui/Logo'

const LAST_UPDATED = 'January 2025'
const CONTACT_EMAIL = 'legal@safeapply.ai'

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance of These Terms' },
  { id: 'service', title: '2. Description of the Service' },
  { id: 'eligibility', title: '3. Eligibility and Accounts' },
  { id: 'acceptable-use', title: '4. Acceptable Use' },
  { id: 'user-content', title: '5. User-Generated Content and Reviews' },
  { id: 'aggregated-data', title: '6. Aggregated Third-Party Data' },
  { id: 'ai-output', title: '7. Artificial Intelligence Output' },
  { id: 'no-advice', title: '8. No Professional Advice' },
  { id: 'ip', title: '9. Intellectual Property' },
  { id: 'disclaimers', title: '10. Disclaimers of Warranties' },
  { id: 'liability', title: '11. Limitation of Liability' },
  { id: 'indemnification', title: '12. Indemnification' },
  { id: 'termination', title: '13. Suspension and Termination' },
  { id: 'disputes', title: '14. Dispute Resolution and Arbitration' },
  { id: 'changes', title: '15. Changes to These Terms' },
  { id: 'contact', title: '16. Contact Information' },
]

export default function Terms() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Terms of Service | ${SITE_NAME}`,
    url: `${SITE_URL}/terms`,
    description: `The Terms of Service governing use of ${SITE_NAME}.`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SEO
        title={`Terms of Service | ${SITE_NAME}`}
        description={`Terms of Service governing use of ${SITE_NAME}. Includes user content, aggregated data disclaimers, AI output limitations, and dispute resolution.`}
        path="/terms"
        jsonLd={jsonLd}
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
        <div className="mx-auto max-w-4xl px-6 py-16">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-[#22C55E]">
            Legal
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-4 text-sm text-[#737373]">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12 lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
        {/* Table of contents */}
        <aside className="mb-10 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#737373]">
              On this page
            </h2>
            <nav aria-label="Table of contents" className="space-y-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-[#737373] transition-colors hover:text-[#22C55E]"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <article className="max-w-3xl space-y-12">
          <section>
            <p className="text-base leading-relaxed text-[#737373]">
              These Terms of Service (the &ldquo;<strong className="text-white">Terms</strong>&rdquo;)
              constitute a legally binding agreement between you (&ldquo;
              <strong className="text-white">you</strong>&rdquo; or &ldquo;
              <strong className="text-white">User</strong>&rdquo;) and{' '}
              <strong className="text-white">{SITE_NAME}</strong> (&ldquo;
              <strong className="text-white">SafeApply</strong>, &ldquo;
              <strong className="text-white">we</strong>,&rdquo; &ldquo;
              <strong className="text-white">us</strong>,&rdquo; or &ldquo;
              <strong className="text-white">our</strong>&rdquo;), governing your access to and use
              of the SafeApply.AI website, applications, and services (collectively, the &ldquo;
              <strong className="text-white">Service</strong>&rdquo;).
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              By accessing or using the Service, you confirm that you have read, understood, and
              agreed to be bound by these Terms. <strong className="text-white">If you do not
              agree, you must not use the Service.</strong>
            </p>
          </section>

          {/* 1 */}
          <section id="acceptance" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">1. Acceptance of These Terms</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              Your use of the Service constitutes acceptance of these Terms and of our{' '}
              <Link to="/privacy" className="text-[#22C55E] hover:underline">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. If you are using the Service on
              behalf of an organization, you represent that you have authority to bind that
              organization to these Terms, and &ldquo;you&rdquo; refers to both you individually and
              that organization.
            </p>
          </section>

          {/* 2 */}
          <section id="service" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">2. Description of the Service</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              The Service is an information aggregation and productivity platform for job seekers.
              It collects, organizes, and displays:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-[#737373]">
              <li>Publicly available information about companies obtained from third-party sources;</li>
              <li>Anonymous, user-submitted reviews and ratings of companies;</li>
              <li>Output generated by third-party artificial intelligence models; and</li>
              <li>Tools for CV analysis, application tracking, and related workflow management.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              The Service is a neutral conduit and host for information. We do not create,
              author, verify, endorse, or guarantee the accuracy of any content aggregated from
              third-party sources or submitted by Users.
            </p>
          </section>

          {/* 3 */}
          <section id="eligibility" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              3. Eligibility and Accounts
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              You must be at least <strong className="text-white">sixteen (16) years of age</strong>{' '}
              to use the Service. By using the Service, you represent and warrant that you meet this
              requirement. If you are under the age of majority in your jurisdiction, you represent
              that you have obtained consent from a parent or legal guardian.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              You are responsible for (a) maintaining the confidentiality of your account
              credentials; (b) all activity that occurs under your account; and (c) providing
              accurate, current, and complete information. You agree to notify us immediately at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#22C55E] hover:underline">
                {CONTACT_EMAIL}
              </a>{' '}
              of any unauthorized use of your account.
            </p>
          </section>

          {/* 4 */}
          <section id="acceptable-use" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">4. Acceptable Use</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              You agree not to, and not to permit any third party to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-[#737373]">
              <li>Use the Service for any unlawful, infringing, or fraudulent purpose;</li>
              <li>Post content that is defamatory, harassing, discriminatory, obscene, or that violates the rights of any third party;</li>
              <li>Post content that contains confidential or proprietary information that you are not authorized to disclose;</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity;</li>
              <li>Scrape, crawl, index, or systematically extract data from the Service other than through publicly documented interfaces;</li>
              <li>Reverse engineer, decompile, disassemble, or attempt to derive source code from the Service;</li>
              <li>Interfere with, disrupt, or place undue load on the Service or its infrastructure;</li>
              <li>Bypass any rate limits, security measures, or access controls; or</li>
              <li>Use the Service to compete with the Service, or to build a substantially similar product.</li>
            </ul>
          </section>

          {/* 5 */}
          <section id="user-content" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              5. User-Generated Content and Reviews
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              The Service permits Users to submit reviews, ratings, comments, and other content
              (&ldquo;<strong className="text-white">User Content</strong>&rdquo;). You retain
              ownership of your User Content. However, by submitting User Content, you grant
              SafeApply a worldwide, non-exclusive, royalty-free, sublicensable, and transferable
              license to host, store, display, reproduce, modify for formatting purposes,
              distribute, and otherwise use your User Content in connection with operating,
              improving, and promoting the Service.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              You represent and warrant that:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-[#737373]">
              <li>You are the sole author of your User Content, or have all necessary rights to submit it;</li>
              <li>Your User Content is your genuine personal opinion and reflects your actual experience;</li>
              <li>Your User Content does not contain false statements of material fact, and where it contains statements of opinion, it clearly expresses opinion rather than fact;</li>
              <li>Your User Content does not infringe any copyright, trademark, trade secret, privacy right, or other right of any third party; and</li>
              <li>Your User Content complies with these Terms and all applicable laws.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              <strong className="text-white">
                SafeApply is a neutral host of User Content and is not the publisher or speaker of
                any User Content.
              </strong>{' '}
              User Content reflects the personal opinions and experiences of individual Users and
              does not reflect the views, opinions, or positions of SafeApply. SafeApply does not
              endorse, verify, or adopt any User Content as its own statement. To the maximum extent
              permitted by applicable law — including but not limited to Section 230 of the United
              States Communications Decency Act and analogous laws in other jurisdictions —
              SafeApply shall not be treated as the publisher or speaker of any User Content and
              shall not be liable for any User Content submitted by any User.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              We reserve the right, but have no obligation, to review, screen, moderate, refuse,
              remove, or edit any User Content at any time for any reason, including content we
              believe in good faith violates these Terms or applicable law.
            </p>
          </section>

          {/* 6 */}
          <section id="aggregated-data" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              6. Aggregated Third-Party Data
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              The Service aggregates and displays information obtained from publicly available
              third-party sources, including (without limitation) news publications, search
              engines, public code hosting platforms, and review platforms. This information
              (&ldquo;<strong className="text-white">Aggregated Data</strong>&rdquo;) is provided to
              you strictly on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis, solely for
              your informational convenience.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              You acknowledge and agree that:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-[#737373]">
              <li>SafeApply does not control, verify, or guarantee the accuracy, completeness, timeliness, or reliability of any Aggregated Data;</li>
              <li>Aggregated Data may contain errors, omissions, outdated information, or information that has since been corrected or retracted by its original source;</li>
              <li>SafeApply is not responsible for any decisions you make or actions you take based on Aggregated Data;</li>
              <li>Any third party referenced in Aggregated Data has no claim against SafeApply arising from the display of publicly available information; and</li>
              <li>Links and citations to third-party sources are provided for verification purposes only and do not constitute an endorsement of those sources.</li>
            </ul>
          </section>

          {/* 7 */}
          <section id="ai-output" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              7. Artificial Intelligence Output
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              Certain features of the Service use third-party artificial intelligence and machine
              learning models to generate summaries, extract information, suggest revisions, and
              analyze data (&ldquo;<strong className="text-white">AI Output</strong>&rdquo;). AI
              Output is probabilistic and may be inaccurate, incomplete, biased, or inappropriate
              for your specific situation.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              You acknowledge and agree that:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-[#737373]">
              <li>AI Output does not constitute professional, legal, financial, career, or employment advice;</li>
              <li>AI Output must be independently reviewed and verified by you before you rely on it;</li>
              <li>SafeApply makes no warranty regarding the accuracy, quality, or fitness for purpose of any AI Output; and</li>
              <li>SafeApply shall have no liability arising from any decision made or action taken in reliance on AI Output.</li>
            </ul>
          </section>

          {/* 8 */}
          <section id="no-advice" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">8. No Professional Advice</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              The Service is provided for informational and productivity purposes only. Nothing on
              the Service constitutes legal, financial, career, employment, or other professional
              advice. You should consult qualified professionals for advice tailored to your
              specific circumstances. Your use of the Service does not create any professional
              relationship between you and SafeApply.
            </p>
          </section>

          {/* 9 */}
          <section id="ip" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">9. Intellectual Property</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              The Service, including its design, code, text, graphics, logos, and trademarks (but
              excluding User Content and Aggregated Data), is owned by SafeApply or its licensors
              and is protected by copyright, trademark, and other laws. You are granted a limited,
              non-exclusive, non-transferable, revocable license to access and use the Service for
              its intended purpose in accordance with these Terms. All rights not expressly granted
              are reserved.
            </p>
          </section>

          {/* 10 */}
          <section id="disclaimers" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              10. Disclaimers of Warranties
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              <strong className="text-white">
                THE SERVICE AND ALL CONTENT, DATA, AI OUTPUT, AND MATERIALS MADE AVAILABLE THROUGH
                IT ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
                WARRANTIES OF ANY KIND.
              </strong>{' '}
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SAFEAPPLY DISCLAIMS ALL
              WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT
              LIMITATION THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, TITLE, AND NON-INFRINGEMENT. SAFEAPPLY DOES NOT WARRANT THAT THE SERVICE
              WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT
              ANY DEFECT WILL BE CORRECTED.
            </p>
          </section>

          {/* 11 */}
          <section id="liability" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              11. Limitation of Liability
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              <strong className="text-white">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SAFEAPPLY AND ITS OFFICERS,
                DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, AND LICENSORS SHALL NOT BE LIABLE FOR
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES,
                INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, REVENUE, DATA, GOODWILL,
                OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO YOUR USE OF OR INABILITY
                TO USE THE SERVICE.
              </strong>
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              <strong className="text-white">
                SAFEAPPLY&rsquo;S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE
                TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) ONE HUNDRED U.S. DOLLARS
                (USD $100) OR (B) THE TOTAL AMOUNT PAID BY YOU TO SAFEAPPLY IN THE TWELVE (12)
                MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
              </strong>
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              Some jurisdictions do not allow the exclusion or limitation of certain warranties or
              liabilities. In such jurisdictions, the above limitations apply only to the maximum
              extent permitted by law.
            </p>
          </section>

          {/* 12 */}
          <section id="indemnification" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">12. Indemnification</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              You agree to defend, indemnify, and hold harmless SafeApply and its officers,
              directors, employees, agents, affiliates, and licensors from and against any and all
              claims, actions, proceedings, demands, liabilities, damages, losses, costs, and
              expenses (including reasonable attorneys&rsquo; fees) arising out of or relating to:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-[#737373]">
              <li>Your access to or use of the Service;</li>
              <li>Any User Content you submit, including any claim that your User Content is defamatory, invasive of privacy, or infringes intellectual property rights;</li>
              <li>Your violation of these Terms or any applicable law; or</li>
              <li>Your violation of any rights of any third party.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              This indemnification obligation survives termination of these Terms and your use of
              the Service.
            </p>
          </section>

          {/* 13 */}
          <section id="termination" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              13. Suspension and Termination
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              We may, at our sole discretion and without notice, suspend or terminate your access
              to the Service, remove any User Content, or disable any feature if we believe you
              have violated these Terms, engaged in fraudulent or unlawful conduct, or for any
              other reason we deem appropriate. You may terminate your account at any time through
              the account settings or by contacting us. Sections 5 through 16 shall survive
              termination.
            </p>
          </section>

          {/* 14 */}
          <section id="disputes" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              14. Dispute Resolution and Arbitration
            </h2>
            <p className="text-base leading-relaxed text-[#737373]">
              <strong className="text-white">Informal resolution.</strong> Before filing any formal
              proceeding, you agree to contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#22C55E] hover:underline">
                {CONTACT_EMAIL}
              </a>{' '}
              and attempt to resolve the dispute informally for at least thirty (30) days.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              <strong className="text-white">Binding arbitration.</strong> Except as provided
              below, any dispute, claim, or controversy arising out of or relating to these Terms
              or the Service shall be resolved by final and binding arbitration on an individual
              basis, rather than in court. The arbitration shall be conducted in English by a
              single arbitrator in accordance with commercially reasonable arbitration rules. The
              arbitrator&rsquo;s decision shall be final and enforceable in any court of competent
              jurisdiction.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              <strong className="text-white">Class action waiver.</strong> You and SafeApply agree
              that each may bring claims against the other only in an individual capacity, and not
              as a plaintiff or class member in any purported class, collective, or representative
              proceeding. The arbitrator may not consolidate more than one person&rsquo;s claims.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#737373]">
              <strong className="text-white">Exceptions.</strong> Either party may seek injunctive
              or other equitable relief in any court of competent jurisdiction to protect its
              intellectual property or confidential information.
            </p>
          </section>

          {/* 15 */}
          <section id="changes" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">15. Changes to These Terms</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              We may modify these Terms from time to time. If we make material changes, we will
              update the &ldquo;Last updated&rdquo; date at the top of this page and, where
              appropriate, provide additional notice (such as an in-app notification or email).
              Your continued use of the Service after any changes take effect constitutes
              acceptance of the revised Terms. If you do not agree to the revised Terms, you must
              stop using the Service.
            </p>
          </section>

          {/* 16 */}
          <section id="contact" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">16. Contact Information</h2>
            <p className="text-base leading-relaxed text-[#737373]">
              Questions or notices regarding these Terms may be sent to:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#22C55E] hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <div className="mt-16 border-t border-[#1A1A1A] pt-8 text-sm text-[#737373]">
            <Link to="/privacy" className="text-[#22C55E] hover:underline">
              Read our Privacy Policy →
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}