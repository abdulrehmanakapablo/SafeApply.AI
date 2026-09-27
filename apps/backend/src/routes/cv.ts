import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { upload } from '../middleware/upload'
import {
  matchCVSchema,
  rewriteBulletSchema,
  generateSummarySchema,
  saveCVSchema,
} from '../validators/cv.validator'
import {
  uploadCV,
  matchCV,
  rewriteCVBullet,
  generateCVSummary,
  getSavedCVs,
  saveCV,
  deleteSavedCV,
} from '../controllers/cv.controller'

const router = Router()

router.post('/upload', authMiddleware, upload.single('cv'), uploadCV)
router.post('/match', authMiddleware, validate(matchCVSchema), matchCV)
router.post('/rewrite-bullet', authMiddleware, validate(rewriteBulletSchema), rewriteCVBullet)
router.post('/generate-summary', authMiddleware, validate(generateSummarySchema), generateCVSummary)
router.get('/saved', authMiddleware, getSavedCVs)
router.post('/saved', authMiddleware, validate(saveCVSchema), saveCV)
router.delete('/saved/:id', authMiddleware, deleteSavedCV)

export default router