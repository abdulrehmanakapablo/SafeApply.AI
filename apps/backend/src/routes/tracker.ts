import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { writeLimiter } from '../middleware/rateLimiter'
import {
  createApplicationSchema,
  updateApplicationSchema,
  addCommunicationSchema,
} from '../validators/tracker.validator'
import {
  getApplications,
  createApplication,
  getApplication,
  updateApplication,
  deleteApplication,
  addCommunication,
} from '../controllers/tracker.controller'

const router: RouterType = Router()

router.use(authMiddleware, requireRole('user', 'admin'))

router.get('/', getApplications)
router.post('/', writeLimiter, validate(createApplicationSchema), createApplication)
router.get('/:id', getApplication)
router.patch('/:id', writeLimiter, validate(updateApplicationSchema), updateApplication)
router.delete('/:id', writeLimiter, deleteApplication)
router.post('/:id/communication', writeLimiter, validate(addCommunicationSchema), addCommunication)

export default router
