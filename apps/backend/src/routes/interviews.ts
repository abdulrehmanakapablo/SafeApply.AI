import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { writeLimiter } from '../middleware/rateLimiter'
import { cancelInterviewSchema, confirmSchema, createInterviewSchema, pickSlotSchema, rescheduleSchema, slotsSchema } from '../validators/interviews.validator'
import * as i from '../controllers/interviews.controller'

const router: RouterType = Router()
router.use(authMiddleware)

router.get('/', i.listInterviews)
router.post('/', requireRole('recruiter', 'admin'), writeLimiter, validate(createInterviewSchema), i.createInterview)
router.get('/:id', i.getInterview)
router.post('/:id/slots', writeLimiter, validate(slotsSchema), i.proposeSlots)
router.post('/:id/pick', writeLimiter, validate(pickSlotSchema), i.pickSlot)
router.post('/:id/reschedule', writeLimiter, validate(rescheduleSchema), i.requestReschedule)
router.post('/:id/cancel', writeLimiter, validate(cancelInterviewSchema), i.cancelInterview)
router.post('/:id/confirm', writeLimiter, validate(confirmSchema), i.confirmInterview)

export default router
