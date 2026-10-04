// ============================================================
// FILE: apps/backend/src/controllers/cv.controller.ts
// PURPOSE: CV upload, parsing, matching, structuring, builder ops.
// /structure streams NDJSON progress events.
// Cached structures carry `_v` — bumping STRUCTURE_VERSION invalidates
// every stale cache automatically (no SQL needed).
// Enforces 10 free CV matches per user (until paid plans ship).
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { parseCV } from '../services/pdf.service'
import {
  matchCVtoJD,
  rewriteBullet,
  generateSummary,
  structureCVText,
} from '../services/groq.service'
import { checkFreeLimit, sendLimitError } from '../utils/usage'
import { sendSuccess, sendError } from '../utils/response'
import { randomUUID } from 'crypto'
import { uuidParam } from '../utils/sanitize'

const STRUCTURE_VERSION = 3

function isCurrentStructure(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { _v?: number })._v === STRUCTURE_VERSION,
  )
}

// ─── UPLOAD AND PARSE CV ──────────────────────────────────
export async function uploadCV(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, 'No file uploaded', 400)
      return
    }

    const text = await parseCV(req.file.buffer, req.file.mimetype)

    if (!text || text.trim().length === 0) {
      sendError(
        res,
        'No readable text found in this file. If it is a scanned PDF, try exporting a text-based version or paste the text manually.',
        400,
      )
      return
    }

    // Never trust the browser's file name in a storage path ("../", odd
    // unicode, huge names). Random id + fixed extension only.
    const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : 'docx'
    const fileName = `${req.user!.userId}/${randomUUID()}.${ext}`
    const displayName = req.file.originalname.replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || `cv.${ext}`
    const { error: storageError } = await supabaseAdmin.storage
      .from('cv-uploads')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (storageError) {
      console.error('Storage upload error:', storageError.message)
    }

    if (req.body.save_cv === 'true' || req.body.save_cv === true) {
      await supabaseAdmin
        .from('users')
        .update({ cv_text: text, cv_structured: null })
        .eq('id', req.user!.userId)
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length

    sendSuccess(res, {
      text,
      word_count: wordCount,
      char_count: text.length,
      file_name: displayName,
    })
  } catch (error) {
    console.error('Upload CV error:', error instanceof Error ? error.message : error)
    // Only our own parser messages are shown; anything else stays generic.
    const msg = error instanceof Error && /^(Failed to parse|Unsupported file|CV parsing timed out)/.test(error.message) ? error.message : 'We couldn’t read that file.'
    sendError(res, msg, 400)
  }
}

// ─── GET CURRENT CV ───────────────────────────────────────
// Stale-version structures are hidden so the builder offers a re-parse
// instead of loading a broken cached result.
export async function getCurrentCV(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('cv_text, cv_structured')
      .eq('id', req.user!.userId)
      .single()

    if (error) {
      console.error('Get current CV error:', error)
      sendError(res, 'Failed to load CV', 500)
      return
    }

    sendSuccess(res, {
      cv_text: data?.cv_text || null,
      cv_structured: isCurrentStructure(data?.cv_structured)
        ? data?.cv_structured
        : null,
    })
  } catch (error) {
    console.error('Get current CV error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── CLEAR CV ─────────────────────────────────────────────
export async function clearCV(req: Request, res: Response): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ cv_text: null, cv_structured: null })
      .eq('id', req.user!.userId)

    if (error) {
      console.error('Clear CV DB error:', error)
      sendError(res, 'Failed to clear CV', 500)
      return
    }

    sendSuccess(res, null, 200, 'CV cleared')
  } catch (error) {
    console.error('Clear CV error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── STRUCTURE CV (streams NDJSON progress events) ───────
// Response format: newline-delimited JSON.
//   {"type":"start","total_chunks":2}\n
//   {"type":"progress","chunk":1,"total":2,"stats":{...}}\n   ← local parse
//   {"type":"progress","chunk":2,"total":2,"stats":{...}}\n   ← AI labelling
//   {"type":"merging","chunks_done":2,"chunks_total":2}\n
//   {"type":"done","data":{...}}\n
// Or on cache hit:
//   {"type":"cached","data":{...}}\n
// Or on failure:
//   {"type":"error","message":"..."}\n
export async function structureCV(req: Request, res: Response): Promise<void> {
  const write = (obj: unknown) => {
    res.write(JSON.stringify(obj) + '\n')
  }

  try {
    const { cv_text, force } = req.body

    if (!cv_text || typeof cv_text !== 'string') {
      res.status(400).json({ success: false, error: 'CV text is required' })
      return
    }

    const trimmed = cv_text.trim()
    if (trimmed.length < 100) {
      res
        .status(400)
        .json({ success: false, error: 'CV text is too short to structure.' })
      return
    }
    if (trimmed.length > 50000) {
      res
        .status(400)
        .json({ success: false, error: 'CV text is too long (max 50,000 chars).' })
      return
    }

    // ── Cache check (same text + current parser version) ──
    if (!force) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('cv_text, cv_structured')
        .eq('id', req.user!.userId)
        .single()

      if (
        isCurrentStructure(existing?.cv_structured) &&
        existing?.cv_text &&
        existing.cv_text.trim() === trimmed
      ) {
        res.status(200)
        res.setHeader('Content-Type', 'application/x-ndjson')
        res.setHeader('Cache-Control', 'no-cache')
        write({ type: 'cached', data: existing.cv_structured })
        res.end()
        return
      }
    }

    // ── Streaming headers ──
    res.status(200)
    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    console.log('[structureCV] running fresh structure (streaming)')

    const structured = await structureCVText(trimmed, (event) => {
      try {
        write(event)
      } catch (err) {
        console.warn('[structureCV] failed to write progress event:', err)
      }
    })

    if (!structured) {
      write({
        type: 'error',
        message: 'CV structuring failed. Please try again in a moment.',
      })
      res.end()
      return
    }

    const payload = { ...structured, _v: STRUCTURE_VERSION }

    await supabaseAdmin
      .from('users')
      .update({ cv_text: trimmed, cv_structured: payload })
      .eq('id', req.user!.userId)

    write({ type: 'done', data: payload })
    res.end()
  } catch (error) {
    console.error('Structure CV error:', error)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to structure CV' })
    } else {
      try {
        write({ type: 'error', message: 'Failed to structure CV' })
      } catch {
        /* ignore */
      }
      res.end()
    }
  }
}

// ─── MATCH CV TO JD ───────────────────────────────────────
export async function matchCV(req: Request, res: Response): Promise<void> {
  try {
    const limit = await checkFreeLimit(req.user!.userId, 'cv_matches')
    if (!limit.allowed) return sendLimitError(res, limit, 'cv_matches')

    const { cv_text, jd_text, save_cv } = req.body

    if (save_cv) {
      await supabaseAdmin
        .from('users')
        .update({ cv_text })
        .eq('id', req.user!.userId)
    }

    const matchResult = await matchCVtoJD(cv_text, jd_text)

    if (!matchResult) {
      sendError(
        res,
        'AI analysis unavailable right now (rate limit or model error). Wait a minute and try again.',
        503,
      )
      return
    }

    try {
      await supabaseAdmin.from('cv_matches').insert({
        user_id: req.user!.userId,
        match_score: (matchResult.match_percentage as number) || 0,
        jd_preview: typeof jd_text === 'string' ? jd_text.slice(0, 200) : null,
      })
    } catch (logError) {
      console.warn('Failed to log cv_match:', logError)
    }

    sendSuccess(res, matchResult)
  } catch (error) {
    console.error('Match CV error:', error)
    sendError(res, 'Failed to analyze CV', 500)
  }
}

// ─── REWRITE BULLET ───────────────────────────────────────
export async function rewriteCVBullet(req: Request, res: Response): Promise<void> {
  try {
    const { original_bullet, jd_context } = req.body

    const rewritten = await rewriteBullet(original_bullet, jd_context || '')

    if (!rewritten) {
      sendError(res, 'AI rewrite unavailable', 503)
      return
    }

    sendSuccess(res, { original: original_bullet, rewritten })
  } catch (error) {
    console.error('Rewrite bullet error:', error)
    sendError(res, 'Failed to rewrite bullet', 500)
  }
}

// ─── GENERATE SUMMARY ─────────────────────────────────────
export async function generateCVSummary(req: Request, res: Response): Promise<void> {
  try {
    const { background_text, target_role } = req.body

    const summary = await generateSummary(background_text, target_role)

    if (!summary) {
      sendError(res, 'AI summary unavailable', 503)
      return
    }

    sendSuccess(res, { summary })
  } catch (error) {
    console.error('Generate summary error:', error)
    sendError(res, 'Failed to generate summary', 500)
  }
}

// ─── GET SAVED CVs ────────────────────────────────────────
export async function getSavedCVs(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_cvs')
      .select('id, name, cv_data, created_at, updated_at')
      .eq('user_id', req.user!.userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Get saved CVs DB error:', error)
      sendError(res, 'Failed to fetch saved CVs', 500)
      return
    }

    const normalized = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      cv_data: row.cv_data || {
        personal: {
          full_name: '',
          job_title: '',
          email: '',
          phone: '',
          location: '',
          linkedin: '',
          github: '',
          summary: '',
        },
        experience: [],
        education: [],
        skills: [],
        projects: [],
        certifications: [],
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    sendSuccess(res, normalized)
  } catch (error) {
    console.error('Get saved CVs error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── SAVE CV ──────────────────────────────────────────────
export async function saveCV(req: Request, res: Response): Promise<void> {
  try {
    const { name, cv_data } = req.body

    if (!name || typeof name !== 'string') {
      sendError(res, 'CV name is required', 400)
      return
    }

    if (!cv_data || typeof cv_data !== 'object') {
      sendError(res, 'CV data is required', 400)
      return
    }

    const { data, error } = await supabaseAdmin
      .from('saved_cvs')
      .insert({
        user_id: req.user!.userId,
        name: name.trim().slice(0, 200),
        cv_data,
      })
      .select('id, name, cv_data, created_at, updated_at')
      .single()

    if (error) {
      console.error('Save CV DB error:', error)
      sendError(res, 'Failed to save CV', 500)
      return
    }

    sendSuccess(res, data, 201)
  } catch (error) {
    console.error('Save CV error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── DELETE SAVED CV ──────────────────────────────────────
export async function deleteSavedCV(req: Request, res: Response): Promise<void> {
  try {
    const id = uuidParam(req.params.id)
    if (!id) {
      sendError(res, 'Invalid id', 400)
      return
    }

    const { error } = await supabaseAdmin
      .from('saved_cvs')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.userId)

    if (error) {
      sendError(res, 'Failed to delete CV', 500)
      return
    }

    sendSuccess(res, null, 200, 'CV deleted')
  } catch (error) {
    console.error('Delete CV error:', error)
    sendError(res, 'Server error', 500)
  }
}