import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
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

const router = Router()

router.get('/', authMiddleware, getApplications)
router.post('/', authMiddleware, validate(createApplicationSchema), createApplication)
router.get('/:id', authMiddleware, getApplication)
router.patch('/:id', authMiddleware, validate(updateApplicationSchema), updateApplication)
router.delete('/:id', authMiddleware, deleteApplication)
router.post('/:id/communication', authMiddleware, validate(addCommunicationSchema), addCommunication)

export default router