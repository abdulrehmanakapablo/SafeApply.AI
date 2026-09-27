// ============================================================
// FILE: apps/backend/src/middleware/validate.ts
// PURPOSE: Joi validation middleware factory
// Pass a Joi schema and it validates req.body automatically
// Returns 400 with specific field errors if validation fails
// ============================================================

import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'

// Factory function — returns middleware for the given schema
export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all errors not just first
      stripUnknown: true, // Remove unknown fields from body
    })

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }))

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      })
      return
    }

    // Replace req.body with validated and sanitized value
    req.body = value
    next()
  }
}