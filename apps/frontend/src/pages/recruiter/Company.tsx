// FILE: src/pages/recruiter/Company.tsx
// ROUTE: /recruiter/company
// PURPOSE: Create/claim the company, edit the public profile, see
//          verification status. Name + website lock once verified.

import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import VerificationBanner from '../../components/recruiter/VerificationBanner'
import { useCompany } from './useCompany'
import { saveMyCompany, type CompanyInput } from '../../api/recruiter'
import { useAuthStore } from '../../store/authStore'
import { Alert, Badge, Button, Card, CardHeader, Field, PageContainer, PageHeader, Select, Skeleton, TextArea } from '../../components/ui'
import { apiError } from '../../lib/axios'

const SIZES = ['', '1-10', '11-50', '51-200', '201-1000', '1000+']
const EMPTY: CompanyInput = { name: '', website: '', industry: '', size: '', locations: '', about: '' }
const URL_RE = /^https?:\/\/[^\s/.]+\.[^\s]+$/i

export default function RecruiterCompany() {
  const email = useAuthStore((s) => s.user?.email || '')
  const { company, setCompany, loading, error } = useCompany()
  const [form, setForm] = useState<CompanyInput>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyInput, string>>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (company)
      setForm({
        name: company.name,
        website: company.website || '',
        industry: company.industry || '',
        size: company.size || '',
        locations: company.locations || '',
        about: company.about || '',
      })
  }, [company])

  const verified = company?.verification_status === 'verified'
  const canEdit = !company || company.member_role === 'owner'
  const set = <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !canEdit) return
    const next: typeof errors = {}
    if (form.name.trim().length < 2) next.name = 'Company name is required'
    const site = form.website.trim()
    if (!URL_RE.test(site)) next.website = 'Enter the full website, e.g. https://acme.com'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const res = await saveMyCompany({ ...form, name: form.name.trim(), website: site })
      if (res.success) {
        setCompany(res.data)
        toast.success(company ? 'Company saved' : 'Submitted for verification')
      }
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save the company.'))
    } finally {
      setBusy(false)
    }
  }

  const emailDomain = email.split('@')[1] || ''

  return (
    <>
      <SEO title="Company profile | SafeApply.AI" description="Your company on SafeApply." path="/recruiter/company" noindex />
      <PageContainer narrow>
        <PageHeader title="Company profile" description="This is what candidates see next to your jobs." />
        {error && <Alert>{error}</Alert>}
        {!loading && company && <VerificationBanner company={company} />}

        {loading ? (
          <Card className="flex flex-col gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
          </Card>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <Card>
              <CardHeader
                title="Identity"
                description={verified ? 'Locked after verification. Email us to change these.' : 'We verify these. Use the official name and website.'}
                action={company && <Badge tone={verified ? 'accent' : company.verification_status === 'rejected' ? 'danger' : 'warn'}>{company.verification_status}</Badge>}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Company name" required value={form.name} onChange={(e) => set('name', e.target.value)} disabled={verified || !canEdit} maxLength={120} error={errors.name} autoComplete="organization" />
                <Field
                  label="Website"
                  required
                  type="url"
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                  disabled={verified || !canEdit}
                  placeholder="https://"
                  maxLength={200}
                  error={errors.website}
                  hint={!verified && emailDomain ? `Fastest approval when it matches your email domain (${emailDomain}).` : undefined}
                />
              </div>
            </Card>

            <Card>
              <CardHeader title="Public profile" />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Industry" optional value={form.industry} onChange={(e) => set('industry', e.target.value)} maxLength={80} placeholder="e.g. Healthcare, Retail" disabled={!canEdit} />
                <Select
                  label="Company size"
                  optional
                  value={form.size}
                  onChange={(e) => set('size', e.target.value)}
                  options={SIZES.map((s) => ({ value: s, label: s ? `${s} people` : 'Not specified' }))}
                  disabled={!canEdit}
                />
                <Field label="Locations" optional value={form.locations} onChange={(e) => set('locations', e.target.value)} maxLength={200} placeholder="e.g. Lahore, Remote" wrapClassName="sm:col-span-2" disabled={!canEdit} />
              </div>
              <TextArea
                label="About"
                optional
                rows={6}
                value={form.about}
                onChange={(e) => set('about', e.target.value.slice(0, 3000))}
                hint={`${form.about.length} / 3,000. What you do, how you work, what a hiring process looks like.`}
                wrapClassName="mt-4"
                disabled={!canEdit}
              />
            </Card>

            {canEdit ? (
              <Button type="submit" size="lg" loading={busy} className="self-end">
                {company ? (verified ? 'Save profile' : 'Save and resubmit') : 'Submit for verification'}
              </Button>
            ) : (
              <p className="text-sm text-muted">Only the company owner can edit this profile.</p>
            )}
          </form>
        )}
      </PageContainer>
    </>
  )
}
