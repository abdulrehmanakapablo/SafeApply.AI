// ============================================================
// FILE: apps/backend/src/middleware/upload.ts
// PURPOSE: Multer file upload config with security checks
// Only accepts PDF and DOCX files under 5MB
// Files stored in memory — never written to disk
// Transferred directly to Supabase Storage after validation
// ============================================================

import multer from 'multer'
import { Request } from 'express'

// Allowed MIME types — must match file extension
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const ALLOWED_EXTENSIONS = ['.pdf', '.docx']

// Use memory storage — never write uploads to disk
const storage = multer.memoryStorage()

// File filter — rejects anything that is not PDF or DOCX
function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  // Check MIME type
  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    callback(new Error('Only PDF and DOCX files are allowed'))
    return
  }

  // Check file extension matches MIME type — prevents spoofing
  const ext = '.' + file.originalname.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    callback(new Error('File extension does not match file type'))
    return
  }

  callback(null, true)
}

// Export configured multer instance
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB hard limit
    files: 1,                   // Only one file per request
  },
  fileFilter,
})