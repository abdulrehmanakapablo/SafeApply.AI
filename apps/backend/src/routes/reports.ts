import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { reportLimiter } from '../middleware/rateLimiter'
import { analyzeReportSchema } from '../validators/reports.validator'
import {
  analyzeCompany,
  getReportHistory,
  getReport,
  deleteReport,
} from '../controllers/reports.controller'

const router = Router()

router.post('/', authMiddleware, reportLimiter, validate(analyzeReportSchema), analyzeCompany)
router.get('/history', authMiddleware, getReportHistory)
router.get('/:id', authMiddleware, getReport)
router.delete('/:id', authMiddleware, deleteReport)

export default router