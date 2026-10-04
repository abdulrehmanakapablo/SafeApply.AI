import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { optionalAuth, requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { applyLimiter, writeLimiter } from '../middleware/rateLimiter'
import { applySchema } from '../validators/recruiter.validator'
import { confirmHireSchema } from '../validators/interviews.validator'
import { confirmHire } from '../controllers/interviews.controller'
import { applyToJob, getJob, getMyJobApplication, listJobs } from '../controllers/jobs.controller'

const router: RouterType = Router()

router.get('/', listJobs)
router.get('/applications/:id', authMiddleware, requireRole('user', 'admin'), getMyJobApplication)
router.post('/applications/:id/confirm-hire', authMiddleware, requireRole('user', 'admin'), writeLimiter, validate(confirmHireSchema), confirmHire)
router.get('/:id', optionalAuth, getJob)
router.post('/:id/apply', authMiddleware, requireRole('user'), applyLimiter, validate(applySchema), applyToJob)

export default router
