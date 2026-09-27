// ============================================================
// FILE: apps/backend/src/services/pdf.service.ts
// PURPOSE: Extract text from PDF and DOCX files
// Uses pdf-parse@2.x (class-based API) + mammoth
// ============================================================

import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

// ─── PDF PARSING ──────────────────────────────────────────
export async function parsePDF(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null

  try {
    parser = new PDFParse({ data: buffer })

    // Explicitly request all pages — passing no params in some
    // pdfjs wrappers silently returns an empty result.
    const result = await parser.getText({})

    // Log the raw shape so we can see what's happening
    console.log('[pdf.service] parse result:', {
      totalPages: result?.total,
      textLength: result?.text?.length ?? 0,
      firstPageLength: result?.pages?.[0]?.text?.length ?? 0,
      sample: result?.text?.slice(0, 200) ?? '(empty)',
    })

    const text = result?.text?.trim() ?? ''

    if (!text) {
      console.warn(
        '[pdf.service] PDF parsed successfully but returned no text. ' +
          'This usually means the PDF is image-based (scanned) and needs OCR.',
      )
    }

    return text
  } catch (error) {
    console.error('PDF parse error:', error)
    throw new Error('Failed to parse PDF file')
  } finally {
    if (parser) {
      try {
        await parser.destroy()
      } catch (destroyError) {
        console.warn('PDF parser destroy warning:', destroyError)
      }
    }
  }
}

// ─── DOCX PARSING ─────────────────────────────────────────
export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value?.trim() || ''

    if (!text) {
      console.warn('[pdf.service] DOCX parsed successfully but returned no text.')
    }

    return text
  } catch (error) {
    console.error('DOCX parse error:', error)
    throw new Error('Failed to parse DOCX file')
  }
}

// ─── UNIFIED ──────────────────────────────────────────────
export async function parseCV(
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  if (mimetype === 'application/pdf') {
    return parsePDF(buffer)
  }
  if (
    mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return parseDOCX(buffer)
  }
  throw new Error(`Unsupported file type: ${mimetype}`)
}