import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { adminLimiter } from '../middleware/rateLimiter'
import { trustOverrideSchema } from '../validators/progress.validator'
import * as p from '../controllers/progress.controller'

const router: RouterType = Router()
const admin = [authMiddleware, requireRole('admin'), adminLimiter]

router.get('/me', authMiddleware, p.myProgress)
router.get('/badges', authMiddleware, p.myBadges)
router.get('/leaderboards', p.leaderboards)
router.get('/admin/trust', ...admin, p.adminTrustList)
router.get('/admin/trust/audit', ...admin, p.adminTrustAudit)
router.patch('/admin/trust/:type/:id', ...admin, validate(trustOverrideSchema), p.adminSetTrust)

export default router
