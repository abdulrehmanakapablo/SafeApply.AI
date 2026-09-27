// FILE: apps/backend/src/routes/auth.ts
// PURPOSE: All auth routes. Public: signup, login, refresh, logout, forgot, reset.
//          Protected: me (GET/PATCH), change-password, notifications, delete account.

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
  forgotPasswordLimiter,
} from '../middleware/rateLimiter'

// Explicit type annotation prevents TS2883 — the compiler needs a named
// type for declaration emit instead of inferring from pnpm's nested
// @types/express-serve-static-core path.
const router: ExpressRouter = Router()

// ─── PUBLIC ───────────────────────────────────────────────
router.post('/signup', authLimiter, validate(signupSchema), signup)
router.post('/login', authLimiter, validate(loginSchema), login)
router.post('/refresh', refreshToken)
router.post('/logout', logout)
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
)
router.post('/reset-password', validate(resetPasswordSchema), resetPassword)

// ─── PROTECTED ────────────────────────────────────────────
router.get('/me', authMiddleware, getMe)
router.patch('/me', authMiddleware, validate(updateProfileSchema), updateMe)
router.delete(
  '/me',
  authMiddleware,
  validate(deleteAccountSchema),
  deleteAccount
)
router.post(
  '/change-password',
  authMiddleware,
  validate(changePasswordSchema),
  changePassword
)
router.patch(
  '/notifications',
  authMiddleware,
  validate(updateNotificationsSchema),
  updateNotifications
)

export default router