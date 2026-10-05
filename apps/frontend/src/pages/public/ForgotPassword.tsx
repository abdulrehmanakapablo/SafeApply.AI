// FILE: src/pages/public/ForgotPassword.tsx
// ROUTE: /forgot-password
// BACKEND: POST /api/auth/forgot-password (always answers the same way,
//          so we never reveal whether an email has an account).

import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../../components/SEO'
import AuthShell from '../../components/layout/AuthShell'
import { Alert, Button, Field, Icon } from '../../components/ui'
import { forgotPassword } from '../../api/auth'
import { apiError } from '../../lib/axios'
import { EMAIL_ENABLED } from '../../lib/features'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_AFTER = 30

export default function ForgotPassword() {
  return EMAIL_ENABLED ? <ResetForm /> : <EmailUnavailable />
}

/** Shown while email is switched off (VITE_EMAIL_ENABLED is not "true"). */
function EmailUnavailable() {
  return (
    <>
      <SEO title="Reset your password | SafeApply.AI" description="Password reset." path="/forgot-password" noindex />
      <AuthShell
        title="Password reset isn’t available yet"
        subtitle="Our email service isn’t active right now. We’re setting it up and it will take some time. Sorry for the inconvenience."
        footer={
          <Link to="/login" className="inline-flex items-center gap-1 text-accent hover:underline font-medium">
            <Icon name="arrow_back" className="text-[16px]" />
            Back to log in
          </Link>
        }
      >
        <Alert tone="warn" title="Reset links can’t be sent right now">
          If you remember your password, log in as usual. Your account and everything in it are safe.
        </Alert>
      </AuthShell>
    </>
  )
}

function ResetForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  async function send(target: string) {
    setLoading(true)
    setError('')
    try {
      const res = await forgotPassword(target)
      if (res.success) {
        setSent(true)
        setCooldown(RESEND_AFTER)
      } else setError(res.error || 'We couldn’t send the link. Please try again.')
    } catch (err) {
      setError(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = email.trim().toLowerCase()
    if (!t) return setError('Enter your email')
    if (!EMAIL_RE.test(t)) return setError('That doesn’t look like an email address')
    void send(t)
  }

  return (
    <>
      <SEO title="Reset your password | SafeApply.AI" description="Get a password reset link." path="/forgot-password" noindex />
      {sent ? (
        <AuthShell
          title="Check your inbox"
          subtitle={
            <>
              If an account exists for <span className="text-fg font-medium break-all">{email.trim().toLowerCase()}</span>, a reset link is on its way. It
              expires in 60 minutes.
            </>
          }
          footer={
            <Link to="/login" className="inline-flex items-center gap-1 text-accent hover:underline font-medium">
              <Icon name="arrow_back" className="text-[16px]" />
              Back to log in
            </Link>
          }
        >
          <div className="flex flex-col gap-3">
            {error && <Alert>{error}</Alert>}
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              loading={loading}
              disabled={cooldown > 0}
              onClick={() => send(email.trim().toLowerCase())}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the link'}
            </Button>
            <button type="button" onClick={() => setSent(false)} className="text-sm text-muted hover:text-fg transition-colors py-2">
              Use a different email
            </button>
            <p className="text-xs text-muted leading-relaxed">Nothing after a few minutes? Check spam or promotions.</p>
          </div>
        </AuthShell>
      ) : (
        <AuthShell
          title="Reset your password"
          subtitle="Enter the email you signed up with and we’ll send you a link."
          footer={
            <>
              Remembered it?{' '}
              <Link to="/login" className="text-accent hover:underline font-medium">
                Log in
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError('')
              }}
              error={error}
              autoFocus
            />
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Send reset link
            </Button>
          </form>
        </AuthShell>
      )}
    </>
  )
}
