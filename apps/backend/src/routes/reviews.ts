import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { createReviewSchema } from '../validators/reviews.validator'
import { helpfulLimiter, reviewLimiter } from '../middleware/rateLimiter'
import {
  getCompanies,
  getCompany,
  getCompanyReviews,
  createReview,
  markHelpful,
} from '../controllers/reviews.controller'

const router: RouterType = Router()

// Public reads
router.get('/companies', getCompanies)
router.get('/companies/:slug', getCompany)
router.get('/companies/:slug/reviews', getCompanyReviews)

// Writes need an account. "Helpful" votes too: anonymous votes were
// unlimited and could be scripted to push any review to the top.
// Only job seekers review employers, so companies can't review themselves or rivals.
router.post('/', authMiddleware, requireRole('user', 'admin'), reviewLimiter, validate(createReviewSchema), createReview)
router.post('/:id/helpful', authMiddleware, helpfulLimiter, markHelpful)

export default router
