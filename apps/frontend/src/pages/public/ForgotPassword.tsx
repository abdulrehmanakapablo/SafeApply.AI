// FILE: src/pages/public/ForgotPassword.tsx
// ROUTE: /forgot-password (public)
// BACKEND: POST /api/auth/forgot-password
// PURPOSE: Request a password reset link via email.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../components/ui/Logo'
import SEO from '../../components/SEO'
import { forgotPassword } from '../../api/auth'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resending, setResending] = useState(false)

  async function sendLink(target: string) {
    setLoading(true)
    setError('')
    try {
      const res = await forgotPassword(target)
      if (res.success) {
        setSubmitted(true)
      } else {
        setError(res.error || 'Could not send reset link. Please try again.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('Email is required')
      return
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Enter a valid email address')
      return
    }
    await sendLink(trimmed)
  }

  async function handleResend() {
    if (resending || !email) return
    setResending(true)
    try {
      await forgotPassword(email.trim().toLowerCase())
    } catch {
      // Silent — same UX either way
    } finally {
      setResending(false)
    }
  }

  // ── SUCCESS STATE ─────────────────────────────────────
  if (submitted) {
    return (
      <>
        <SEO
          title="Check your email | SafeApply.AI"
          description="Reset link sent. Check your inbox to continue."
          path="/forgot-password"
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
                    className="material-symbols-outlined text-[32px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    mark_email_read
                  </span>
                </div>

                <h2 className="text-2xl font-bold text-white leading-tight tracking-tight mb-2">
                  Check your email
                </h2>
                <p className="text-sm text-white mb-1">
                  We sent a reset link to{' '}
                  <span className="text-[#22C55E] font-semibold break-all">{email}</span>
                </p>
                <p className="text-xs text-[#737373] leading-relaxed mb-6">
                  Click the link to choose a new password. The link expires in 60 minutes.
                </p>

                <div className="p-3 bg-[#141414] border border-[#1A1A1A] rounded-lg flex items-center justify-between mb-6">
                  <span className="text-xs text-[#737373]">Didn't receive the email?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-[#22C55E] hover:underline text-xs font-medium flex items-center gap-1 disabled:opacity-60"
                  >
                    <span
                      className={`material-symbols-outlined text-[14px] ${
                        resending ? 'animate-spin' : ''
                      }`}
                    >
                      {resending ? 'sync' : 'refresh'}
                    </span>
                    {resending ? 'Sending…' : 'Resend link'}
                  </button>
                </div>

                <Link
                  to="/login"
                  className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-black text-sm font-semibold rounded-lg transition-colors block text-center"
                >
                  Back to Sign in
                </Link>

                <button
                  onClick={() => setSubmitted(false)}
                  className="text-[#737373] hover:text-white text-xs transition-colors pt-4 block w-full"
                >
                  ← Use a different email
                </button>
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
        title="Reset password | SafeApply.AI"
        description="Request a password reset link for your SafeApply.AI account."
        path="/forgot-password"
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
                  <span className="material-symbols-outlined text-[24px]">lock_reset</span>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Forgot your password?
                </h2>
                <p className="text-sm text-[#737373] mt-2">
                  Enter your email and we'll send you a recovery link
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0">
                    error
                  </span>
                  <p className="text-[#bccbb9] text-xs">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (error) setError('')
                      }}
                      autoComplete="email"
                      placeholder="you@domain.com"
                      className={`w-full bg-[#0D0D0D] text-white border rounded-lg px-4 py-3 pr-10 text-sm placeholder:text-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        error ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] text-[18px] pointer-events-none">
                      alternate_email
                    </span>
                  </div>
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
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
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
                  <span>Encrypted in transit</span>
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