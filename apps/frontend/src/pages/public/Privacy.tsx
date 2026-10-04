// FILE: src/pages/public/Privacy.tsx
// ROUTE: /privacy (public)
// PURPOSE: Privacy Policy — data we collect, how we use it, user rights.

import { Link } from 'react-router-dom'
import SEO, { SITE_URL, SITE_NAME } from '../../components/SEO'
import PublicLayout from '../../components/layout/PublicLayout'

const LAST_UPDATED = 'January 2025'
const CONTACT_EMAIL = 'privacy@safeapply.ai'

const SECTIONS = [
  { id: 'intro', title: '1. Introduction' },
  { id: 'collect', title: '2. Information We Collect' },
  { id: 'use', title: '3. How We Use Information' },
  { id: 'share', title: '4. How We Share Information' },
  { id: 'cookies', title: '5. Cookies and Tracking' },
  { id: 'retention', title: '6. Data Retention' },
  { id: 'security', title: '7. Data Security' },
  { id: 'rights', title: '8. Your Rights and Choices' },
  { id: 'children', title: '9. Children\u2019s Privacy' },
  { id: 'transfers', title: '10. International Data Transfers' },
  { id: 'third-parties', title: '11. Third-Party Services' },
  { id: 'changes', title: '12. Changes to This Policy' },
  { id: 'contact', title: '13. Contact Us' },
]

export default function Privacy() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Privacy Policy | ${SITE_NAME}`,
    url: `${SITE_URL}/privacy`,
    description: `The Privacy Policy governing collection and use of personal information by ${SITE_NAME}.`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }

  return (
    <PublicLayout>
      <SEO
        title={`Privacy Policy | ${SITE_NAME}`}
        description={`How ${SITE_NAME} collects, uses, stores, and protects your personal information. Your rights and choices.`}
        path="/privacy"
        jsonLd={jsonLd}
      />


      <section className="border-b border-line">
        <div className="mx-auto max-w-4xl px-6 py-16">
                    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-muted">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-12 lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
        <aside className="mb-10 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <h2 className="mb-4 text-sm text-muted">
              On this page
            </h2>
            <nav aria-label="Table of contents" className="space-y-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-muted transition-colors hover:text-accent"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="max-w-3xl space-y-12">
          {/* 1 */}
          <section id="intro" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">1. Introduction</h2>
            <p className="text-base leading-relaxed text-muted">
              {SITE_NAME} (&ldquo;
              <strong className="text-fg">SafeApply</strong>,&rdquo; &ldquo;
              <strong className="text-fg">we</strong>,&rdquo; &ldquo;
              <strong className="text-fg">us</strong>,&rdquo; or &ldquo;
              <strong className="text-fg">our</strong>&rdquo;) respects your privacy. This
              Privacy Policy explains what information we collect, how we use it, with whom we
              share it, and the choices and rights available to you. It applies to the SafeApply.AI
              website, applications, and services (collectively, the &ldquo;
              <strong className="text-fg">Service</strong>&rdquo;). It should be read together
              with our{' '}
              <Link to="/terms" className="text-accent hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </section>

          {/* 2 */}
          <section id="collect" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">2. Information We Collect</h2>
            <p className="text-base leading-relaxed text-muted">
              We collect the following categories of information:
            </p>

            <h3 className="mt-6 mb-2 text-lg font-semibold text-fg">
              2.1 Information you provide directly
            </h3>
            <ul className="list-disc space-y-2 pl-6 text-muted">
              <li>Account information: name, email address, phone number, and password;</li>
              <li>Profile information: job title, location, and any avatar you upload;</li>
              <li>Content you submit: CV text, job descriptions, application tracking data, notes, and reviews;</li>
              <li>Communications: messages you send to us.</li>
            </ul>

            <h3 className="mt-6 mb-2 text-lg font-semibold text-fg">
              2.2 Information collected automatically
            </h3>
            <ul className="list-disc space-y-2 pl-6 text-muted">
              <li>Log data: IP address, browser type, operating system, referring URLs, pages viewed, and timestamps;</li>
              <li>Device data: device type, screen size, and general location derived from IP address;</li>
              <li>Usage data: features used, actions taken within the Service, and session duration.</li>
            </ul>

            <h3 className="mt-6 mb-2 text-lg font-semibold text-fg">
              2.3 Information from third parties
            </h3>
            <ul className="list-disc space-y-2 pl-6 text-muted">
              <li>Authentication providers: if you sign in using a third-party provider, we receive the information you authorize that provider to share (typically name and email);</li>
              <li>Public sources: publicly available data about companies, which is aggregated for display and is not personal information about you.</li>
            </ul>
          </section>

          {/* 3 */}
          <section id="use" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">3. How We Use Information</h2>
            <p className="text-base leading-relaxed text-muted">
              We use the information we collect for the following purposes:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted">
              <li>To provide, operate, maintain, and improve the Service;</li>
              <li>To create and manage your account and authenticate you;</li>
              <li>To process and display content you submit, including reviews and application data;</li>
              <li>To generate AI-assisted features such as CV analysis and bullet rewrites;</li>
              <li>To communicate with you about the Service, including service updates and responses to your inquiries;</li>
              <li>To detect, prevent, and address fraud, abuse, security incidents, and violations of our Terms;</li>
              <li>To comply with legal obligations and enforce our rights; and</li>
              <li>To analyze usage patterns and improve user experience.</li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-muted">
              We process your information on the following legal bases (where applicable): your
              consent, performance of a contract with you, our legitimate interests in operating
              and improving the Service, and compliance with legal obligations.
            </p>
          </section>

          {/* 4 */}
          <section id="share" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">4. How We Share Information</h2>
            <p className="text-base leading-relaxed text-muted">
              <strong className="text-fg">We do not sell your personal information.</strong> We
              share information only in the following circumstances:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted">
              <li>
                <strong className="text-fg">Service providers.</strong> Trusted third-party
                vendors who help us operate the Service (hosting, authentication, database,
                analytics, email delivery, AI model providers). These providers are contractually
                bound to use information only to provide services to us.
              </li>
              <li>
                <strong className="text-fg">Aggregated/anonymous content.</strong> Reviews you
                submit are displayed publicly in anonymized form. Reviewer identity is never shown
                to other users or the public. Aggregate statistics may be shared with the public.
              </li>
              <li>
                <strong className="text-fg">Legal requirements.</strong> We may disclose
                information if required by law, subpoena, court order, or governmental request, or
                if we believe in good faith that disclosure is necessary to protect the rights,
                property, or safety of SafeApply, our users, or the public.
              </li>
              <li>
                <strong className="text-fg">Business transfers.</strong> If SafeApply is
                involved in a merger, acquisition, financing, or sale of assets, your information
                may be transferred as part of that transaction. We will notify you of any such
                change and any choices you may have.
              </li>
              <li>
                <strong className="text-fg">With your consent.</strong> We may share information
                for other purposes when you give us explicit consent.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section id="cookies" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">5. Cookies and Tracking</h2>
            <p className="text-base leading-relaxed text-muted">
              We use cookies and similar technologies to keep you signed in, remember your
              preferences, and understand how the Service is used. We use:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted">
              <li>
                <strong className="text-fg">Strictly necessary cookies</strong> — required for
                authentication and security (e.g., session and refresh tokens). The Service cannot
                function without these.
              </li>
              <li>
                <strong className="text-fg">Preference cookies</strong> — store choices such as
                theme or locale.
              </li>
              <li>
                <strong className="text-fg">Analytics cookies</strong> — help us understand
                usage patterns. These may be set by third-party providers such as error monitoring
                and product analytics services.
              </li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-muted">
              You can control cookies through your browser settings. Disabling strictly necessary
              cookies may prevent you from using parts of the Service.
            </p>
          </section>

          {/* 6 */}
          <section id="retention" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">6. Data Retention</h2>
            <p className="text-base leading-relaxed text-muted">
              We retain personal information for as long as necessary to fulfill the purposes
              described in this Policy, unless a longer retention period is required or permitted
              by law. When you delete your account, we delete or anonymize your personal
              information, except where we are required to retain it for legal, tax, security, or
              fraud-prevention purposes. Aggregated or anonymized data may be retained
              indefinitely.
            </p>
          </section>

          {/* 7 */}
          <section id="security" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">7. Data Security</h2>
            <p className="text-base leading-relaxed text-muted">
              We implement reasonable administrative, technical, and physical safeguards designed
              to protect your information, including encryption of data in transit, hashed storage
              of passwords, and access controls on our infrastructure. However, no method of
              transmission over the internet or method of electronic storage is completely secure.
              We cannot guarantee absolute security and disclaim liability for unauthorized access
              that is beyond our reasonable control.
            </p>
          </section>

          {/* 8 */}
          <section id="rights" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">8. Your Rights and Choices</h2>
            <p className="text-base leading-relaxed text-muted">
              Depending on your location, you may have some or all of the following rights with
              respect to your personal information:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6 text-muted">
              <li>
                <strong className="text-fg">Access</strong> — request a copy of the personal
                information we hold about you;
              </li>
              <li>
                <strong className="text-fg">Correction</strong> — request correction of
                inaccurate or incomplete information;
              </li>
              <li>
                <strong className="text-fg">Deletion</strong> — request deletion of your
                personal information, subject to legal exceptions;
              </li>
              <li>
                <strong className="text-fg">Restriction</strong> — request that we restrict
                processing of your information in certain circumstances;
              </li>
              <li>
                <strong className="text-fg">Portability</strong> — request a machine-readable
                copy of the information you provided to us;
              </li>
              <li>
                <strong className="text-fg">Objection</strong> — object to processing based on
                our legitimate interests; and
              </li>
              <li>
                <strong className="text-fg">Withdrawal of consent</strong> — withdraw consent at
                any time where processing is based on consent.
              </li>
            </ul>
            <p className="mt-4 text-base leading-relaxed text-muted">
              To exercise any of these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond within the time period required by applicable law. You may also
              have the right to lodge a complaint with your local data protection authority.
            </p>
          </section>

          {/* 9 */}
          <section id="children" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">9. Children&rsquo;s Privacy</h2>
            <p className="text-base leading-relaxed text-muted">
              The Service is not directed to children under the age of sixteen (16), and we do not
              knowingly collect personal information from children under this age. If we learn
              that we have collected personal information from a child under the applicable age, we
              will take reasonable steps to delete it. If you believe a child has provided us with
              personal information, please contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          {/* 10 */}
          <section id="transfers" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              10. International Data Transfers
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Your information may be stored and processed in countries other than your country of
              residence, including the United States and other jurisdictions where our service
              providers operate. Where required by applicable law, we implement appropriate
              safeguards (such as standard contractual clauses) to protect personal information
              transferred across borders.
            </p>
          </section>

          {/* 11 */}
          <section id="third-parties" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">11. Third-Party Services</h2>
            <p className="text-base leading-relaxed text-muted">
              The Service relies on third-party providers for hosting, authentication, database
              services, error monitoring, payment processing (if and when introduced), and AI
              model inference. We also link to publicly available sources such as news sites and
              code hosting platforms. These third parties have their own privacy policies, and we
              are not responsible for their practices. We encourage you to review their policies.
            </p>
          </section>

          {/* 12 */}
          <section id="changes" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">12. Changes to This Policy</h2>
            <p className="text-base leading-relaxed text-muted">
              We may update this Privacy Policy from time to time. When we make material changes,
              we will update the &ldquo;Last updated&rdquo; date above and, where appropriate,
              provide additional notice (such as an in-app notification or email). Your continued
              use of the Service after any changes take effect constitutes acceptance of the
              revised Policy.
            </p>
          </section>

          {/* 13 */}
          <section id="contact" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">13. Contact Us</h2>
            <p className="text-base leading-relaxed text-muted">
              Questions or concerns about this Privacy Policy may be sent to:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>

          <div className="mt-16 border-t border-line pt-8 text-sm text-muted">
            <Link to="/terms" className="text-accent hover:underline">
              Read our Terms of Service →
            </Link>
          </div>
        </article>
      </div>
    </PublicLayout>
  )
}