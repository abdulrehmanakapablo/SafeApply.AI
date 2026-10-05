// FILE: apps/backend/src/routes/auth.ts
// PURPOSE: Auth routes. Every public endpoint is rate limited.

import { Router } from 'express'
import type { Router as ExpressRouter } from 'express'
import {
  signup,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  updateNotifications,
  deleteAccount,
} from '../controllers/auth.controller'
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
  updateNotificationsSchema,
  deleteAccountSchema,
} from '../validators/auth.validator'
import { validate } from '../middleware/validate'
import { authMiddleware } from '../middleware/auth'
import {
  authLimiter,
  loginAccountLimiter,
  loginEmailLimiter,
  signupLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshLimiter,
  writeLimiter,
} from '../middleware/rateLimiter'

const router: ExpressRouter = Router()

// ─── PUBLIC ───────────────────────────────────────────────
router.post('/signup', signupLimiter, authLimiter, validate(signupSchema), signup)
router.post('/login', authLimiter, validate(loginSchema), loginAccountLimiter, loginEmailLimiter, login)
router.post('/refresh', refreshLimiter, refreshToken)
router.post('/logout', refreshLimiter, logout)
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword)
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), resetPassword)

// ─── PROTECTED ────────────────────────────────────────────
router.get('/me', authMiddleware, getMe)
router.patch('/me', authMiddleware, writeLimiter, validate(updateProfileSchema), updateMe)
router.delete('/me', authMiddleware, authLimiter, validate(deleteAccountSchema), deleteAccount)
router.post('/change-password', authMiddleware, authLimiter, validate(changePasswordSchema), changePassword)
router.patch('/notifications', authMiddleware, writeLimiter, validate(updateNotificationsSchema), updateNotifications)

export default router
