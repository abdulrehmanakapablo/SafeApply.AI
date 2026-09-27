// ============================================================
// FILE: apps/backend/src/utils/response.ts
// PURPOSE: Standard API response helpers
// Ensures every response has the same shape
// Makes frontend parsing predictable and consistent
// ============================================================

import { Response } from 'express'

// Standard success response
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
  })
}

// Standard error response
export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  code?: string
): void {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(code && { code }),
  })
}

// Paginated response wrapper
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
): void {
  res.status(200).json({
    success: true,
    data,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  })
}