import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { analyticsLimiter } from '../middleware/rateLimiter'
import { getAnalytics } from '../controllers/analytics.controller'

const router: RouterType = Router()

router.get('/', authMiddleware, requireRole('user', 'admin'), analyticsLimiter, getAnalytics)

export default router
