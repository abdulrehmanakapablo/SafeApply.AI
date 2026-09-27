// FILE: apps/backend/src/controllers/auth.controller.ts
// PURPOSE: Auth controller — signup, login, refresh, logout, forgot/reset,
//          get me, update me, change password, update notifications, delete account.
// NOTE: Email verification is disabled for the pilot — signup creates a
//       pre-verified user. Re-enable by flipping `email_confirm` to false and
//       restoring the check in `login`.

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { hashPassword, comparePassword, hashToken } from '../utils/hash'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt'
import { sanitizeObject } from '../utils/sanitize'
import { sendSuccess, sendError } from '../utils/response'

// ─── SIGNUP ───────────────────────────────────────────────
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { full_name, email, password, phone } = sanitizeObject(req.body)

    // Reject if email already taken
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', (email as string).toLowerCase())
      .single()

    if (existingUser) {
      sendError(res, 'An account with this email already exists', 409)
      return
    }

    // Create user in Supabase Auth — email_confirm true skips verification
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: (email as string).toLowerCase(),
        password,
        email_confirm: true,
      })

    if (authError || !authData.user) {
      console.error('Supabase createUser error:', authError)
      sendError(res, 'Failed to create account', 500)
      return
    }

    // Hash password for our users table (defense in depth)
    const passwordHash = await hashPassword(password)

    // Insert user profile row
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email: (email as string).toLowerCase(),
      full_name: (full_name as string).trim(),
      phone: phone && typeof phone === 'string' ? phone : null,
      password_hash: passwordHash,
      role: 'user',
      plan: 'free',
      email_verified: true,
    })

    if (insertError) {
      // Roll back — delete the auth user if profile insert fails
      console.error('Users insert error:', insertError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      sendError(res, 'Failed to create account', 500)
      return
    }

    sendSuccess(res, null, 201, 'Account created successfully')
  } catch (error) {
    console.error('Signup error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── LOGIN ────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, full_name, role, plan, password_hash, avatar_url, job_title, location, bio, email_verified, created_at'
      )
      .eq('email', (email as string).toLowerCase())
      .single()

    // Same error for wrong email or wrong password — prevents user enumeration
    if (error || !user || !user.password_hash) {
      sendError(res, 'Invalid email or password', 401)
      return
    }

    const passwordMatch = await comparePassword(password, user.password_hash)
    if (!passwordMatch) {
      sendError(res, 'Invalid email or password', 401)
      return
    }

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

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

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
      sendError(res, 'Invalid refresh token', 401)
      return
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, plan, refresh_token_hash')
      .eq('id', payload.userId)
      .single()

    if (error || !user || !user.refresh_token_hash) {
      sendError(res, 'Invalid refresh token', 401)
      return
    }

    const { compareToken } = await import('../utils/hash')
    const tokenMatch = await compareToken(token, user.refresh_token_hash)

    if (!tokenMatch) {
      await supabaseAdmin
        .from('users')
        .update({ refresh_token_hash: null })
        .eq('id', user.id)
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

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

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

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })

    sendSuccess(res, null, 200, 'Logged out successfully')
  } catch (error) {
    console.error('Logout error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── FORGOT PASSWORD ──────────────────────────────────────
// ─── FORGOT PASSWORD ──────────────────────────────────────
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', (email as string).toLowerCase())
      .single()

    if (user) {
      // Supabase sends the recovery email automatically.
      // The email link points to the redirectTo URL with the recovery token
      // in the URL fragment (#access_token=...&type=recovery).
      await supabaseAdmin.auth.resetPasswordForEmail(
        (email as string).toLowerCase(),
        {
          redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password`,
        }
      )
    }

    // Same response regardless of whether the email exists
    sendSuccess(
      res,
      null,
      200,
      'If an account exists with this email, you will receive a reset link.'
    )
  } catch (error) {
    console.error('Forgot password error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── RESET PASSWORD ───────────────────────────────────────
// ─── RESET PASSWORD ───────────────────────────────────────
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, new_password } = req.body

    // `token` is the access_token Supabase put in the recovery link fragment.
    // Verify it belongs to a real user via the admin API.
    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      sendError(res, 'Invalid or expired reset link. Please request a new one.', 400)
      return
    }

    const passwordHash = await hashPassword(new_password)

    // Update our own hash + invalidate all existing sessions
    await supabaseAdmin
      .from('users')
      .update({
        password_hash: passwordHash,
        refresh_token_hash: null,
      })
      .eq('id', data.user.id)

    // Update the Supabase auth password
    await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
      password: new_password,
    })

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
        'id, email, full_name, role, plan, avatar_url, job_title, location, bio, email_verified, created_at, notification_prefs'
      )
      .eq('id', req.user!.userId)
      .single()

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
    const { full_name, job_title, location, bio, avatar_url } = req.body
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
        'id, email, full_name, role, plan, avatar_url, job_title, location, bio, email_verified, created_at, notification_prefs'
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

    // Verify current password
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email,
        password: current_password,
      })

    if (signInError || !signInData.user) {
      sendError(res, 'Current password is incorrect', 401)
      return
    }

    if (current_password === new_password) {
      sendError(res, 'New password must be different from current password', 400)
      return
    }

    // Update in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: new_password }
    )

    if (updateError) {
      sendError(res, 'Failed to update password', 500)
      return
    }

    // Update our own hash + invalidate all other sessions
    const passwordHash = await hashPassword(new_password)
    await supabaseAdmin
      .from('users')
      .update({ password_hash: passwordHash, refresh_token_hash: null })
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
  res: Response
): Promise<void> {
  try {
    const { weekly_summary, product_updates, saved_company_reviews } = req.body
    const userId = req.user!.userId

    const prefs = {
      weekly_summary,
      product_updates,
      saved_company_reviews,
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

    // Cascade rules will remove all related rows
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete user error:', error)
      sendError(res, 'Failed to delete account', 500)
      return
    }

    // Clear any refresh cookie
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    })

    sendSuccess(res, null, 200, 'Account deleted')
  } catch (error) {
    console.error('Delete account error:', error)
    sendError(res, 'Server error', 500)
  }
}