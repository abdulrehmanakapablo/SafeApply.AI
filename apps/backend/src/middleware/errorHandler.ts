// ============================================================
// FILE: apps/backend/src/middleware/errorHandler.ts
// PURPOSE: Last-resort error handler. Maps known errors (bad JSON, body too
//          large, upload problems) to clean 4xx responses and never sends
//          stack traces or internal messages to clients in production.
// ============================================================

import { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { env } from '../config/env'

interface AppError extends Error {
  statusCode?: number
  status?: number
  type?: string
  code?: string
  expose?: boolean
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    res.end()
    return
  }

  let status = err.statusCode || err.status || 500
  let message = 'Something went wrong. Please try again.'

  if (err instanceof multer.MulterError) {
    status = 400
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 4 MB.' : 'Upload rejected. Send one PDF or Word file.'
  } else if (err.type === 'entity.too.large') {
    status = 413
    message = 'Request is too large.'
  } else if (err.type === 'entity.parse.failed') {
    status = 400
    message = 'Request body is not valid JSON.'
  } else if (err.code === 'UPLOAD_REJECTED') {
    status = 400
    message = err.message
  } else if (status < 500 && err.expose !== false && err.message) {
    message = err.message
  }

  // Server-side log: no request body, no headers, no query (they can hold
  // tokens or personal data). Path only.
  console.error('Unhandled error', {
    status,
    method: req.method,
    path: req.path,
    message: err.message,
    ...(env.isDev && { stack: err.stack }),
  })

  res.status(status).json({
    success: false,
    error: env.isProd && status >= 500 ? 'Internal server error' : message,
  })
}
