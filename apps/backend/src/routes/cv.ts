// ============================================================
// FILE: apps/backend/src/routes/cv.ts
// ============================================================

import { Router } from 'express'
import type { Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { upload, verifyUpload } from '../middleware/upload'
import { aiLimiter, uploadLimiter, writeLimiter } from '../middleware/rateLimiter'
import {
  matchCVSchema,
  rewriteBulletSchema,
  generateSummarySchema,
  structureCVSchema,
  saveCVSchema,
} from '../validators/cv.validator'
import {
  uploadCV,
  getCurrentCV,
  clearCV,
  structureCV,
  matchCV,
  rewriteCVBullet,
  generateCVSummary,
  getSavedCVs,
  saveCV,
  deleteSavedCV,
} from '../controllers/cv.controller'

const router: RouterType = Router()

router.use(authMiddleware, requireRole('user', 'admin'))

router.post('/upload', uploadLimiter, upload.single('cv'), verifyUpload, uploadCV)
router.get('/current', getCurrentCV)
router.post('/clear', writeLimiter, clearCV)

router.post('/structure', aiLimiter, validate(structureCVSchema), structureCV)
router.post('/match', aiLimiter, validate(matchCVSchema), matchCV)
router.post('/rewrite-bullet', aiLimiter, validate(rewriteBulletSchema), rewriteCVBullet)
router.post('/generate-summary', aiLimiter, validate(generateSummarySchema), generateCVSummary)

router.get('/saved', getSavedCVs)
router.post('/saved', writeLimiter, validate(saveCVSchema), saveCV)
router.delete('/saved/:id', writeLimiter, deleteSavedCV)

export default router
