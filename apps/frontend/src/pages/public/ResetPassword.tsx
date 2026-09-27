// FILE: src/pages/public/ResetPassword.tsx
// ROUTE: /reset-password and /reset-password/:token (public)
// BACKEND: POST /api/auth/reset-password
// PURPOSE: Set a new password using a recovery token from the email link.

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Logo from '../../components/ui/Logo'
import SEO from '../../components/SEO'
import { resetPassword } from '../../api/auth'

// ─── Password requirements ──────────────────────────────
const PASSWORD_CHECKS = [
  { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  {
    label: 'One special character (!@#$...)',
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
  },
]

// ─── Extract token from multiple URL formats ────────────
function extractTokenFromUrl(pathToken?: string): string | null {
  // 1. React Router path param
  if (pathToken) return pathToken

  // 2. URL hash fragment (Supabase default format)
  if (window.location.hash && window.location.hash.length > 1) {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('access_token')
    if (accessToken) return accessToken
    const tokenHash = params.get('token_hash')
    if (tokenHash) return tokenHash
  }

  // 3. URL query string
  const search = new URLSearchParams(window.location.search)
  return (
    search.get('token') ||
    search.get('token_hash') ||
    search.get('code') ||
    null
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const { token: pathToken } = useParams<{ token?: string }>()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [succeeded, setSucceeded] = useState(false)

  // Extract token once on mount — from path, hash, or query string
  const token = useMemo(() => extractTokenFromUrl(pathToken), [pathToken])
  const hasToken = Boolean(token)

  // Password checks
  const passwordChecks = PASSWORD_CHECKS.map((c) => ({
    label: c.label,
    passed: c.test(password),
  }))
  const allPassed = passwordChecks.every((c) => c.passed)

  // Auto-redirect to login after success
  useEffect(() => {
    if (!succeeded) return
    const timer = setTimeout(() => navigate('/login'), 3000)
    return () => clearTimeout(timer)
  }, [succeeded, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    if (!hasToken) {
      setError('Missing or invalid reset token. Please request a new link.')
      return
    }
    if (!password) {
      setError('Password is required.')
      return
    }
    if (!allPassed) {
      setError('Password does not meet all requirements.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await resetPassword(token as string, password, confirmPassword)
      if (res.success) {
        setSucceeded(true)
      } else {
        setError(res.error || 'Failed to reset password. The link may have expired.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // ── SUCCESS STATE ─────────────────────────────────────
  if (succeeded) {
    return (
      <>
        <SEO
          title="Password updated | SafeApply.AI"
          description="Your password has been updated. Sign in to continue."
          path="/reset-password"
          noindex
        />

        <div className="min-h-screen bg-[#0e0e0e] flex flex-col">
          <header className="w-full max-w-[80rem] mx-auto px-4 py-5 flex items-center justify-between">
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

          <main className="flex-1 flex items-center justify-center px-4 py-8 relative">
            <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#22C55E" strokeWidth="0.75" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            <div className="relative z-10 w-full max-w-[440px]">
              <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[16px] p-8 sm:p-12 text-center">
                <div className="flex items-center justify-center mb-6">
                  <Logo className="h-20 w-auto" />
                </div>

                <div className="w-16 h-16 mx-auto rounded-full bg-[#22C55E]/10 border border-[#22C55E]/25 flex items-center justify-center text-[#22C55E] mb-6">
                  <span
                    className="material-symbols-outlined text-[36px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-white leading-tight tracking-tight mb-2">
                  Password updated
                </h2>
                <p className="text-sm text-[#737373] leading-relaxed mb-8">
                  Your password has been changed. All other sessions have been signed out
                  for security. Redirecting to sign in…
                </p>

                <Link
                  to="/login"
                  className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-black text-sm font-semibold rounded-lg transition-colors block text-center"
                >
                  Sign in now
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    )
  }

  // ── INVALID TOKEN STATE ───────────────────────────────
  if (!hasToken) {
    return (
      <>
        <SEO
          title="Invalid reset link | SafeApply.AI"
          description="The reset link is missing or invalid. Request a new one."
          path="/reset-password"
          noindex
        />

        <div className="min-h-screen bg-[#0e0e0e] flex flex-col">
          <header className="w-full max-w-[80rem] mx-auto px-4 py-5 flex items-center justify-between">
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

          <main className="flex-1 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-[440px]">
              <div className="bg-[#0D0D0D] border border-[#EF4444]/40 rounded-[16px] p-8 sm:p-12 text-center">
                <div className="flex items-center justify-center mb-6">
                  <Logo className="h-20 w-auto" />
                </div>

                <div className="w-16 h-16 mx-auto rounded-full bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444] mb-6">
                  <span className="material-symbols-outlined text-[32px]">link_off</span>
                </div>

                <h2 className="text-2xl font-bold text-white leading-tight tracking-tight mb-2">
                  Invalid reset link
                </h2>
                <p className="text-sm text-[#737373] leading-relaxed mb-8">
                  This password reset link is missing, expired, or already used.
                  Request a new one to continue.
                </p>

                <Link
                  to="/forgot-password"
                  className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-black text-sm font-semibold rounded-lg transition-colors block text-center mb-3"
                >
                  Request New Link
                </Link>

                <Link
                  to="/login"
                  className="text-[#737373] hover:text-white text-xs transition-colors block"
                >
                  ← Back to sign in
                </Link>
              </div>
            </div>
          </main>
        </div>
      </>
    )
  }

  // ── FORM STATE ────────────────────────────────────────
  return (
    <>
      <SEO
        title="Set new password | SafeApply.AI"
        description="Choose a new password for your SafeApply.AI account."
        path="/reset-password"
        noindex
      />

      <div className="min-h-screen bg-[#0e0e0e] flex flex-col">
        <header className="w-full max-w-[80rem] mx-auto px-4 py-5 flex items-center justify-between">
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

        <main className="flex-1 flex items-center justify-center px-4 py-8 relative">
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#22C55E" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="relative z-10 w-full max-w-[440px]">
            <div className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-[16px] p-8 sm:p-12">
              <div className="flex items-center justify-center mb-6">
                <Logo className="h-20 w-auto" />
              </div>

              <div className="text-center mb-8">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#22C55E]/10 border border-[#22C55E]/25 flex items-center justify-center text-[#22C55E] mb-4">
                  <span className="material-symbols-outlined text-[24px]">key</span>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Set new password
                </h2>
                <p className="text-sm text-[#737373] mt-2">
                  Choose a strong password to secure your account
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0">
                    error
                  </span>
                  <div>
                    <p className="text-white text-xs font-semibold">Could not reset password</p>
                    <p className="text-[#bccbb9] text-xs mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                {/* New password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError('')
                      }}
                      autoComplete="new-password"
                      placeholder="Create a strong password"
                      className={`w-full bg-[#0D0D0D] text-white border rounded-lg px-4 py-3 pr-10 text-sm placeholder:text-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        error ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Live password checks */}
                  {password.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {passwordChecks.map((c) => (
                        <div key={c.label} className="flex items-center gap-2">
                          <span
                            className={`material-symbols-outlined text-[14px] ${
                              c.passed ? 'text-[#22C55E]' : 'text-red-400'
                            }`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {c.passed ? 'check_circle' : 'cancel'}
                          </span>
                          <span
                            className={`text-[12px] ${
                              c.passed ? 'text-[#22C55E]' : 'text-red-400'
                            }`}
                          >
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (error) setError('')
                      }}
                      autoComplete="new-password"
                      placeholder="Repeat your new password"
                      className={`w-full bg-[#0D0D0D] text-white border rounded-lg px-4 py-3 pr-10 text-sm placeholder:text-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        error ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`material-symbols-outlined text-[14px] ${
                          password === confirmPassword
                            ? 'text-[#22C55E]'
                            : 'text-red-400'
                        }`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {password === confirmPassword ? 'check_circle' : 'cancel'}
                      </span>
                      <span
                        className={`text-[12px] ${
                          password === confirmPassword
                            ? 'text-[#22C55E]'
                            : 'text-red-400'
                        }`}
                      >
                        {password === confirmPassword
                          ? 'Passwords match'
                          : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-not-allowed text-black rounded-lg py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        sync
                      </span>
                      <span>Updating…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">key</span>
                      <span>Reset Password</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-[#1A1A1A] text-center">
                <p className="text-sm text-[#737373]">
                  Remember your password?{' '}
                  <Link to="/login" className="text-[#22C55E] hover:underline font-semibold">
                    Sign in
                  </Link>
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#1A1A1A] flex items-center justify-between text-[#737373] text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  <span>256-bit TLS Encrypted</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">shield</span>
                  <span>Secure</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}