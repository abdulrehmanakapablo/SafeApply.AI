import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { adminLimiter, paymentLimiter } from '../middleware/rateLimiter'
import { budgetSchema, manualPaymentSchema, reviewPaymentSchema } from '../validators/billing.validator'
import * as b from '../controllers/billing.controller'

const router: RouterType = Router()
const admin = [authMiddleware, requireRole('admin'), adminLimiter]

router.get('/config', b.getConfig)
router.get('/status', authMiddleware, b.getStatus)
router.get('/history', authMiddleware, b.getHistory)
router.post('/manual', authMiddleware, requireRole('user', 'freelancer', 'client', 'recruiter'), paymentLimiter, validate(manualPaymentSchema), b.submitManual)

router.get('/admin/payments', ...admin, b.adminListPayments)
router.patch('/admin/payments/:id', ...admin, validate(reviewPaymentSchema), b.adminReviewPayment)
router.get('/admin/budget', ...admin, b.adminGetBudget)
router.put('/admin/budget', ...admin, validate(budgetSchema), b.adminSetBudget)

export default router
