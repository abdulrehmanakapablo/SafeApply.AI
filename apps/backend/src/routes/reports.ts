// ============================================================
// FILE: apps/backend/src/routes/reports.ts
// PURPOSE: Company report routes — public demo + authenticated CRUD
// ============================================================

import { Router } from 'express'
import type { Router as RouterType } from 'express'
import * as reportsController from '../controllers/reports.controller'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { analyzeReportSchema, demoExtractSchema } from '../validators/reports.validator'
import { aiLimiter, demoLimiter, writeLimiter } from '../middleware/rateLimiter'

const router: RouterType = Router()
// Company reports are a job-seeker tool; other roles are refused.
const seeker = [authMiddleware, requireRole('user', 'admin')]

// ─── PUBLIC ───────────────────────────────────────────────
// Anonymous landing-page demo. MUST come before `/:id`.
router.post('/demo-extract', demoLimiter, validate(demoExtractSchema), reportsController.demoExtractJD)

// ─── AUTHENTICATED ────────────────────────────────────────
router.post('/', ...seeker, aiLimiter, validate(analyzeReportSchema), reportsController.analyzeCompany)
router.get('/history', ...seeker, reportsController.getReportHistory)
router.get('/:id', ...seeker, reportsController.getReport)
router.delete('/:id', ...seeker, writeLimiter, reportsController.deleteReport)

export default router
