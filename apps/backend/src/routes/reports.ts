// ============================================================
// FILE: apps/backend/src/routes/reports.ts
// PURPOSE: Company report routes — public demo + authenticated CRUD
// ============================================================

import { Router } from 'express'
import type { Router as RouterType } from 'express'
import * as reportsController from '../controllers/reports.controller'
import { authMiddleware } from '../middleware/auth'

const router: RouterType = Router()

// ─── PUBLIC ───────────────────────────────────────────────
// Anonymous landing-page demo. No auth. Rate-limited per IP.
// MUST come before `/:id` or Express will match it as an id.
router.post('/demo-extract', reportsController.demoExtractJD)

// ─── AUTHENTICATED ────────────────────────────────────────
router.post('/', authMiddleware, reportsController.analyzeCompany)
router.get('/history', authMiddleware, reportsController.getReportHistory)
router.get('/:id', authMiddleware, reportsController.getReport)
router.delete('/:id', authMiddleware, reportsController.deleteReport)

export default router