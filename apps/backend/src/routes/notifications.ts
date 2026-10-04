import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { writeLimiter } from '../middleware/rateLimiter'
import { markReadSchema } from '../validators/recruiter.validator'
import { listNotifications, markRead } from '../controllers/notifications.controller'

const router: RouterType = Router()

router.use(authMiddleware)
router.get('/', listNotifications)
router.post('/read', writeLimiter, validate(markReadSchema), markRead)

export default router
