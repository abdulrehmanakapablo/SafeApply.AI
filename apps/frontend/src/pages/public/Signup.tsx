// FILE: src/pages/public/Signup.tsx
// PURPOSE: Signup page with phone number, password strength checker
// BACKEND: POST /api/auth/signup (email verification disabled for now)

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../../components/ui/Logo'
import SEO from '../../components/SEO'

const COUNTRY_CODES = [
  { code: '+1', flag: '🇺🇸', name: 'US' },
  { code: '+44', flag: '🇬🇧', name: 'GB' },
  { code: '+92', flag: '🇵🇰', name: 'PK' },
  { code: '+91', flag: '🇮🇳', name: 'IN' },
  { code: '+971', flag: '🇦🇪', name: 'AE' },
  { code: '+966', flag: '🇸🇦', name: 'SA' },
  { code: '+49', flag: '🇩🇪', name: 'DE' },
  { code: '+33', flag: '🇫🇷', name: 'FR' },
  { code: '+61', flag: '🇦🇺', name: 'AU' },
  { code: '+1', flag: '🇨🇦', name: 'CA' },
  { code: '+86', flag: '🇨🇳', name: 'CN' },
  { code: '+81', flag: '🇯🇵', name: 'JP' },
  { code: '+82', flag: '🇰🇷', name: 'KR' },
  { code: '+55', flag: '🇧🇷', name: 'BR' },
  { code: '+52', flag: '🇲🇽', name: 'MX' },
  { code: '+27', flag: '🇿🇦', name: 'ZA' },
  { code: '+234', flag: '🇳🇬', name: 'NG' },
  { code: '+20', flag: '🇪🇬', name: 'EG' },
  { code: '+90', flag: '🇹🇷', name: 'TR' },
  { code: '+62', flag: '🇮🇩', name: 'ID' },
]

interface PasswordCheck {
  label: string
  test: (pw: string) => boolean
}

const PASSWORD_CHECKS: PasswordCheck[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One special character (!@#$...)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone_code: string
  phone: string
  password: string
  confirm_password: string
  terms: boolean
}

interface FormErrors {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  password?: string
  confirm_password?: string
  terms?: string
  general?: string
}

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone_code: '+92',
    phone: '',
    password: '',
    confirm_password: '',
    terms: false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCodeDropdown, setShowCodeDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const passwordChecks = PASSWORD_CHECKS.map((check) => ({
    label: check.label,
    passed: check.test(form.password),
  }))

  const allPasswordChecksPassed = passwordChecks.every((c) => c.passed)

  function handleChange(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}

    if (!form.first_name.trim()) newErrors.first_name = 'First name is required'
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required'
    if (!form.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = 'Enter a valid email'
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required'
    else if (!/^\d{7,15}$/.test(form.phone.replace(/\s/g, '')))
      newErrors.phone = 'Enter a valid phone number'
    if (!form.password) newErrors.password = 'Password is required'
    else if (!allPasswordChecksPassed)
      newErrors.password = 'Password does not meet all requirements'
    if (!form.confirm_password)
      newErrors.confirm_password = 'Please confirm your password'
    else if (form.password !== form.confirm_password)
      newErrors.confirm_password = 'Passwords do not match'
    if (!form.terms) newErrors.terms = 'You must agree to the Terms of Service'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setErrors({})

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
          email: form.email.toLowerCase().trim(),
          phone: `${form.phone_code}${form.phone.replace(/\s/g, '')}`,
          password: form.password,
          confirm_password: form.confirm_password,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSubmitted(true)
      } else {
        setErrors({ general: data.error || 'Signup failed. Please try again.' })
      }
    } catch {
      setErrors({ general: 'Network error. Please check your connection.' })
    } finally {
      setLoading(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('#phone-code-dropdown')) {
        setShowCodeDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Auto-redirect after successful signup
  useEffect(() => {
    if (!submitted) return
    const timer = setTimeout(() => navigate('/login'), 2500)
    return () => clearTimeout(timer)
  }, [submitted, navigate])

  const selectedCountry =
    COUNTRY_CODES.find((c) => c.code === form.phone_code) || COUNTRY_CODES[2]

  // ── SUCCESS STATE ─────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <SEO
          title="Account created | SafeApply.AI"
          description="Your SafeApply.AI account is ready. Sign in to get started."
          path="/signup"
          noindex
        />

        <div className="min-h-screen bg-[#0e0e0e] flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-[440px] bg-[#0D0D0D] border border-[#1A1A1A] rounded-[16px] p-8 text-center">
            <div className="flex items-center justify-center mb-6">
              <Logo className="h-8 w-auto" />
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
              Account created
            </h2>
            <p className="text-sm text-white mb-1">
              Welcome,{' '}
              <span className="text-[#22C55E] font-semibold">
                {form.first_name}
              </span>
            </p>
            <p className="text-xs text-[#737373] leading-relaxed mb-8">
              Your account is ready. Redirecting you to sign in…
            </p>

            <Link
              to="/login"
              className="w-full py-3 bg-[#22C55E] hover:bg-[#16A34A] text-black text-sm font-semibold rounded-lg transition-colors block text-center"
            >
              Sign in now
            </Link>

            <button
              onClick={() => setSubmitted(false)}
              className="text-[#737373] hover:text-white text-xs transition-colors pt-4 block w-full"
            >
              ← Back to sign up
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── SIGNUP FORM ───────────────────────────────────────────
  return (
    <>
      <SEO
        title="Create your account | SafeApply.AI"
        description="Create a free SafeApply.AI account. Run cited company intelligence reports, match your CV against job descriptions, and track applications — no credit card required."
        path="/signup"
        noindex
      />

      <div className="min-h-screen bg-[#0e0e0e] flex flex-col">
        {/* Header */}
        <header className="w-full max-w-[80rem] mx-auto px-4 py-5 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Logo className="h-8 w-auto" />
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-[#737373] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[16px]">
              arrow_back
            </span>
            Back to website
          </Link>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative">
          <div className="absolute inset-0 pointer-events-none opacity-20 [background-image:linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="relative z-10 w-full max-w-[480px]">
            <div className="w-full bg-[#0D0D0D] border border-[#1A1A1A] rounded-[16px] p-6 sm:p-10">
              <div className="flex flex-col items-center justify-center mb-6">
                <Logo className="h-20 w-auto" />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white leading-tight tracking-tight">
                  Create your account
                </h2>
                <p className="text-sm text-[#737373] mt-1">
                  Start for free, no credit card needed
                </p>
              </div>

              {errors.general && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 text-center">
                  {errors.general}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* First + Last Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                      First Name
                    </label>
                    <input
                      type="text"
                      placeholder="Jane"
                      value={form.first_name}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      className={`w-full h-10 px-3 bg-[#0D0D0D] border rounded text-white text-sm placeholder-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        errors.first_name ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
                    />
                    {errors.first_name && (
                      <span className="text-red-400 text-[11px]">
                        {errors.first_name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="Doe"
                      value={form.last_name}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      className={`w-full h-10 px-3 bg-[#0D0D0D] border rounded text-white text-sm placeholder-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        errors.last_name ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
                    />
                    {errors.last_name && (
                      <span className="text-red-400 text-[11px]">
                        {errors.last_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="JaneDoe@domain.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`w-full h-10 px-3 bg-[#0D0D0D] border rounded text-white text-sm placeholder-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                      errors.email ? 'border-red-500' : 'border-[#1A1A1A]'
                    }`}
                  />
                  {errors.email && (
                    <span className="text-red-400 text-[11px]">{errors.email}</span>
                  )}
                </div>

                {/* Phone Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <div className="relative" id="phone-code-dropdown">
                      <button
                        type="button"
                        onClick={() => setShowCodeDropdown(!showCodeDropdown)}
                        className="h-10 px-3 bg-[#0D0D0D] border border-[#1A1A1A] rounded text-white text-sm flex items-center gap-1.5 hover:border-[#22C55E] transition-colors whitespace-nowrap"
                      >
                        <span>{selectedCountry.flag}</span>
                        <span className="font-mono">{form.phone_code}</span>
                        <span className="material-symbols-outlined text-[14px] text-[#737373]">
                          expand_more
                        </span>
                      </button>
                      {showCodeDropdown && (
                        <div className="absolute top-12 left-0 z-50 w-44 bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg shadow-xl max-h-52 overflow-y-auto">
                          {COUNTRY_CODES.map((country, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                handleChange('phone_code', country.code)
                                setShowCodeDropdown(false)
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#1A1A1A] flex items-center gap-2 transition-colors"
                            >
                              <span>{country.flag}</span>
                              <span className="text-[#737373] font-mono text-xs">
                                {country.code}
                              </span>
                              <span className="text-[#737373] text-xs">
                                {country.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="tel"
                      placeholder="3001234567"
                      value={form.phone}
                      onChange={(e) =>
                        handleChange('phone', e.target.value.replace(/[^\d\s]/g, ''))
                      }
                      className={`flex-1 h-10 px-3 bg-[#0D0D0D] border rounded text-white text-sm placeholder-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        errors.phone ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
                    />
                  </div>
                  {errors.phone && (
                    <span className="text-red-400 text-[11px]">{errors.phone}</span>
                  )}
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={form.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className={`w-full h-10 pl-3 pr-10 bg-[#0D0D0D] border rounded text-white text-sm placeholder-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        errors.password ? 'border-red-500' : 'border-[#1A1A1A]'
                      }`}
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

                  {form.password.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {passwordChecks.map((check) => (
                        <div key={check.label} className="flex items-center gap-2">
                          <span
                            className={`material-symbols-outlined text-[14px] ${
                              check.passed ? 'text-[#22C55E]' : 'text-red-400'
                            }`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {check.passed ? 'check_circle' : 'cancel'}
                          </span>
                          <span
                            className={`text-[12px] ${
                              check.passed ? 'text-[#22C55E]' : 'text-red-400'
                            }`}
                          >
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {errors.password && (
                    <span className="text-red-400 text-[11px]">
                      {errors.password}
                    </span>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#737373] text-[11px] font-semibold uppercase tracking-widest">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={form.confirm_password}
                      onChange={(e) =>
                        handleChange('confirm_password', e.target.value)
                      }
                      className={`w-full h-10 pl-3 pr-10 bg-[#0D0D0D] border rounded text-white text-sm placeholder-[#737373] focus:outline-none focus:border-[#22C55E] transition-colors ${
                        errors.confirm_password
                          ? 'border-red-500'
                          : 'border-[#1A1A1A]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {form.confirm_password.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`material-symbols-outlined text-[14px] ${
                          form.password === form.confirm_password
                            ? 'text-[#22C55E]'
                            : 'text-red-400'
                        }`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {form.password === form.confirm_password
                          ? 'check_circle'
                          : 'cancel'}
                      </span>
                      <span
                        className={`text-[12px] ${
                          form.password === form.confirm_password
                            ? 'text-[#22C55E]'
                            : 'text-red-400'
                        }`}
                      >
                        {form.password === form.confirm_password
                          ? 'Passwords match'
                          : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                  {errors.confirm_password && (
                    <span className="text-red-400 text-[11px]">
                      {errors.confirm_password}
                    </span>
                  )}
                </div>

                <div className="h-2" />

                {/* Terms checkbox */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.terms}
                    onChange={(e) => handleChange('terms', e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`w-4 h-4 mt-0.5 shrink-0 rounded border flex items-center justify-center transition-colors pointer-events-none ${
                      form.terms
                        ? 'bg-[#22C55E] border-[#22C55E]'
                        : errors.terms
                        ? 'border-red-500 bg-[#0D0D0D]'
                        : 'border-[#1A1A1A] bg-[#0D0D0D]'
                    }`}
                  >
                    {form.terms && (
                      <span className="material-symbols-outlined text-black text-[13px] leading-none">
                        check
                      </span>
                    )}
                  </span>
                  <span className="text-[#737373] text-sm leading-tight">
                    I agree to the{' '}
                    <Link
                      to="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#22C55E] hover:underline"
                    >
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link
                      to="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[#22C55E] hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                {errors.terms && (
                  <span className="text-red-400 text-[11px] block -mt-2">
                    {errors.terms}
                  </span>
                )}

                <div className="h-2" />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-6 bg-[#22C55E] hover:bg-[#16A34A] text-black text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        sync
                      </span>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_forward
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div className="h-6" />

              <div className="relative flex items-center justify-center mb-6">
                <div className="w-full border-t border-[#1A1A1A]" />
                <span className="absolute px-3 bg-[#0D0D0D] text-[#737373] text-xs uppercase tracking-wider">
                  or
                </span>
              </div>

              <button
                type="button"
                className="w-full py-3 bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#22C55E] rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-3"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="h-8" />

              <div className="text-center text-sm text-[#737373]">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-[#22C55E] hover:underline font-semibold ml-1"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-[#737373] px-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                <span>256-Bit Encrypted</span>
              </div>
              <span>© {new Date().getFullYear()} SafeApply.AI</span>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}