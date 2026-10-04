// ============================================================
// FILE: apps/backend/src/routes/payments.ts
// PURPOSE: Payment routes — disabled until paywall is added
// TODO: Uncomment everything below when ready to add billing
// ============================================================

import { Router, type Router as RouterType } from 'express'
const router: RouterType = Router()

// All payment routes commented out until paywall is implemented
// import { authMiddleware } from '../middleware/auth'
// import { createCheckout, webhookLemonSqueezy, webhookSafepay, getHistory } from '../controllers/payments.controller'
// router.post('/create-checkout', authMiddleware, createCheckout)
// router.post('/webhook/lemonsqueezy', webhookLemonSqueezy)
// router.post('/webhook/safepay', webhookSafepay)
// router.get('/history', authMiddleware, getHistory)

export default router
