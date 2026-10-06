// ============================================================
// FILE: apps/backend/src/services/pdf.service.ts
// PURPOSE: Extract text from PDF and DOCX files.
// SECURITY: CV text is personal data, so nothing from the file is logged.
//           Parsing is time-boxed (malformed or "zip bomb" files can hang a
//           parser) and the extracted text is capped.
// ============================================================

import mammoth from 'mammoth'
import { preparePdfRuntime } from '../utils/pdfRuntime'

// pdf-parse is loaded on first use, not at startup, so a problem with it can
// only affect PDF uploads and never takes the whole server down.
//
// Serverless (Vercel): pdf.js runs its "worker" in-process on Node and finds it
// by importing pdf.worker.mjs from a path computed at runtime. The bundler can't
// see that path, so the file is missing and every parse fails. Requiring
// 'pdf-parse/worker' by its literal name makes the bundler ship it; loading it
// registers globalThis.pdfjsWorker, which pdf.js uses instead of the file.
// It also gives a CanvasFactory backed by @napi-rs/canvas.
type PDFParseClass = typeof import('pdf-parse').PDFParse
type WorkerModule = { CanvasFactory?: unknown; getPath?: () => string }
let PDFParse: PDFParseClass | null = null
let canvasFactory: unknown

function workerReady(): boolean {
  const w = (globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker
  return !!w?.WorkerMessageHandler
}

async function loadPdfParse(): Promise<PDFParseClass> {
  if (PDFParse) return PDFParse
  preparePdfRuntime()
  const mod = (await import('pdf-parse')).PDFParse

  let worker: WorkerModule | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    worker = require('pdf-parse/worker') as WorkerModule
    canvasFactory = worker.CanvasFactory
  } catch (e) {
    console.error('[pdf] worker module failed to load:', e instanceof Error ? e.message : String(e))
  }
  // The worker module registers pdf.js's handler asynchronously; wait briefly.
  for (let i = 0; i < 50 && !workerReady(); i++) await new Promise((r) => setTimeout(r, 50))
  if (!workerReady() && worker?.getPath) {
    try {
      mod.setWorker(worker.getPath())
    } catch {
      /* fall through: pdf.js will try its default worker location */
    }
  }

  PDFParse = mod
  return PDFParse
}

// Error text from pdf.js describes the parser failure, never the CV contents.
function reason(e: unknown): string {
  return (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 300)
}

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
  let parser: InstanceType<PDFParseClass> | null = null
  try {
    const Parser = await loadPdfParse()
    parser = new Parser(canvasFactory ? { data: buffer, CanvasFactory: canvasFactory as never } : { data: buffer })
    const result = await withTimeout(parser.getText({}))
    return clean(result?.text ?? '')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CV parsing timed out')) throw error
    console.error('[pdf] parse failed:', reason(error))
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
    console.error('[docx] parse failed:', reason(error))
    throw new Error('Failed to parse DOCX file')
  }
}

export async function parseCV(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') return parsePDF(buffer)
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return parseDOCX(buffer)
  throw new Error('Unsupported file type')
}
