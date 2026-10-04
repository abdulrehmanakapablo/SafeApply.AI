import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { messageLimiter } from '../middleware/rateLimiter'
import { messageSchema } from '../validators/recruiter.validator'
import { getThread, listThreads, postMessage } from '../controllers/messages.controller'

const router: RouterType = Router()

router.use(authMiddleware)
router.get('/', listThreads)
router.get('/:applicationId', getThread)
router.post('/:applicationId', messageLimiter, validate(messageSchema), postMessage)

export default router
