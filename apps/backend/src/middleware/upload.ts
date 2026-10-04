// ============================================================
// FILE: apps/backend/src/middleware/upload.ts
// PURPOSE: CV uploads. PDF/DOCX only, 5 MB, one file, memory only.
//          The browser-supplied MIME type and file name are just claims, so
//          `verifyUpload` checks the real file signature (magic bytes) too.
// ============================================================

import multer from 'multer'
import type { Request, Response, NextFunction } from 'express'

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ALLOWED = new Map([
  [PDF, '.pdf'],
  [DOCX, '.docx'],
])

function rejection(message: string) {
  const e = new Error(message) as Error & { code: string }
  e.code = 'UPLOAD_REJECTED'
  return e
}

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
  if (ALLOWED.get(file.mimetype) !== ext) {
    cb(rejection('Only PDF and Word (.docx) files are allowed.'))
    return
  }
  cb(null, true)
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 5,
    fieldSize: 1024,
    parts: 8,
  },
  fileFilter,
})

/** Runs after multer: the bytes must actually be a PDF or a DOCX. */
export function verifyUpload(req: Request, _res: Response, next: NextFunction): void {
  const f = req.file
  if (!f) return next()
  const b = f.buffer
  const isPdf = b.length > 8 && b.subarray(0, 5).toString('latin1') === '%PDF-'
  // DOCX = ZIP ("PK\x03\x04") that contains word/document.xml
  const isZip = b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
  const isDocx = isZip && b.includes(Buffer.from('word/'))

  if ((f.mimetype === PDF && !isPdf) || (f.mimetype === DOCX && !isDocx)) {
    return next(rejection('That file is damaged or isn’t really a PDF or Word document.'))
  }
  // Encrypted PDFs can't be read and are a common malware wrapper.
  if (isPdf && b.includes(Buffer.from('/Encrypt'))) {
    return next(rejection('Password-protected PDFs can’t be read. Remove the password and try again.'))
  }
  next()
}
