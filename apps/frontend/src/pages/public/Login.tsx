// FILE: src/pages/public/Login.tsx
// ROUTE: /login   (accepts ?from=/path to return after sign-in)
// BACKEND: POST /api/auth/login

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AuthShell from '../../components/layout/AuthShell'
import { Alert, Button, Field } from '../../components/ui'
import { PasswordField } from '../../components/ui/PasswordField'
import { homeFor, portalBase, portalForAccount } from '../../lib/roles'
import { ACCOUNT, parseAccountType } from '../../lib/accountTypes'
import { useAuthStore } from '../../store/authStore'
import { login as apiLogin } from '../../api/auth'
import { apiError } from '../../lib/axios'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Only allow in-app paths so ?from= can't redirect off-site.
function safeFrom(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    return decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('\\') ? decoded : null
  } catch {
    return null
  }
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const setAdminPortal = useAuthStore((s) => s.setAdminPortal)

  const from = safeFrom(params.get('from') || (location.state as { from?: string } | null)?.from)
  const justReset = params.get('reset') === '1'
  const mode = parseAccountType(params.get('role'))
  const acct = ACCOUNT[mode]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Enter your email'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'That doesn’t look like an email address'
    if (!password) next.password = 'Enter your password'
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    setFormError('')
    try {
      const res = await apiLogin({ email: email.toLowerCase().trim(), password })
      if (res.success && res.data) {
        login(res.data.user, res.data.accessToken)
        const r = res.data.user.role
        // Admins are locked into the portal of the login page they used.
        const adminPortal = r === 'admin' ? portalForAccount(mode) : null
        setAdminPortal(adminPortal)
        navigate(from || (r === 'admin' ? portalBase(adminPortal!) : homeFor(r)), { replace: true })
      } else {
        setFormError(res.error || 'Email or password is incorrect.')
      }
    } catch (err) {
      setFormError(apiError(err, 'Email or password is incorrect.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO title="Log in | SafeApply.AI" description="Log in to SafeApply.AI." path="/login" noindex />
      <AuthShell
        title={acct.loginTitle}
        subtitle={acct.loginSub}
        variant={acct.variant}
        footer={
          <>
            New here?{' '}
            <Link to={mode !== 'user' ? `/signup?role=${mode}` : from ? `/signup?redirect=${encodeURIComponent(from)}` : '/signup'} className="text-accent hover:underline font-medium">
              Create a free account
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {justReset && !formError && <Alert tone="accent">Password updated. Log in with the new one.</Alert>}
          {formError && <Alert>{formError}</Alert>}
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
            }}
            error={errors.email}
            autoFocus
          />
          <PasswordField
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
            }}
            error={errors.password}
            labelAction={
              <Link to="/forgot-password" className="text-xs text-muted hover:text-fg transition-colors">
                Forgot password?
              </Link>
            }
          />
          <Button type="submit" size="lg" loading={loading} className="w-full mt-1">
            {loading ? 'Logging in' : 'Log in'}
          </Button>
        </form>
      </AuthShell>
    </>
  )
}
