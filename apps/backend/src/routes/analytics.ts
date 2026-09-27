import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getAnalytics } from '../controllers/analytics.controller'

const router = Router()

router.get('/', authMiddleware, getAnalytics)

export default router