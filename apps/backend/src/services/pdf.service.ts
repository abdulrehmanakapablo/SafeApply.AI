// ============================================================
// FILE: apps/backend/src/services/pdf.service.ts
// PURPOSE: Extract text from PDF and DOCX files.
// SECURITY: CV text is personal data, so nothing from the file is logged.
//           Parsing is time-boxed (malformed or "zip bomb" files can hang a
//           parser) and the extracted text is capped.
// ============================================================

import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

const PARSE_TIMEOUT_MS = 15_000
const MAX_TEXT_CHARS = 60_000

function withTimeout<T>(p: Promise<T>): Promise<T> {
  let t: NodeJS.Timeout
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error('CV parsing timed out. Try a simpler file or paste the text.')), PARSE_TIMEOUT_MS)
    }),
  ]).finally(() => clearTimeout(t))
}

function clean(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_TEXT_CHARS)
}

export async function parsePDF(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null
  try {
    parser = new PDFParse({ data: buffer })
    const result = await withTimeout(parser.getText({}))
    return clean(result?.text ?? '')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CV parsing timed out')) throw error
    console.error('PDF parse error')
    throw new Error('Failed to parse PDF file')
  } finally {
    if (parser) {
      try {
        await parser.destroy()
      } catch {
        /* ignore */
      }
    }
  }
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await withTimeout(mammoth.extractRawText({ buffer }))
    return clean(result.value || '')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CV parsing timed out')) throw error
    console.error('DOCX parse error')
    throw new Error('Failed to parse DOCX file')
  }
}

export async function parseCV(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') return parsePDF(buffer)
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDOCX(buffer)
  throw new Error('Unsupported file type')
}
