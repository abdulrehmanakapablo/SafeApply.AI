// ============================================================
// FILE: apps/backend/src/controllers/auth.controller.ts
// PURPOSE: Auth controller — signup, login, refresh, logout,
//          forgot/reset, get me, update me, change password,
//          update notifications, delete account.
//
// DUAL-STORE PASSWORD MODEL (permanent):
//   • auth.users.password       — Supabase Auth (authoritative)
//   • public.users.password_hash — app's bcrypt mirror (fast login)
//
// Signup writes both. Login tries bcrypt first; if the mirror is
// stale (sentinel '!' or bcrypt mismatch), it falls back to
// Supabase Auth verification and self-heals the mirror.
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { hashPassword, comparePassword, hashToken, compareToken, burnPasswordCheck } from '../utils/hash'
import { env } from '../config/env'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError } from '../utils/response'
import { FREE_EMAIL_DOMAINS, emailDomain } from '../utils/recruiter'
import { verifySupabasePassword } from '../utils/passwordCheck'

// Refresh cookie: httpOnly (JS can't read it), Secure in production,
// SameSite=Strict (never sent on cross-site requests → no CSRF), and only
// sent to the auth routes instead of every API call.
const REFRESH_COOKIE = 'refresh_token'
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict' as const,
  path: '/api/auth',
}
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...refreshCookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
}
function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions)
  // Older builds set the cookie on path "/"; clear that copy too.
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, path: '/' })
}

// ─── SIGNUP ───────────────────────────────────────────────
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const body = sanitizeObject(req.body)
    const full_name = body.full_name as string | undefined
    const email = body.email as string | undefined
    const password = body.password as string | undefined
    const phone = body.phone as string | undefined

    if (!email || !password || !full_name) {
      sendError(res, 'Full name, email and password are required', 400)
      return
    }

    const normalizedEmail = email.toLowerCase().trim()
    const normalizedName = full_name.trim()
    const role: 'user' | 'recruiter' | 'freelancer' | 'client' = ['recruiter', 'freelancer', 'client'].includes(body.role) ? body.role : 'user'

    // Recruiters must use a company address: it's how we verify the employer.
    if (role === 'recruiter' && FREE_EMAIL_DOMAINS.has(emailDomain(normalizedEmail))) {
      sendError(res, 'Use your work email (for example you@yourcompany.com) to sign up as a recruiter.', 400)
      return
    }
    const normalizedPhone = phone && typeof phone === 'string' ? phone : null

    // Reject if email already taken
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUser) {
      sendError(res, 'An account with this email already exists', 409)
      return
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedName,
          phone: normalizedPhone,
        },
      })

    if (authError || !authData.user) {
      console.error('Supabase createUser error:', authError)
      sendError(res, 'Failed to create account', 500)
      return
    }

    // Hash the password for our own users row
    const passwordHash = await hashPassword(password)

    // Upsert — the trigger has almost certainly created the row already.
    // We only fill in what the trigger couldn't (password_hash, phone).
    // role and plan stay untouched (trigger owns first-admin promotion).
    const { error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: authData.user.id,
          email: normalizedEmail,
          full_name: normalizedName,
          phone: normalizedPhone,
          password_hash: passwordHash,
        },
        { onConflict: 'id' },
      )

    if (upsertError) {
      console.error('Users upsert error:', upsertError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      sendError(res, 'Failed to create account', 500)
      return
    }

    // Verify the write actually landed — belt and suspenders
    const { data: verify } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', authData.user.id)
      .single()

    if (!verify?.password_hash || verify.password_hash === '!') {
      console.error(
        'Signup succeeded but password_hash was not persisted. Retrying...',
      )

      const { error: retryError } = await supabaseAdmin
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', authData.user.id)

      if (retryError) {
        console.error('Retry update failed:', retryError)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        sendError(res, 'Failed to create account', 500)
        return
      }
    }

    if (role !== 'user') {
      // Only ever changes a plain user row; never touches an admin row.
      await supabaseAdmin.from('users').update({ role }).eq('id', authData.user.id).eq('role', 'user')
    }

    sendSuccess(res, null, 201, 'Account created successfully')
  } catch (error) {
    console.error('Signup error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── LOGIN ────────────────────────────────────────────────
// Verify order:
//   1. bcrypt against public.users.password_hash (fast path)
//   2. If sentinel/mismatch/missing → verifySupabasePassword (throwaway client)
//   3. On Supabase success → self-heal public.users.password_hash
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      sendError(res, 'Email and password are required', 400)
      return
    }

    const normalizedEmail = (email as string).toLowerCase().trim()

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, full_name, role, plan, password_hash, avatar_url, job_title, location, bio, email_verified, created_at',
      )
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (error || !user) {
      // Spend the same time as a real check so timing can't reveal which
      // emails are registered.
      await burnPasswordCheck(String(password))
      sendError(res, 'Invalid email or password', 401)
      return
    }

    // ── Step 1: try the fast path (bcrypt against local hash) ──
    let passwordValid = false
    const localHash = user.password_hash

    if (localHash && localHash !== '!' && localHash.length >= 20) {
      try {
        passwordValid = await comparePassword(password, localHash)
      } catch {
        passwordValid = false
      }
    }

    // ── Step 2: fall back to Supabase Auth ──
    if (!passwordValid) {
      if (!(await verifySupabasePassword(normalizedEmail, password))) {
        sendError(res, 'Invalid email or password', 401)
        return
      }

      passwordValid = true

      // ── Step 3: self-heal the local hash ──
      try {
        const freshHash = await hashPassword(password)
        const { error: healError } = await supabaseAdmin
          .from('users')
          .update({ password_hash: freshHash, updated_at: new Date().toISOString() })
          .eq('id', user.id)

        if (healError) console.warn('[login] hash self-heal failed')
      } catch (healErr) {
        console.warn('[login] hash self-heal threw:', healErr)
      }
    }

    // ── Issue tokens ──
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)

    const refreshTokenHash = await hashToken(refreshToken)
    await supabaseAdmin
      .from('users')
      .update({ refresh_token_hash: refreshTokenHash })
      .eq('id', user.id)

    setRefreshCookie(res, refreshToken)

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        plan: user.plan,
        avatar_url: user.avatar_url || undefined,
        job_title: user.job_title || undefined,
        location: user.location || undefined,
        bio: user.bio || undefined,
        created_at: user.created_at || undefined,
      },
      accessToken,
    })
  } catch (error) {
    console.error('Login error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── REFRESH ──────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refresh_token
    if (!token) {
      sendError(res, 'No refresh token', 401)
      return
    }

    let payload
    try {
      payload = verifyRefreshToken(token)
    } catch {
      clearRefreshCookie(res)
      sendError(res, 'Invalid refresh token', 401)
      return
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, plan, refresh_token_hash')
      .eq('id', payload.userId)
      .maybeSingle()

    if (error || !user || !user.refresh_token_hash) {
      sendError(res, 'Invalid refresh token', 401)
      return
    }

    const tokenMatch = await compareToken(token, user.refresh_token_hash)

    if (!tokenMatch) {
      // A valid-looking but already-rotated token = possible theft.
      // Revoke the session everywhere.
      await supabaseAdmin
        .from('users')
        .update({ refresh_token_hash: null })
        .eq('id', user.id)
      clearRefreshCookie(res)
      sendError(res, 'Invalid refresh token', 401)
      return
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }

    const newAccessToken = generateAccessToken(tokenPayload)
    const newRefreshToken = generateRefreshToken(tokenPayload)

    const newRefreshTokenHash = await hashToken(newRefreshToken)
    await supabaseAdmin
      .from('users')
      .update({ refresh_token_hash: newRefreshTokenHash })
      .eq('id', user.id)

    setRefreshCookie(res, newRefreshToken)

    sendSuccess(res, { accessToken: newAccessToken })
  } catch (error) {
    console.error('Refresh token error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── LOGOUT ───────────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refresh_token

    if (token) {
      try {
        const payload = verifyRefreshToken(token)
        await supabaseAdmin
          .from('users')
          .update({ refresh_token_hash: null })
          .eq('id', payload.userId)
      } catch {
        // Token invalid — clear cookie anyway
      }
    }

    clearRefreshCookie(res)

    sendSuccess(res, null, 200, 'Logged out successfully')
  } catch (error) {
    console.error('Logout error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── FORGOT PASSWORD ──────────────────────────────────────
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', (email as string).toLowerCase())
      .maybeSingle()

    if (user) {
      await supabaseAdmin.auth.resetPasswordForEmail(
        (email as string).toLowerCase(),
        {
          redirectTo: `${env.frontendUrl}/reset-password`,
        },
      )
    }

    sendSuccess(
      res,
      null,
      200,
      'If an account exists with this email, you will receive a reset link.',
    )
  } catch (error) {
    console.error('Forgot password error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── RESET PASSWORD ───────────────────────────────────────
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, new_password } = req.body

    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      sendError(res, 'Invalid or expired reset link. Please request a new one.', 400)
      return
    }

    const passwordHash = await hashPassword(new_password)

    // Update BOTH stores so future logins hit the fast path
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
      password: new_password,
    })
    if (updateError) {
      sendError(res, 'Could not reset the password. Request a new link.', 400)
      return
    }

    await supabaseAdmin
      .from('users')
      .update({
        password_hash: passwordHash,
        refresh_token_hash: null,
      })
      .eq('id', data.user.id)

    sendSuccess(res, null, 200, 'Password reset successfully. Please log in.')
  } catch (error) {
    console.error('Reset password error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── GET ME ───────────────────────────────────────────────
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, full_name, role, plan, avatar_url, job_title, location, bio, email_verified, created_at, notification_prefs',
      )
      .eq('id', req.user!.userId)
      .maybeSingle()

    if (error || !user) {
      sendError(res, 'User not found', 404)
      return
    }

    sendSuccess(res, user)
  } catch (error) {
    console.error('Get me error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE ME ────────────────────────────────────────────
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    const { full_name, job_title, location, bio, avatar_url } = sanitizeObject(req.body)
    const userId = req.user!.userId

    const updates: Record<string, unknown> = {
      full_name,
      job_title: job_title || null,
      location: location || null,
      bio: bio || null,
      updated_at: new Date().toISOString(),
    }

    if (typeof avatar_url === 'string') {
      updates.avatar_url = avatar_url || null
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select(
        'id, email, full_name, role, plan, avatar_url, job_title, location, bio, email_verified, created_at, notification_prefs',
      )
      .single()

    if (error || !data) {
      console.error('Update me error:', error)
      sendError(res, 'Failed to update profile', 500)
      return
    }

    sendSuccess(res, data, 200, 'Profile updated')
  } catch (error) {
    console.error('Update profile error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── CHANGE PASSWORD ──────────────────────────────────────
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { current_password, new_password } = req.body
    const userId = req.user!.userId
    const email = req.user!.email

    // Verify current password via Supabase Auth (authoritative source)
    if (!(await verifySupabasePassword(email, current_password))) {
      sendError(res, 'Current password is incorrect', 401)
      return
    }

    if (current_password === new_password) {
      sendError(res, 'New password must be different from current password', 400)
      return
    }

    // Update Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: new_password },
    )

    if (updateError) {
      sendError(res, 'Failed to update password', 500)
      return
    }

    // Update local mirror + invalidate other sessions
    const passwordHash = await hashPassword(new_password)
    await supabaseAdmin
      .from('users')
      .update({
        password_hash: passwordHash,
        refresh_token_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    sendSuccess(res, null, 200, 'Password updated')
  } catch (error) {
    console.error('Change password error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── UPDATE NOTIFICATIONS ─────────────────────────────────
export async function updateNotifications(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { weekly_summary, product_updates, saved_company_reviews } = req.body
    const userId = req.user!.userId

    const prefs = {
      weekly_summary: Boolean(weekly_summary),
      product_updates: Boolean(product_updates),
      saved_company_reviews: Boolean(saved_company_reviews),
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        notification_prefs: prefs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      sendError(res, 'Failed to update preferences', 500)
      return
    }

    sendSuccess(res, prefs, 200, 'Preferences updated')
  } catch (error) {
    console.error('Update notifications error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── DELETE ACCOUNT ───────────────────────────────────────
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete user error:', error)
      sendError(res, 'Failed to delete account', 500)
      return
    }

    clearRefreshCookie(res)

    sendSuccess(res, null, 200, 'Account deleted')
  } catch (error) {
    console.error('Delete account error:', error)
    sendError(res, 'Server error', 500)
  }
}
