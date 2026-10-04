// FILE: src/components/companies/CompanyShell.tsx
// PURPOSE: Shared frame for a company's public sub-pages: layout, SEO,
//          tabs, heading, loading and not-found states.

import type { ReactNode } from 'react'
import SEO from '../SEO'
import AdaptiveLayout from '../layout/AdaptiveLayout'
import CompanyTabs from './CompanyTabs'
import { LevelChip } from '../trust/TrustBits'
import { Alert, ButtonLink, Card, EmptyState, Icon, Skeleton } from '../ui'
import type { PublicCompany } from '../../api/growth'

export default function CompanyShell({
  slug,
  company,
  error,
  heading,
  intro,
  seoTitle,
  seoDescription,
  path,
  jsonLd,
  children,
}: {
  slug: string
  company: PublicCompany | null
  error: string
  heading: string
  intro: ReactNode
  seoTitle: string
  seoDescription: string
  path: string
  jsonLd?: object
  children?: ReactNode
}) {
  return (
    <AdaptiveLayout>
      <SEO title={seoTitle} description={seoDescription} path={path} jsonLd={jsonLd} noindex={!!error} />
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-20 flex flex-col gap-6">
        {error ? (
          <Card padded={false}>
            <EmptyState icon="domain_disabled" title="Company not found" body={error} action={<ButtonLink to="/companies">Browse companies</ButtonLink>} />
          </Card>
        ) : !company ? (
          <>
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 rounded-[16px]" />
            <Skeleton className="h-64 rounded-[16px]" />
          </>
        ) : (
          <>
            <header>
              <p className="text-sm text-muted flex flex-wrap items-center gap-2">
                <span>{company.name}</span>
                {company.verified && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Icon name="verified" className="text-[16px]" />
                    Verified employer
                  </span>
                )}
                {company.trust_level > 0 && <LevelChip level={company.trust_level} />}
              </p>
              <h1 className="mt-1 text-3xl sm:text-4xl font-semibold tracking-tight break-words">{heading}</h1>
              <p className="mt-2 text-muted max-w-[62ch] leading-relaxed">{intro}</p>
            </header>
            <CompanyTabs slug={slug} verified={company.verified} />
            {company.suspended && <Alert>This company is suspended from posting jobs.</Alert>}
            {children}
          </>
        )}
      </section>
    </AdaptiveLayout>
  )
}
