// FILE: src/pages/public/Login.tsx
// BACKEND: POST /api/auth/login

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Logo from '../../components/ui/Logo'
import SEO from '../../components/SEO'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      })
      const data = await res.json()

      if (data.success) {
        login(data.data.user, data.data.accessToken)
        navigate('/dashboard')
      } else {
        setError(data.error || 'Invalid email or password')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Sign in | SafeApply.AI"
        description="Sign in to your SafeApply.AI account to run company intelligence reports, match your CV to job descriptions, and track applications."
        path="/login"
        noindex
      />

      <div className="min-h-screen bg-[#0e0e0e] flex flex-col">

        {/* Header */}
        <header className="w-full max-w-[80rem] mx-auto px-4 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo className="h-8 w-auto" />
          </Link>
          <Link to="/" className="flex items-center gap-1 text-[#737373] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to website
          </Link>
        </header>

        {/* Main */}
        <main className="flex-1 flex items-center justify-center px-4 py-8 relative">
          {/* Grid bg */}
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

              {/* Logo */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <Logo className="h-20 w-auto" />
              </div>

              {/* Title */}
              <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
                  <p className="text-sm text-[#737373] mt-1">Sign in to continue</p>
              </div>

              {/* Error banner */}
              {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-red-400 text-[18px] shrink-0">error</span>
                  <div>
                    <p className="text-white text-xs font-semibold">Access Denied</p>
                    <p className="text-[#bccbb9] text-xs mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="operator@domain.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError('') }}
                      className={`w-full bg-[#0D0D0D] text-white border rounded-lg px-4 py-3 pr-10 text-sm placeholder:text-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${error ? 'border-red-500' : 'border-[#1A1A1A]'}`}
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] text-[18px] pointer-events-none">
                      alternate_email
                    </span>
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">Password</label>
                    <Link to="/forgot-password" className="text-[#22C55E] hover:underline text-xs">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      className={`w-full bg-[#0D0D0D] text-white border rounded-lg px-4 py-3 pr-11 text-sm placeholder:text-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${error ? 'border-red-500' : 'border-[#1A1A1A]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-black rounded-lg py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="w-full border-t border-[#1A1A1A]" />
                <span className="absolute px-3 bg-[#0D0D0D] text-[#737373] text-xs uppercase tracking-wider">or</span>
              </div>

              {/* Google */}
              <button
                type="button"
                className="w-full bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22C55E] text-white rounded-lg py-3 px-4 flex items-center justify-center gap-3 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4" />
                  <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" fill="#34A853" />
                  <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" fill="#FBBC05" />
                  <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              {/* Sign up link */}
              <p className="mt-8 text-center text-sm text-[#737373]">
                Don't have an account?{' '}
                <Link to="/signup" className="text-[#22C55E] hover:underline font-semibold">
                  Sign up
                </Link>
              </p>

              {/* Security note */}
              <div className="mt-8 pt-4 border-t border-[#1A1A1A] flex items-center justify-between text-[#737373] text-[11px]">
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

        {/* Footer */}
        <footer className="w-full max-w-[80rem] mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#737373] text-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#22C55E] text-[16px]">verified_user</span>
            <span>256-Bit Encrypted ATS Gateway</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <span>© {new Date().getFullYear()} SafeApply.AI</span>
          </div>
        </footer>
      </div>
    </>
  )
}