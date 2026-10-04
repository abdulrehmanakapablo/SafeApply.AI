import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { optionalAuth, requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { adminLimiter, messageLimiter, proposalLimiter, writeLimiter } from '../middleware/rateLimiter'
import {
  adminProjectSchema,
  cancelSchema,
  contractMessageSchema,
  createProjectSchema,
  freelanceReviewSchema,
  hireSchema,
  profileSchema,
  proposalSchema,
  proposalStatusSchema,
  revisionSchema,
  submitMilestoneSchema,
  updateProjectSchema,
  inviteSchema,
  respondInviteSchema,
  paymentLogSchema,
  confirmPaymentSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
} from '../validators/freelance.validator'
import * as t from '../controllers/trust.controller'
import * as f from '../controllers/freelance.controller'
import * as c from '../controllers/contracts.controller'

const router: RouterType = Router()
const freelancer = [authMiddleware, requireRole('freelancer', 'admin')]
const client = [authMiddleware, requireRole('client', 'admin')]

// Public
router.get('/projects', f.listProjects)
router.get('/projects/:id', optionalAuth, f.getProject)
router.get('/freelancers/:id', f.getFreelancer)

// Freelancer
router.get('/me/profile', ...freelancer, f.getMyProfile)
router.put('/me/profile', ...freelancer, writeLimiter, validate(profileSchema), f.saveMyProfile)
router.get('/me/stats', ...freelancer, f.freelancerStats)
router.get('/me/proposals', ...freelancer, f.listMyProposals)
router.post('/projects/:id/proposals', ...freelancer, proposalLimiter, validate(proposalSchema), f.submitProposal)
router.patch('/proposals/:id/withdraw', ...freelancer, writeLimiter, f.withdrawProposal)

// Client
router.get('/client/stats', ...client, f.clientStats)
router.get('/client/projects', ...client, f.listClientProjects)
router.post('/client/projects', ...client, writeLimiter, validate(createProjectSchema), f.createProject)
router.get('/client/projects/:id', ...client, f.getClientProject)
router.patch('/client/projects/:id', ...client, writeLimiter, validate(updateProjectSchema), f.updateProject)
router.patch('/client/proposals/:id', ...client, writeLimiter, validate(proposalStatusSchema), f.setProposalStatus)
router.post('/client/proposals/:id/hire', ...client, writeLimiter, validate(hireSchema), f.hireProposal)

// Contracts (either party; checked per contract)
router.get('/contracts', authMiddleware, c.listContracts)
router.get('/contracts/:id', authMiddleware, c.getContract)
router.post('/contracts/:id/milestones/:mid/submit', authMiddleware, writeLimiter, validate(submitMilestoneSchema), c.submitMilestone)
router.post('/contracts/:id/milestones/:mid/approve', authMiddleware, writeLimiter, c.approveMilestone)
router.post('/contracts/:id/milestones/:mid/revision', authMiddleware, writeLimiter, validate(revisionSchema), c.requestRevision)
router.post('/contracts/:id/cancel', authMiddleware, writeLimiter, validate(cancelSchema), c.cancelContract)
router.get('/contracts/:id/messages', authMiddleware, c.listContractMessages)
router.post('/contracts/:id/messages', authMiddleware, messageLimiter, validate(contractMessageSchema), c.postContractMessage)
router.post('/contracts/:id/review', authMiddleware, writeLimiter, validate(freelanceReviewSchema), c.reviewContract)

// Trust tools
router.get('/contracts/:id/contacts', authMiddleware, t.getContacts)
router.get('/contracts/:id/payments', authMiddleware, t.listPayments)
router.post('/contracts/:id/payments', authMiddleware, writeLimiter, validate(paymentLogSchema), t.logPayment)
router.patch('/contracts/:id/payments/:pid', authMiddleware, writeLimiter, validate(confirmPaymentSchema), t.confirmPayment)
router.get('/me/work', ...freelancer, t.myWork)
router.post('/me/invites', ...freelancer, writeLimiter, validate(inviteSchema), t.createInvite)
router.patch('/me/invites/:id/revoke', ...freelancer, writeLimiter, t.revokeInvite)
router.get('/invites/:token', t.getInvite)
router.post('/invites/:token/respond', authMiddleware, writeLimiter, validate(respondInviteSchema), t.respondInvite)
router.get('/me/invoices', ...freelancer, t.listMyInvoices)
router.post('/me/invoices', ...freelancer, writeLimiter, validate(createInvoiceSchema), t.createInvoice)
router.patch('/me/invoices/:id', ...freelancer, writeLimiter, validate(updateInvoiceSchema), t.updateInvoice)
router.get('/client/invoices', ...client, t.listClientInvoices)
router.get('/invoices/:id', authMiddleware, t.getInvoice)

// Admin moderation
router.get('/admin/projects', authMiddleware, requireRole('admin'), adminLimiter, f.adminListProjects)
router.patch('/admin/projects/:id', authMiddleware, requireRole('admin'), adminLimiter, validate(adminProjectSchema), f.adminSetProject)

export default router
