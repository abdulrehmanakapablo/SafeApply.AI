// ============================================================
// FILE: apps/backend/src/services/pdf.service.ts
// PURPOSE: Parses uploaded PDF and DOCX files to extract text
// Used in CV upload flow to get raw text from CV files
// pdf-parse for PDFs, mammoth for DOCX files
// ============================================================

import mammoth from 'mammoth'

interface ParseResult {
  text: string
  wordCount: number
}

// Parse PDF buffer to plain text
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  try {
    // Dynamic import to avoid issues with pdf-parse module loading
    const pdfParse = await import('pdf-parse')
    const data = await pdfParse.default(buffer)
    const text = data.text.trim()
    const wordCount = text.split(/\s+/).filter(Boolean).length

    return { text, wordCount }
  } catch (error) {
    console.error('PDF parse error:', error)
    throw new Error('Failed to parse PDF file')
  }
}

// Parse DOCX buffer to plain text
export async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value.trim()
    const wordCount = text.split(/\s+/).filter(Boolean).length

    return { text, wordCount }
  } catch (error) {
    console.error('DOCX parse error:', error)
    throw new Error('Failed to parse DOCX file')
  }
}

// Auto detect file type and parse accordingly
export async function parseCV(
  buffer: Buffer,
  mimetype: string
): Promise<ParseResult> {
  if (mimetype === 'application/pdf') {
    return parsePDF(buffer)
  }

  if (
    mimetype ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return parseDOCX(buffer)
  }

  throw new Error('Unsupported file type. Please upload PDF or DOCX.')
}