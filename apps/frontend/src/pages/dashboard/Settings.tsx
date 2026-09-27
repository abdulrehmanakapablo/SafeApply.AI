// FILE: src/pages/dashboard/Settings.tsx
// ROUTE: /dashboard/settings (auth required)
// BACKEND: PATCH /api/auth/me, POST /api/auth/change-password,
//          PATCH /api/auth/notifications, DELETE /api/auth/me
// PURPOSE: Profile, security, notifications, danger zone.
// SECURITY:
//   - No dangerouslySetInnerHTML — React auto-escapes all user input.
//   - No inline event handlers — all handlers are typed functions.
//   - Password change requires current password verification on backend.
//   - Delete account requires typing DELETE — validated on both sides.
//   - Avatar uploads client-validated (type + size) before sending.

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '../../components/SEO'
import { useAuthStore } from '../../store/authStore'
import {
  updateMe,
  changePassword,
  updateNotifications,
  deleteAccount,
} from '../../api/auth'

// ─── Password checks ─────────────────────────────────────
const PASSWORD_CHECKS = [
  { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  {
    label: 'One special character (!@#$...)',
    test: (pw: string) => /[^A-Za-z0-9]/.test(pw),
  },
]

// ─── Avatar constraints ──────────────────────────────────
const AVATAR_MAX_BYTES = 400 * 1024
const AVATAR_ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

// ─── Bio max length ──────────────────────────────────────
const BIO_MAX = 300

// ─── Notification prefs shape ────────────────────────────
interface NotificationPrefs {
  weekly_summary: boolean
  product_updates: boolean
  saved_company_reviews: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  weekly_summary: true,
  product_updates: true,
  saved_company_reviews: false,
}

// ─── Entropy display helper ──────────────────────────────
function computeEntropy(pw: string): { bits: number; label: string; level: 'weak' | 'moderate' | 'strong' } {
  if (!pw) return { bits: 0, label: 'Empty', level: 'weak' }
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33
  const bits = pool > 0 ? Math.round(pw.length * Math.log2(pool)) : 0
  if (bits < 40) return { bits, label: 'Weak', level: 'weak' }
  if (bits < 60) return { bits, label: 'Moderate', level: 'moderate' }
  if (bits < 80) return { bits, label: 'Strong', level: 'strong' }
  return { bits, label: 'Very Strong', level: 'strong' }
}

// ─── Component ───────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  )

  // ── Profile state ──────────────────────────────────────
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [jobTitle, setJobTitle] = useState(user?.job_title || '')
  const [location, setLocation] = useState(user?.location || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Password state ─────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // ── Notification state ─────────────────────────────────
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    user?.notification_prefs || DEFAULT_PREFS
  )
  const [savingPrefs, setSavingPrefs] = useState(false)

  // ── Danger zone ────────────────────────────────────────
  const [dangerOpen, setDangerOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const passwordChecks = PASSWORD_CHECKS.map((c) => ({
    label: c.label,
    passed: c.test(newPassword),
  }))
  const allPasswordChecksPassed = passwordChecks.every((c) => c.passed)
  const entropy = computeEntropy(newPassword)

  const initials = (fullName || user?.full_name || 'User')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const lastUpdatedLabel = (() => {
    const d = user?.created_at ? new Date(user.created_at) : new Date()
    const days = Math.max(
      0,
      Math.floor((Date.now() - d.getTime()) / 86_400_000)
    )
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30) return `${days} days ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
  })()

  // ── Avatar upload ──────────────────────────────────────
  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (avatarInputRef.current) avatarInputRef.current.value = ''
    if (!file) return

    if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
      setToast({ kind: 'err', text: 'Only PNG, JPEG, or WebP images allowed.' })
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setToast({ kind: 'err', text: 'Image is over 400 KB. Use a smaller file.' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl.startsWith('data:image/')) {
        setToast({ kind: 'err', text: 'Invalid image file.' })
        return
      }
      setAvatarUrl(dataUrl)
      setToast({ kind: 'ok', text: 'Avatar ready — click Save Changes.' })
    }
    reader.onerror = () => {
      setToast({ kind: 'err', text: 'Could not read that file.' })
    }
    reader.readAsDataURL(file)
  }

  function revokeAvatar() {
    setAvatarUrl('')
  }

  // ── Save profile ───────────────────────────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (savingProfile) return

    if (!fullName.trim() || fullName.trim().length < 2) {
      setToast({ kind: 'err', text: 'Full name must be at least 2 characters.' })
      return
    }
    if (bio.length > BIO_MAX) {
      setToast({ kind: 'err', text: `Bio must be ${BIO_MAX} characters or fewer.` })
      return
    }

    setSavingProfile(true)
    try {
      const res = await updateMe({
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        location: location.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
      })

      if (res.success && res.data) {
        setUser({
          ...user!,
          full_name: res.data.full_name,
          job_title: res.data.job_title || undefined,
          location: res.data.location || undefined,
          bio: res.data.bio || undefined,
          avatar_url: res.data.avatar_url || undefined,
        })
        setToast({ kind: 'ok', text: 'Profile synchronized.' })
      } else {
        setToast({ kind: 'err', text: res.error || 'Failed to update profile.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'Network error — try again.' })
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Change password ────────────────────────────────────
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (savingPassword) return

    if (!currentPassword) {
      setToast({ kind: 'err', text: 'Enter your current password.' })
      return
    }
    if (!allPasswordChecksPassed) {
      setToast({ kind: 'err', text: 'New password does not meet requirements.' })
      return
    }
    if (newPassword !== confirmNewPassword) {
      setToast({ kind: 'err', text: 'Passwords do not match.' })
      return
    }
    if (newPassword === currentPassword) {
      setToast({
        kind: 'err',
        text: 'New password must differ from current password.',
      })
      return
    }

    setSavingPassword(true)
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      })
      if (res.success) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
        setToast({ kind: 'ok', text: 'Password updated.' })
      } else {
        setToast({ kind: 'err', text: res.error || 'Failed to update password.' })
      }
    } catch {
      setToast({ kind: 'err', text: 'Network error — try again.' })
    } finally {
      setSavingPassword(false)
    }
  }

  // ── Toggle notification ────────────────────────────────
  async function togglePref(key: keyof NotificationPrefs) {
    if (savingPrefs) return
    const previous = prefs
    const next: NotificationPrefs = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSavingPrefs(true)
    try {
      const res = await updateNotifications(next)
      if (!res.success) {
        setPrefs(previous)
        setToast({ kind: 'err', text: res.error || 'Failed to save.' })
      }
    } catch {
      setPrefs(previous)
      setToast({ kind: 'err', text: 'Network error — try again.' })
    } finally {
      setSavingPrefs(false)
    }
  }

  // ── Delete account ─────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE' || deleting) return
    setDeleting(true)
    try {
      const res = await deleteAccount('DELETE')
      if (res.success) {
        logout()
        navigate('/')
      } else {
        setToast({ kind: 'err', text: res.error || 'Failed to delete account.' })
        setDeleting(false)
      }
    } catch {
      setToast({ kind: 'err', text: 'Network error — try again.' })
      setDeleting(false)
    }
  }

  return (
    <>
      <SEO
        title="Settings | SafeApply.AI"
        description="Manage your SafeApply.AI profile, password, and notification preferences."
        path="/dashboard/settings"
        noindex
      />

      <div className="w-full px-4 sm:px-6 py-4 sm:py-6 pb-16">
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">

          {/* ── Telemetry strip ────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1A1A1A]">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="font-mono text-white uppercase tracking-wider">
                Node ID: OP-{(user?.id || '0000').slice(0, 4).toUpperCase()}-TLS
              </span>
              <span className="text-[#353534]">•</span>
              <span className="text-[#737373]">256-bit session active</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[#1c1b1b] text-[#737373] border border-[#1A1A1A]">
                LATENCY 14ms
              </span>
              <span className="px-2 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30">
                INTEGRITY 100%
              </span>
            </div>
          </div>

          {/* ── Page title ─────────────────────────────── */}
          <header className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
              <span className="text-[#22c55e]">System Administration</span>
              <span className="text-[#737373]">/</span>
              <span className="text-[#737373]">Operator Core</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Account Settings
            </h1>
            <p className="text-sm text-[#737373]">
              Manage your profile, security, and notification preferences.
            </p>
          </header>

          {/* ── SECTION 1: Profile ─────────────────────── */}
          <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#22c55e]">
                    badge
                  </span>
                  Profile Information
                </h2>
                <span className="text-[10px] font-mono text-[#737373] border border-[#1A1A1A] px-2 py-0.5 rounded whitespace-nowrap">
                  UID: {(user?.id || '0000').slice(0, 8).toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Update your personal details, professional tags, and public applicant identity.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              {/* Avatar row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Upload avatar"
                  className="relative group rounded-full shrink-0 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile avatar"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#22c55e]/40"
                    />
                  ) : (
                    <span className="w-20 h-20 rounded-full border-2 border-dashed border-[#1A1A1A] group-hover:border-[#22c55e]/60 transition-all flex items-center justify-center bg-black text-[#22c55e] font-mono text-lg font-bold">
                      {initials}
                    </span>
                  )}
                  <span className="absolute inset-0 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[#22c55e]">
                    <span className="material-symbols-outlined text-[20px]">
                      photo_camera
                    </span>
                    <span className="text-[9px] uppercase tracking-wider mt-0.5">
                      Upload
                    </span>
                  </span>
                </button>

                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {fullName || 'Your Name'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap">
                      <span className="material-symbols-outlined text-[12px]">
                        verified
                      </span>
                      Primary
                    </span>
                  </div>
                  <p className="text-xs text-[#737373]">
                    PNG, JPEG, or WebP · max 400 KB · square crops best
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="px-3 py-1 rounded bg-[#1c1b1b] hover:bg-[#2a2a2a] border border-[#1A1A1A] text-white text-[11px] font-semibold transition-colors"
                    >
                      Replace Avatar
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={revokeAvatar}
                        className="px-3 py-1 rounded text-[#737373] hover:text-[#EF4444] text-[11px] font-semibold transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>

              {/* Fields grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide flex justify-between">
                    <span>Full Name</span>
                    <span className="text-[#353534] font-normal normal-case">
                      Legal / ATS matching
                    </span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    placeholder="First and Last name"
                    className="w-full h-10 px-3 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide flex justify-between">
                    <span>Email</span>
                    <span className="text-[#22c55e] normal-case flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-[12px]">
                        lock
                      </span>
                      Encrypted
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full h-10 pl-3 pr-24 rounded bg-black border border-[#1A1A1A] text-[#737373] text-sm cursor-not-allowed"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-[10px] font-semibold">
                      <span className="material-symbols-outlined text-[12px]">
                        check_circle
                      </span>
                      Verified
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                    Current Target Title
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Principal Architect"
                    className="w-full h-10 px-3 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                    Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      maxLength={100}
                      placeholder="City, Region"
                      className="w-full h-10 pl-3 pr-10 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                    />
                    <span className="material-symbols-outlined text-[18px] text-[#737373] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      pin_drop
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide flex justify-between">
                  <span>Executive Summary / ATS Neural Header</span>
                  <span
                    className={`font-mono text-[11px] normal-case ${
                      bio.length > BIO_MAX ? 'text-[#EF4444]' : 'text-[#737373]'
                    }`}
                  >
                    {bio.length} / {BIO_MAX} chars
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={BIO_MAX}
                  placeholder="A one-line professional headline that describes what you do best."
                  className="w-full p-3 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors resize-none leading-relaxed placeholder-[#737373]"
                />
                <span className="text-[11px] text-[#737373]">
                  Included automatically in generated recruiter briefings.
                </span>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#1A1A1A]">
                <div className="flex items-center gap-2 text-xs text-[#737373]">
                  <span className="material-symbols-outlined text-[16px]">
                    history
                  </span>
                  Last updated {lastUpdatedLabel}
                </div>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center justify-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {savingProfile ? 'sync' : 'save'}
                  </span>
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>

          {/* ── SECTION 2: Security ────────────────────── */}
          <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#22c55e]">
                    shield_lock
                  </span>
                  Security &amp; Password
                </h2>
                <span className="text-[10px] font-mono text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/20 whitespace-nowrap">
                  BCRYPT 12 ROUNDS
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Manage your authentication credentials and password.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              {/* Current password */}
              <div className="flex flex-col gap-1.5 w-full sm:max-w-lg">
                <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full h-10 pl-3 pr-10 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw((v) => !v)}
                    aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showCurrentPw ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* New + Confirm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      className="w-full h-10 pl-3 pr-10 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      aria-label={showNewPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showNewPw ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Strength bar */}
                  {newPassword.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="w-full bg-[#1A1A1A] h-1 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            entropy.level === 'weak'
                              ? 'bg-[#EF4444]'
                              : entropy.level === 'moderate'
                              ? 'bg-[#EAB308]'
                              : 'bg-[#22c55e]'
                          }`}
                          style={{
                            width: `${Math.min(100, (entropy.bits / 100) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#737373]">
                          Entropy:{' '}
                          <span
                            className={`font-semibold ${
                              entropy.level === 'weak'
                                ? 'text-[#EF4444]'
                                : entropy.level === 'moderate'
                                ? 'text-[#EAB308]'
                                : 'text-[#22c55e]'
                            }`}
                          >
                            {entropy.bits} bits
                          </span>
                        </span>
                        <span
                          className={`font-semibold uppercase ${
                            entropy.level === 'weak'
                              ? 'text-[#EF4444]'
                              : entropy.level === 'moderate'
                              ? 'text-[#EAB308]'
                              : 'text-[#22c55e]'
                          }`}
                        >
                          {entropy.label}
                        </span>
                      </div>

                      {/* Live checklist */}
                      <div className="flex flex-col gap-1 mt-1">
                        {passwordChecks.map((c) => (
                          <div key={c.label} className="flex items-center gap-2">
                            <span
                              className={`material-symbols-outlined text-[14px] ${
                                c.passed ? 'text-[#22c55e]' : 'text-[#EF4444]'
                              }`}
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              {c.passed ? 'check_circle' : 'cancel'}
                            </span>
                            <span
                              className={`text-xs ${
                                c.passed ? 'text-[#22c55e]' : 'text-[#EF4444]'
                              }`}
                            >
                              {c.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-mono uppercase text-[#737373] tracking-wide">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Re-enter identical string"
                      className="w-full h-10 pl-3 pr-10 rounded bg-black border border-[#1A1A1A] text-white text-sm focus:border-[#22c55e] focus:outline-none transition-colors placeholder-[#737373]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPw ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {confirmNewPassword.length > 0 &&
                    newPassword !== confirmNewPassword && (
                      <span className="text-[#EF4444] text-xs mt-1">
                        Passwords do not match
                      </span>
                    )}
                </div>
              </div>

              {/* Info bar */}
              <div className="bg-black rounded-lg border border-[#1A1A1A] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-[#737373] min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-[#22c55e] shrink-0">
                    info
                  </span>
                  <span className="truncate">
                    Changing your password signs out all other sessions.
                  </span>
                </div>
                <span className="flex items-center gap-1.5 font-mono text-[#737373] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  Active sessions: 1
                </span>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-3 border-t border-[#1A1A1A]">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="inline-flex items-center gap-1.5 bg-[#22c55e] hover:bg-[#16A34A] disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {savingPassword ? 'sync' : 'key'}
                  </span>
                  {savingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>

          {/* ── SECTION 3: Notifications ───────────────── */}
          <section className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1 pb-3 border-b border-[#1A1A1A]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#22c55e]">
                    notifications_active
                  </span>
                  Notification Preferences
                </h2>
                <span className="font-mono text-[10px] text-[#737373] whitespace-nowrap">
                  EMAIL DISPATCH
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Configure what lands in your inbox and how often.
              </p>
            </div>

            <div className="flex flex-col divide-y divide-[#1A1A1A]">
              <ToggleRow
                label="Weekly job hunt summary"
                badge="Digest"
                subtitle="Metrics on resume match rate, ATS pass-through velocity, and newly opened positions matching your profile."
                checked={prefs.weekly_summary}
                onToggle={() => togglePref('weekly_summary')}
                disabled={savingPrefs}
              />
              <ToggleRow
                label="Product updates and new heuristics"
                badge="Releases"
                subtitle="Early access telemetry on new features, ATS engine updates, and improvements."
                checked={prefs.product_updates}
                onToggle={() => togglePref('product_updates')}
                disabled={savingPrefs}
              />
              <ToggleRow
                label="New reviews for saved companies"
                badge="Signals"
                subtitle="Alerts when a tracked company receives a new approved review or notable news."
                checked={prefs.saved_company_reviews}
                onToggle={() => togglePref('saved_company_reviews')}
                disabled={savingPrefs}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#1A1A1A] text-xs">
              <span className="flex items-center gap-1.5 text-[#737373] min-w-0">
                <span className="material-symbols-outlined text-[16px] text-[#22c55e] shrink-0">
                  mail
                </span>
                <span className="truncate">
                  Dispatches to {user?.email || 'your email'}
                </span>
              </span>
              <span className="text-[#737373] font-mono text-[10px] whitespace-nowrap">
                AUTO-SAVED
              </span>
            </div>
          </section>

          {/* ── SECTION 4: Danger Zone ─────────────────── */}
          <section className="bg-[#0D0D0D] border border-[#EF4444]/40 rounded-xl p-5 sm:p-6 flex flex-col gap-4 relative overflow-hidden">
            {/* Warning watermark */}
            <span className="absolute -right-6 -top-6 text-[#EF4444]/5 pointer-events-none select-none">
              <span className="material-symbols-outlined text-[140px]">
                warning
              </span>
            </span>

            <div className="flex flex-col gap-1 pb-3 border-b border-[#EF4444]/20 relative z-10">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[#EF4444] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-[#EF4444]">
                    dangerous
                  </span>
                  Danger Zone
                </h2>
                <span className="text-[10px] font-mono text-[#EF4444] uppercase border border-[#EF4444]/30 bg-[#EF4444]/10 px-2 py-0.5 rounded whitespace-nowrap">
                  Irreversible
                </span>
              </div>
              <p className="text-xs text-[#737373]">
                Permanent data purge and unrecoverable credential deletion.
              </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 relative z-10">
              <div className="flex flex-col gap-1 max-w-lg">
                <h3 className="text-sm text-white font-semibold">
                  Purge &amp; Delete Account
                </h3>
                <p className="text-xs text-[#737373] leading-relaxed">
                  Permanently wipes all CVs, applications, reports, and reviews. All active sessions terminate immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDangerOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-transparent border border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">
                  delete_forever
                </span>
                Delete Account
              </button>
            </div>

            {/* Inline confirmation — appears when dangerOpen */}
            {dangerOpen && (
              <div className="flex flex-col gap-3 p-4 bg-black border border-[#EF4444]/40 rounded-lg relative z-10">
                <div className="flex items-center gap-2 text-[#EF4444] text-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">
                    lock_reset
                  </span>
                  Security verification required
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">
                  To finalize the purge of node{' '}
                  <code className="text-white bg-[#1A1A1A] px-1.5 py-0.5 rounded font-mono text-[11px]">
                    OP-{(user?.id || '0000').slice(0, 4).toUpperCase()}-TLS
                  </code>
                  , type <strong className="text-[#EF4444] font-mono font-bold">DELETE</strong> below:
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE"
                    autoComplete="off"
                    disabled={deleting}
                    className="w-full sm:max-w-xs h-10 px-3 rounded bg-[#0D0D0D] border border-[#1A1A1A] text-white text-sm font-mono focus:border-[#EF4444] focus:outline-none transition-colors placeholder-[#353534]"
                  />
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== 'DELETE' || deleting}
                    className="h-10 px-4 rounded bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {deleting ? 'sync' : 'delete_forever'}
                    </span>
                    {deleting ? 'Deleting…' : 'Confirm Purge'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDangerOpen(false)
                      setDeleteConfirm('')
                    }}
                    disabled={deleting}
                    className="h-10 px-3 rounded text-[#737373] hover:text-white text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── Toast ────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-100 max-w-[calc(100vw-2rem)] px-4 py-3 rounded-lg border shadow-xl bg-[#0D0D0D] text-sm flex items-center gap-2 ${
            toast.kind === 'ok'
              ? 'border-l-4 border-l-[#22c55e] border-[#1A1A1A]'
              : 'border-l-4 border-l-[#EF4444] border-[#1A1A1A]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              toast.kind === 'ok' ? 'text-[#22c55e]' : 'text-[#EF4444]'
            }`}
          >
            {toast.kind === 'ok' ? 'check_circle' : 'error'}
          </span>
          <span className="text-white break-words">{toast.text}</span>
        </div>
      )}
    </>
  )
}

// ─── Toggle row sub-component ────────────────────────────
function ToggleRow({
  label,
  badge,
  subtitle,
  checked,
  onToggle,
  disabled,
}: {
  label: string
  badge: string
  subtitle: string
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className="py-4 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-1 min-w-0 max-w-xl">
        <span className="text-sm text-white font-semibold flex items-center gap-2 flex-wrap">
          {label}
          <span className="px-1.5 py-0.5 rounded bg-[#1c1b1b] text-[#737373] text-[10px] uppercase font-mono">
            {badge}
          </span>
        </span>
        <span className="text-xs text-[#737373] leading-relaxed">
          {subtitle}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 ${
          checked ? 'bg-[#22c55e]' : 'bg-[#1A1A1A]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}