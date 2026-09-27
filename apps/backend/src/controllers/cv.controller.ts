// ============================================================
// FILE: apps/backend/src/controllers/cv.controller.ts
// PURPOSE: CV upload, parsing, matching, and builder operations
// ============================================================

import { Request, Response } from 'express'
import { supabaseAdmin } from '../config/supabase'
import { parseCV } from '../services/pdf.service'
import { matchCVtoJD, rewriteBullet, generateSummary } from '../services/groq.service'
import { sendSuccess, sendError } from '../utils/response'

// ─── UPLOAD AND PARSE CV ──────────────────────────────────
export async function uploadCV(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, 'No file uploaded', 400)
      return
    }

    // Parse the uploaded file to extract text
    const parsed = await parseCV(req.file.buffer, req.file.mimetype)

    // Store file in Supabase Storage
    const fileName = `${req.user!.userId}/${Date.now()}_${req.file.originalname}`
    const { error: storageError } = await supabaseAdmin.storage
      .from('cv-uploads')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      })

    if (storageError) {
      console.error('Storage upload error:', storageError)
    }

    // Save CV text to profile if requested
    if (req.body.save_cv === 'true' || req.body.save_cv === true) {
      await supabaseAdmin
        .from('users')
        .update({ cv_text: parsed.text })
        .eq('id', req.user!.userId)
    }

    sendSuccess(res, {
      text: parsed.text,
      word_count: parsed.wordCount,
      file_name: req.file.originalname,
    })
  } catch (error) {
    console.error('Upload CV error:', error)
    sendError(res, error instanceof Error ? error.message : 'Failed to process CV', 400)
  }
}

// ─── MATCH CV TO JD ───────────────────────────────────────
export async function matchCV(req: Request, res: Response): Promise<void> {
  try {
    const { cv_text, jd_text, save_cv } = req.body

    // Save CV to profile if requested
    if (save_cv) {
      await supabaseAdmin
        .from('users')
        .update({ cv_text })
        .eq('id', req.user!.userId)
    }

    // Run AI match analysis
    const matchResult = await matchCVtoJD(cv_text, jd_text)

    if (!matchResult) {
      sendError(res, 'AI analysis unavailable. Please check Groq API key.', 503)
      return
    }

    // Log the match for analytics
    await supabaseAdmin.from('cv_matches').insert({
      user_id: req.user!.userId,
      match_score: matchResult.match_percentage || 0,
    }).then(() => {}).catch(() => {}) // Silent fail — not critical

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
      .select('id, name, created_at, updated_at')
      .eq('user_id', req.user!.userId)
      .order('updated_at', { ascending: false })

    if (error) {
      sendError(res, 'Failed to fetch saved CVs', 500)
      return
    }

    sendSuccess(res, data || [])
  } catch (error) {
    console.error('Get saved CVs error:', error)
    sendError(res, 'Server error', 500)
  }
}

// ─── SAVE CV ──────────────────────────────────────────────
export async function saveCV(req: Request, res: Response): Promise<void> {
  try {
    const { name, cv_data } = req.body

    const { data, error } = await supabaseAdmin
      .from('saved_cvs')
      .insert({
        user_id: req.user!.userId,
        name,
        cv_data,
      })
      .select()
      .single()

    if (error) {
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
    const { id } = req.params

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