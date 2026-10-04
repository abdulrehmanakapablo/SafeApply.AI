// FILE: src/components/recruiter/VerificationBanner.tsx
// PURPOSE: Tells the recruiter exactly where verification stands.

import { Alert, ButtonLink } from '../ui'
import type { Company } from '../../api/recruiter'

export default function VerificationBanner({ company }: { company: Company | null }) {
  if (!company) {
    return (
      <Alert tone="accent" title="Set up your company">
        Add your company and website. We verify it before your jobs go live.{' '}
        <ButtonLink to="/recruiter/company" size="sm" className="ml-1 align-middle">
          Set up company
        </ButtonLink>
      </Alert>
    )
  }
  if (company.verification_status === 'pending') {
    return (
      <Alert tone="warn" title="Verification in progress">
        We’re checking {company.name}. This usually takes a day. You can draft jobs now; they go live once you’re verified.
      </Alert>
    )
  }
  if (company.verification_status === 'rejected') {
    return (
      <Alert title="Verification was declined">
        {company.verification_note || 'Check your company name and website, then save again to resubmit.'}
      </Alert>
    )
  }
  return null
}
