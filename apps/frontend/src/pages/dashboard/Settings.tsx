// FILE: src/pages/dashboard/Settings.tsx
// ROUTE: /dashboard/settings
// BACKEND: PATCH /api/auth/me, POST /api/auth/change-password,
//          PATCH /api/auth/notifications, DELETE /api/auth/me

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import SEO from '../../components/SEO'
import { PasswordField, passwordOk } from '../../components/ui/PasswordField'
import { useAuthStore } from '../../store/authStore'
import { changePassword, deleteAccount, logout as apiLogout, updateMe, updateNotifications } from '../../api/auth'
import { Button, Card, CardHeader, Dialog, Field, Icon, PageContainer, PageHeader, TextArea, cn, formatDate, initialsOf } from '../../components/ui'
import { apiError } from '../../lib/axios'
import TalentVisibility from '../../components/talent/TalentVisibility'

const AVATAR_MAX = 400 * 1024
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const BIO_MAX = 300

type Prefs = { weekly_summary: boolean; product_updates: boolean; saved_company_reviews: boolean }
const DEFAULT_PREFS: Prefs = { weekly_summary: true, product_updates: true, saved_company_reviews: false }
const PREF_COPY: { key: keyof Prefs; title: string; body: string }[] = [
  { key: 'weekly_summary', title: 'Weekly summary', body: 'Your applications and anything that went quiet.' },
  { key: 'product_updates', title: 'Product updates', body: 'New features, a few times a year.' },
  { key: 'saved_company_reviews', title: 'New reviews', body: 'When companies you’ve researched get a new review.' },
]

export default function Settings() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  // Profile
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [jobTitle, setJobTitle] = useState(user?.job_title || '')
  const [location, setLocation] = useState(user?.location || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatar, setAvatar] = useState(user?.avatar_url || '')
  const [profileErr, setProfileErr] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const dirty =
    fullName !== (user?.full_name || '') ||
    jobTitle !== (user?.job_title || '') ||
    location !== (user?.location || '') ||
    bio !== (user?.bio || '') ||
    avatar !== (user?.avatar_url || '')

  // Password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwErr, setPwErr] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [savingPw, setSavingPw] = useState(false)

  // Prefs
  const [prefs, setPrefs] = useState<Prefs>(user?.notification_prefs || DEFAULT_PREFS)
  const [savingPref, setSavingPref] = useState<keyof Prefs | null>(null)

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deletePw, setDeletePw] = useState('')
  const [deleting, setDeleting] = useState(false)

  function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (avatarRef.current) avatarRef.current.value = ''
    if (!file) return
    if (!AVATAR_TYPES.has(file.type)) return toast.error('Use a PNG, JPEG or WebP image.')
    if (file.size > AVATAR_MAX) return toast.error('Images must be under 400 KB.')
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url.startsWith('data:image/')) return toast.error('That file isn’t a valid image.')
      setAvatar(url)
    }
    reader.onerror = () => toast.error('Couldn’t read that file.')
    reader.readAsDataURL(file)
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (savingProfile || !user) return
    if (fullName.trim().length < 2) return setProfileErr('At least 2 characters')
    setProfileErr('')
    setSavingProfile(true)
    try {
      const res = await updateMe({ full_name: fullName.trim(), job_title: jobTitle.trim(), location: location.trim(), bio: bio.trim().slice(0, BIO_MAX), avatar_url: avatar })
      if (res.success && res.data) {
        setUser({
          ...user,
          full_name: res.data.full_name,
          job_title: res.data.job_title || undefined,
          location: res.data.location || undefined,
          bio: res.data.bio || undefined,
          avatar_url: res.data.avatar_url || undefined,
        })
        toast.success('Profile saved')
      } else toast.error(res.error || 'Couldn’t save your profile.')
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t save your profile.'))
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (savingPw) return
    const errs: typeof pwErr = {}
    if (!pw.current) errs.current = 'Enter your current password'
    if (!passwordOk(pw.next)) errs.next = 'Doesn’t meet the requirements'
    else if (pw.next === pw.current) errs.next = 'Must be different from your current password'
    if (pw.confirm !== pw.next) errs.confirm = 'Passwords don’t match'
    setPwErr(errs)
    if (Object.keys(errs).length) return
    setSavingPw(true)
    try {
      const res = await changePassword({ current_password: pw.current, new_password: pw.next, confirm_new_password: pw.confirm })
      if (res.success) {
        setPw({ current: '', next: '', confirm: '' })
        toast.success('Password changed')
      } else setPwErr({ current: res.error || 'Couldn’t change your password.' })
    } catch (err) {
      setPwErr({ current: apiError(err, 'Couldn’t change your password.') })
    } finally {
      setSavingPw(false)
    }
  }

  async function togglePref(key: keyof Prefs) {
    if (savingPref) return
    const prev = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSavingPref(key)
    try {
      const res = await updateNotifications(next)
      if (!res.success) throw new Error(res.error)
      if (user) setUser({ ...user, notification_prefs: next })
    } catch (err) {
      setPrefs(prev)
      toast.error(apiError(err, 'Couldn’t save that setting.'))
    } finally {
      setSavingPref(null)
    }
  }

  async function onDelete() {
    if (confirmText !== 'DELETE' || !deletePw || deleting) return
    setDeleting(true)
    try {
      const res = await deleteAccount('DELETE', deletePw)
      if (!res.success) throw new Error(res.error)
      try {
        await apiLogout()
      } catch {
        /* account is gone */
      }
      logout()
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(apiError(err, 'Couldn’t delete your account.'))
      setDeleting(false)
    }
  }

  return (
    <>
      <SEO title="Settings | SafeApply.AI" description="Your account settings." path="/dashboard/settings" noindex />
      <PageContainer narrow>
        <PageHeader title="Settings" description={user?.created_at ? `${user.email}. Member since ${formatDate(user.created_at)}.` : user?.email} />

        <Card as="section">
          <CardHeader title="Profile" description="Shown on your account only. Reviews are always anonymous." />
          <form onSubmit={saveProfile} className="flex flex-col gap-5" noValidate>
            <div className="flex items-center gap-4">
              {avatar ? (
                <img src={avatar} alt="Your profile photo" width={64} height={64} className="w-16 h-16 rounded-[14px] object-cover bg-line" />
              ) : (
                <span className="w-16 h-16 rounded-[14px] bg-line flex items-center justify-center text-lg font-semibold" aria-hidden>
                  {initialsOf(fullName || user?.full_name)}
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon="upload" onClick={() => avatarRef.current?.click()}>
                  {avatar ? 'Change photo' : 'Add photo'}
                </Button>
                {avatar && (
                  <Button size="sm" variant="ghost" onClick={() => setAvatar('')}>
                    Remove
                  </Button>
                )}
                <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onAvatar} />
                <p className="w-full text-xs text-muted">PNG, JPEG or WebP, under 400 KB.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={profileErr} autoComplete="name" maxLength={100} />
              <Field label="Email" value={user?.email || ''} disabled hint="Contact us to change it." />
              <Field label="Job title" optional value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={100} autoComplete="organization-title" />
              <Field label="Location" optional value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} />
            </div>
            <TextArea label="About you" optional rows={3} value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))} hint={`${bio.length} / ${BIO_MAX}`} />
            <div className="flex items-center justify-end gap-3">
              {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
              <Button type="submit" loading={savingProfile} disabled={!dirty}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <Card as="section">
          <CardHeader title="Password" description="You’ll stay logged in on this device." />
          <form onSubmit={savePassword} className="flex flex-col gap-4" noValidate>
            <input type="text" name="username" autoComplete="username" value={user?.email || ''} readOnly hidden />
            <PasswordField label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} error={pwErr.current} />
            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <PasswordField label="New password" autoComplete="new-password" showRules value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} error={pwErr.next} />
              <PasswordField label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} error={pwErr.confirm} />
            </div>
            <Button type="submit" variant="secondary" loading={savingPw} className="self-end">
              Change password
            </Button>
          </form>
        </Card>

        {user?.role === 'user' && <TalentVisibility />}

        <Card as="section">
          <CardHeader title="Email notifications" />
          <ul className="flex flex-col divide-y divide-line -my-2">
            {PREF_COPY.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p id={`pref-${p.key}`} className="text-sm font-medium">
                    {p.title}
                  </p>
                  <p className="text-[13px] text-muted">{p.body}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[p.key]}
                  aria-labelledby={`pref-${p.key}`}
                  disabled={savingPref !== null}
                  onClick={() => togglePref(p.key)}
                  className={cn('relative w-10 h-6 rounded-full shrink-0 transition-colors disabled:opacity-60', prefs[p.key] ? 'bg-accent' : 'bg-line')}
                >
                  <span className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-fg transition-transform duration-200', prefs[p.key] && 'translate-x-4')} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card as="section" className="border-danger/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold">Delete account</h2>
              <p className="text-[13px] text-muted mt-1">Removes your applications, reports, CVs and settings. Published reviews stay up but stay anonymous.</p>
            </div>
            <Button variant="danger" icon="delete_forever" onClick={() => setDeleteOpen(true)} className="self-start sm:self-center">
              Delete account
            </Button>
          </div>
        </Card>

        <Dialog
          open={deleteOpen}
          onClose={() => {
            if (deleting) return
            setDeleteOpen(false)
            setConfirmText('')
            setDeletePw('')
          }}
          title="Delete your account?"
          description="This can’t be undone."
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteOpen(false)
                  setConfirmText('')
                  setDeletePw('')
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={onDelete} loading={deleting} disabled={confirmText !== 'DELETE' || !deletePw}>
                Delete forever
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted flex items-start gap-2">
              <Icon name="warning" className="text-[18px] text-danger shrink-0" />
              Everything tied to {user?.email} is deleted immediately.
            </p>
            <Field label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            <PasswordField label="Your password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
          </div>
        </Dialog>
      </PageContainer>
    </>
  )
}
