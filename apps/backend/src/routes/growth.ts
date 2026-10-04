// Public growth pages (no auth), report sharing, disputes.
import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { adminLimiter, writeLimiter } from '../middleware/rateLimiter'
import { disputeSchema, resolveDisputeSchema } from '../validators/growth.validator'
import * as g from '../controllers/growth.controller'

/** /api/public */
export const publicRoutes: RouterType = Router()
publicRoutes.get('/stats', g.publicStats)
publicRoutes.get('/companies/:slug/ghosting', g.companyGhosting)
publicRoutes.get('/companies/:slug/interviews', g.companyInterviews)
publicRoutes.get('/companies/:slug/salaries', g.companySalaries)
publicRoutes.get('/employers/:slug', g.employerCard)
publicRoutes.get('/reports/:shareId', g.publicReport)

/** /api/share (owner turns a report's public link on/off) */
export const shareRoutes: RouterType = Router()
shareRoutes.post('/reports/:id', authMiddleware, requireRole('user', 'admin'), writeLimiter, g.shareReport)
shareRoutes.delete('/reports/:id', authMiddleware, requireRole('user', 'admin'), writeLimiter, g.unshareReport)

/** /api/disputes */
export const disputeRoutes: RouterType = Router()
const admin = [authMiddleware, requireRole('admin'), adminLimiter]
disputeRoutes.get('/admin', ...admin, g.adminDisputes)
disputeRoutes.patch('/admin/:id', ...admin, validate(resolveDisputeSchema), g.resolveDispute)
disputeRoutes.get('/', authMiddleware, g.myDisputes)
disputeRoutes.post('/', authMiddleware, writeLimiter, validate(disputeSchema), g.createDispute)
