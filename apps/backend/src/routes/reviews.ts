import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createReviewSchema } from '../validators/reviews.validator'
import {
  getCompanies,
  getCompany,
  getCompanyReviews,
  createReview,
  markHelpful,
} from '../controllers/reviews.controller'

const router = Router()

// Public routes — no auth required
router.get('/companies', getCompanies)
router.get('/companies/:slug', getCompany)
router.get('/companies/:slug/reviews', getCompanyReviews)

// Protected routes — auth required
router.post('/', authMiddleware, validate(createReviewSchema), createReview)
router.post('/:id/helpful', markHelpful)

export default router