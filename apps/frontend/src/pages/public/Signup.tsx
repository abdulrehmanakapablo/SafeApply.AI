// FILE: src/pages/public/Signup.tsx
// ROUTE: /signup   (?redirect=/path returns there after first login,
//                   ?reason=demo_used explains why they landed here)
// BACKEND: POST /api/auth/signup → then signs in automatically.

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AuthShell from '../../components/layout/AuthShell'
import { Alert, Button, Field, Select } from '../../components/ui'
import { PasswordField, passwordOk } from '../../components/ui/PasswordField'
import { useAuthStore } from '../../store/authStore'
import { login as apiLogin, signup as apiSignup } from '../../api/auth'
import { apiError } from '../../lib/axios'
import { FREE_LIMIT } from '../../lib/plans'
import { ACCOUNT, ACCOUNT_TYPES, parseAccountType, type AccountType } from '../../lib/accountTypes'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COUNTRY_CODES = [
  ['+1', 'US / CA'],
  ['+44', 'UK'],
  ['+92', 'Pakistan'],
  ['+91', 'India'],
  ['+971', 'UAE'],
  ['+966', 'Saudi Arabia'],
  ['+49', 'Germany'],
  ['+33', 'France'],
  ['+61', 'Australia'],
  ['+86', 'China'],
  ['+81', 'Japan'],
  ['+82', 'South Korea'],
  ['+55', 'Brazil'],
  ['+52', 'Mexico'],
  ['+27', 'South Africa'],
  ['+234', 'Nigeria'],
  ['+20', 'Egypt'],
  ['+90', 'Türkiye'],
  ['+62', 'Indonesia'],
]

interface Form {
  first_name: string
  last_name: string
  email: string
  phone_code: string
  phone: string
  password: string
  confirm: string
  terms: boolean
}
type Errors = Partial<Record<keyof Form, string>>

const FREE_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'yandex.com', 'zoho.com'])

function safePath(raw: string | null): string | null {
  if (!raw) return null
  try {
    const d = decodeURIComponent(raw)
    return d.startsWith('/') && !d.startsWith('//') && !d.includes('\\') ? d : null
  } catch {
    return null
  }
}

export default function Signup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const redirect = safePath(params.get('redirect'))
  const reason = params.get('reason')
  const [role, setRole] = useState<AccountType>(parseAccountType(params.get('role')))
  const acct = ACCOUNT[role]
  const recruiter = role === 'recruiter'

  const [form, setForm] = useState<Form>({
    first_name: '',
    last_name: '',
    email: '',
    phone_code: '+1',
    phone: '',
    password: '',
    confirm: '',
    terms: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }))
  }

  function validate(): boolean {
    const e: Errors = {}
    const full = `${form.first_name.trim()} ${form.last_name.trim()}`.trim()
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim()) e.last_name = 'Required'
    else if (full.length < 4) e.last_name = 'Full name needs at least 4 characters'
    if (!form.email.trim()) e.email = 'Enter your email'
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'That doesn’t look like an email address'
    else if (recruiter && FREE_DOMAINS.has(form.email.trim().toLowerCase().split('@')[1])) e.email = 'Use your work email so we can verify your company'
    const digits = form.phone.replace(/\D/g, '')
    if (digits && (digits.length < 6 || digits.length + form.phone_code.length - 1 > 15)) e.phone = 'Check the number'
    if (!form.password) e.password = 'Choose a password'
    else if (!passwordOk(form.password)) e.password = 'Meet all four requirements below'
    if (!form.confirm) e.confirm = 'Type the password again'
    else if (form.confirm !== form.password) e.confirm = 'Passwords don’t match'
    if (!form.terms) e.terms = 'You need to accept the terms to continue'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setFormError('')
    const email = form.email.toLowerCase().trim()
    const digits = form.phone.replace(/\D/g, '')
    try {
      const res = await apiSignup({
        full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
        email,
        phone: digits ? `${form.phone_code}${digits}` : undefined,
        password: form.password,
        confirm_password: form.confirm,
        role,
      })
      if (!res.success) {
        setFormError(res.error || 'We couldn’t create the account. Please try again.')
        return
      }
      // Sign straight in so nobody has to type the password twice.
      try {
        const auth = await apiLogin({ email, password: form.password })
        if (auth.success && auth.data) {
          login(auth.data.user, auth.data.accessToken)
          navigate(redirect || acct.afterSignup, { replace: true })
          return
        }
      } catch {
        /* fall through to manual login */
      }
      navigate('/login', { replace: true })
    } catch (err) {
      setFormError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Create your account | SafeApply.AI"
        description="Create a free SafeApply.AI account. Company reports, CV matching and application tracking."
        path="/signup"
        noindex
      />
      <AuthShell
        title={acct.signupTitle}
        subtitle={acct.signupSub}
        variant={acct.variant}
        footer={
          <>
            Already have an account?{' '}
            <Link to={role === 'user' ? '/login' : `/login?role=${role}`} className="text-accent hover:underline font-medium">
              Log in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {reason === 'demo_used' && !formError && (
            <Alert tone="accent">{`You’ve used the free try. A free account gives you ${FREE_LIMIT} checks.`}</Alert>
          )}
          {formError && <Alert>{formError}</Alert>}

          <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-1 p-1 bg-ink border border-line rounded-[8px]">
            {ACCOUNT_TYPES.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                onClick={() => {
                  setRole(r)
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
                }}
                className={`h-9 rounded-[6px] text-sm font-medium transition-colors ${role === r ? 'bg-line text-fg' : 'text-muted hover:text-fg'}`}
              >
                {ACCOUNT[r].label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First name"
              autoComplete="given-name"
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              error={errors.first_name}
              required
              autoFocus
            />
            <Field
              label="Last name"
              autoComplete="family-name"
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              error={errors.last_name}
              required
            />
          </div>

          <Field
            label={recruiter ? 'Work email' : 'Email'}
            hint={recruiter ? 'Your company domain, e.g. you@yourcompany.com. We use it to verify the company.' : undefined}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={errors.email}
            required
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">
              Phone <span className="text-muted font-normal ml-1">Optional</span>
            </span>
            <div className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-2">
              <Select
                aria-label="Country code"
                value={form.phone_code}
                onChange={(e) => set('phone_code', e.target.value)}
                options={COUNTRY_CODES.map(([code, name]) => ({ value: code, label: `${code} ${name}` }))}
              />
              <Field
                aria-label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value.replace(/[^\d\s-]/g, ''))}
                error={errors.phone}
              />
            </div>
          </div>

          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            error={errors.password}
            showRules
          />
          <PasswordField
            label="Confirm password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
            error={errors.confirm}
          />

          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-3 cursor-pointer select-none text-sm text-muted leading-relaxed">
              <input
                type="checkbox"
                checked={form.terms}
                onChange={(e) => set('terms', e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-accent cursor-pointer"
                aria-invalid={errors.terms ? true : undefined}
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-2 hover:text-accent">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-2 hover:text-accent">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.terms && (
              <p role="alert" className="text-xs text-danger">
                {errors.terms}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
            {loading ? 'Creating your account' : 'Create account'}
          </Button>
        </form>
      </AuthShell>
    </>
  )
}
