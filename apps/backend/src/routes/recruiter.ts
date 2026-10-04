import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { writeLimiter } from '../middleware/rateLimiter'
import { closeJobSchema, companySchema, createJobSchema, replySchema, stageSchema, updateJobSchema } from '../validators/recruiter.validator'
import {
  closeJob,
  createJob,
  getApplicant,
  getMyCompany,
  getMyJob,
  getStats,
  listCompanyReviews,
  listMyJobs,
  replyToReview,
  saveMyCompany,
  setStage,
  updateJob,
} from '../controllers/recruiter.controller'

import { recruiterTeamRoutes } from './teams'

const router: RouterType = Router()

router.use(authMiddleware, requireRole('recruiter', 'admin'))

router.get('/stats', getStats)
router.get('/company', getMyCompany)
router.put('/company', writeLimiter, validate(companySchema), saveMyCompany)
router.get('/jobs', listMyJobs)
router.post('/jobs', writeLimiter, validate(createJobSchema), createJob)
router.get('/jobs/:id', getMyJob)
router.patch('/jobs/:id', writeLimiter, validate(updateJobSchema), updateJob)
router.post('/jobs/:id/close', writeLimiter, validate(closeJobSchema), closeJob)
router.get('/applicants/:id', getApplicant)
router.patch('/applicants/:id/stage', writeLimiter, validate(stageSchema), setStage)
router.get('/reviews', listCompanyReviews)
router.put('/reviews/:id/reply', writeLimiter, validate(replySchema), replyToReview)
router.use(recruiterTeamRoutes)

export default router
