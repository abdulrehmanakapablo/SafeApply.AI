// FILE: src/pages/public/ResetPassword.tsx
// ROUTE: /reset-password and /reset-password/:token
// BACKEND: POST /api/auth/reset-password
// Token is read from the path, the URL hash (Supabase default) or the query.

import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SEO from '../../components/SEO'
import AuthShell from '../../components/layout/AuthShell'
import { Alert, Button, ButtonLink } from '../../components/ui'
import { PasswordField, passwordOk } from '../../components/ui/PasswordField'
import { resetPassword } from '../../api/auth'
import { apiError } from '../../lib/axios'

function extractToken(pathToken?: string): string | null {
  if (pathToken) return pathToken
  if (typeof window === 'undefined') return null
  if (window.location.hash.length > 1) {
    const h = new URLSearchParams(window.location.hash.slice(1))
    const t = h.get('access_token') || h.get('token_hash')
    if (t) return t
  }
  const q = new URLSearchParams(window.location.search)
  return q.get('token') || q.get('token_hash') || q.get('code')
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const { token: pathToken } = useParams<{ token?: string }>()
  const token = useMemo(() => extractToken(pathToken), [pathToken])

  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ pw?: string; confirm?: string }>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!pw) next.pw = 'Choose a new password'
    else if (!passwordOk(pw)) next.pw = 'Meet all four requirements below'
    if (!confirm) next.confirm = 'Type it again'
    else if (confirm !== pw) next.confirm = 'Passwords don’t match'
    setErrors(next)
    if (Object.keys(next).length || !token) return

    setLoading(true)
    setFormError('')
    try {
      const res = await resetPassword(token, pw, confirm)
      if (res.success) navigate('/login?reset=1', { replace: true })
      else setFormError(res.error || 'This link has expired. Request a new one.')
    } catch (err) {
      setFormError(apiError(err, 'This link has expired. Request a new one.'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <>
        <SEO title="Link expired | SafeApply.AI" description="Request a new reset link." path="/reset-password" noindex />
        <AuthShell
          title="This link doesn’t work"
          subtitle="Reset links expire after an hour and can only be used once. Request a fresh one."
        >
          <div className="flex flex-col gap-3">
            <ButtonLink to="/forgot-password" size="lg" className="w-full">
              Send a new link
            </ButtonLink>
            <Link to="/login" className="text-sm text-muted hover:text-fg transition-colors text-center py-2">
              Back to log in
            </Link>
          </div>
        </AuthShell>
      </>
    )
  }

  return (
    <>
      <SEO title="Choose a new password | SafeApply.AI" description="Set a new password." path="/reset-password" noindex />
      <AuthShell title="Choose a new password" subtitle="You’ll be signed out everywhere else once it’s saved.">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {formError && (
            <Alert>
              {formError}{' '}
              <Link to="/forgot-password" className="text-fg underline underline-offset-2">
                Get a new link
              </Link>
            </Alert>
          )}
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value)
              if (errors.pw) setErrors((p) => ({ ...p, pw: undefined }))
            }}
            error={errors.pw}
            showRules
            autoFocus
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }))
            }}
            error={errors.confirm}
          />
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Save password
          </Button>
        </form>
      </AuthShell>
    </>
  )
}
