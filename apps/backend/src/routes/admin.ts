import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { adminOnly } from '../middleware/adminOnly'
import { validate } from '../middleware/validate'
import { updateReviewStatusSchema, updateUserSchema } from '../validators/admin.validator'
import {
  getStats,
  getReviews,
  updateReviewStatus,
  getUsers,
  updateUser,
} from '../controllers/admin.controller'

const router = Router()

// All admin routes require auth + admin role
router.use(authMiddleware, adminOnly)

router.get('/stats', getStats)
router.get('/reviews', getReviews)
router.patch('/reviews/:id', validate(updateReviewStatusSchema), updateReviewStatus)
router.get('/users', getUsers)
router.patch('/users/:id', validate(updateUserSchema), updateUser)

export default router