// ============================================================
// FILE: apps/backend/src/middleware/errorHandler.ts
// PURPOSE: Global Express error handler — catches all unhandled errors
// Must be registered as the LAST middleware in index.ts
// Prevents raw error details leaking to clients in production
// ============================================================

import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Log full error details server-side for debugging
  console.error('❌ Unhandled error:', {
    message: err.message,
    stack: env.isDev ? err.stack : undefined,
    url: req.url,
    method: req.method,
  })

  const statusCode = err.statusCode || 500

  // In production never reveal internal error details to client
  const message = env.isProd
    ? statusCode === 500
      ? 'Internal server error'
      : err.message
    : err.message

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(env.isDev && { stack: err.stack }),
  })
}