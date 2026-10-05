// FILE: apps/backend/src/validators/auth.validator.ts
// PURPOSE: Joi schemas for every auth-related route.

import Joi from 'joi'
import { normalizeGithub, normalizePhone, normalizePortfolio } from '../utils/profileLinks'

// ─── SIGNUP ──────────────────────────────────────────────
export const signupSchema = Joi.object({
  full_name: Joi.string().trim().min(4).max(100).required().messages({
    'string.min': 'Name must be at least 4 characters',
    'any.required': 'Full name is required',
  }),
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),
  phone: Joi.string()
    .trim()
    .max(24)
    .required()
    .custom((v, h) => normalizePhone(v) ?? h.error('any.invalid'))
    .messages({
      'any.required': 'Phone number is required',
      'string.empty': 'Phone number is required',
      'any.invalid': 'Enter a valid phone number with country code',
    }),
  github_url: Joi.string()
    .trim()
    .max(200)
    .allow('', null)
    .default(null)
    .custom((v, h) => (v ? normalizeGithub(v) ?? h.error('any.invalid') : null))
    .messages({ 'any.invalid': 'Enter a GitHub profile, e.g. github.com/yourname' }),
  portfolio_url: Joi.string()
    .trim()
    .max(300)
    .allow('', null)
    .default(null)
    .custom((v, h) => (v ? normalizePortfolio(v) ?? h.error('any.invalid') : null))
    .messages({ 'any.invalid': 'Enter a full https:// link to your portfolio' }),
  // 'admin' can never be requested here.
  role: Joi.string().valid('user', 'recruiter', 'freelancer', 'client').default('user'),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
  confirm_password: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Please confirm your password',
  }),
})

// ─── LOGIN ───────────────────────────────────────────────
export const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
})

// ─── FORGOT PASSWORD ─────────────────────────────────────
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required',
    }),
})

// ─── RESET PASSWORD ──────────────────────────────────────
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  new_password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'New password is required',
  }),
  confirm_password: Joi.string().valid(Joi.ref('new_password')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Please confirm your password',
  }),
})

// ─── UPDATE PROFILE ──────────────────────────────────────
export const updateProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'any.required': 'Full name is required',
  }),
  job_title: Joi.string().trim().max(100).optional().allow(''),
  location: Joi.string().trim().max(100).optional().allow(''),
  bio: Joi.string().trim().max(300).optional().allow('').messages({
    'string.max': 'Bio must be 300 characters or fewer',
  }),
  avatar_url: Joi.string()
    .max(600_000)
    .pattern(/^(data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+)?$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base':
        'Avatar must be a PNG, JPEG, or WebP data URL',
      'string.max': 'Avatar image is too large — try a smaller file',
    }),
})

// ─── CHANGE PASSWORD ─────────────────────────────────────
export const changePasswordSchema = Joi.object({
  current_password: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
  new_password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'New password must be at least 8 characters',
    'any.required': 'New password is required',
  }),
  confirm_new_password: Joi.string()
    .valid(Joi.ref('new_password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your new password',
    }),
})

// ─── UPDATE NOTIFICATIONS ────────────────────────────────
export const updateNotificationsSchema = Joi.object({
  weekly_summary: Joi.boolean().required(),
  product_updates: Joi.boolean().required(),
  saved_company_reviews: Joi.boolean().required(),
})

// ─── DELETE ACCOUNT ──────────────────────────────────────
export const deleteAccountSchema = Joi.object({
  confirm: Joi.string().valid('DELETE').required().messages({
    'any.only': 'Type DELETE exactly to confirm',
    'any.required': 'Confirmation is required',
  }),
  // Re-authentication: a stolen access token alone must not be able to
  // destroy the account.
  password: Joi.string().max(128).required().messages({
    'any.required': 'Enter your password to confirm',
    'string.empty': 'Enter your password to confirm',
  }),
})