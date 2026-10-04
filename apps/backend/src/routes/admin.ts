import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { validate } from '../middleware/validate'
import { adminLimiter } from '../middleware/rateLimiter'
import { updateReviewStatusSchema, updateUserSchema } from '../validators/admin.validator'
import { penaltySchema, verifyCompanySchema } from '../validators/recruiter.validator'
import {
  getStats,
  getReviews,
  updateReviewStatus,
  getUsers,
  updateUser,
  listCompanies,
  setCompanyVerification,
  setCompanyPenalty,
} from '../controllers/admin.controller'

const router: RouterType = Router()

// All admin routes require auth + admin role (role re-read from DB each request).
router.use(authMiddleware, adminOnly, adminLimiter)

router.get('/stats', getStats)
router.get('/reviews', getReviews)
router.patch('/reviews/:id', validate(updateReviewStatusSchema), updateReviewStatus)
router.get('/users', getUsers)
router.patch('/users/:id', validate(updateUserSchema), updateUser)
router.get('/companies', listCompanies)
router.patch('/companies/:id', validate(verifyCompanySchema), setCompanyVerification)
router.patch('/companies/:id/penalty', validate(penaltySchema), setCompanyPenalty)

export default router
