// FILE: src/pages/dashboard/CVBuilder.tsx
// ROUTE: /dashboard/cv-builder
// PURPOSE: Standalone CV builder. Thin wrapper around CVEditor.

import SEO from '../../components/SEO'
import CVEditor from '../../components/cv/CVEditor'
import { ButtonLink, PageContainer, PageHeader } from '../../components/ui'

export default function CVBuilder() {
  return (
    <>
      <SEO title="CV builder | SafeApply.AI" description="Build and export your CV." path="/dashboard/cv-builder" noindex />
      <PageContainer>
        <PageHeader
          title="CV builder"
          description="Fill it in by hand or start from your current CV. Works for any profession."
          actions={
            <ButtonLink to="/dashboard/cv-match" variant="secondary" icon="compare_arrows">
              Match to a job
            </ButtonLink>
          }
        />
        <CVEditor variant="builder" showImport autoLoadFromBackend />
      </PageContainer>
    </>
  )
}
