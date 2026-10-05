// ============================================================
// FILE: apps/backend/src/app.ts
// PURPOSE: The Express app, with no server attached. Used two ways:
//   • locally / on a VM: src/index.ts imports it and calls listen()
//   • on Vercel: apps/frontend/api/[...path].ts exports it as a function
// ============================================================

// First, before anything else: browser classes pdf.js expects (see pdfGlobals.ts).
import './pdfGlobals'
import './config/env'

import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { initSentry } from './config/sentry'
import { globalLimiter } from './middleware/rateLimiter'
import { errorHandler } from './middleware/errorHandler'
import { env } from './config/env'
import authRoutes from './routes/auth'
import reportRoutes from './routes/reports'
import cvRoutes from './routes/cv'
import trackerRoutes from './routes/tracker'
import reviewRoutes from './routes/reviews'
import analyticsRoutes from './routes/analytics'
import adminRoutes from './routes/admin'
import paymentRoutes from './routes/payments'
import recruiterRoutes from './routes/recruiter'
import jobRoutes from './routes/jobs'
import messageRoutes from './routes/messages'
import notificationRoutes from './routes/notifications'
import freelanceRoutes from './routes/freelance'
import billingRoutes from './routes/billing'
import recordRoutes from './routes/records'
import interviewRoutes from './routes/interviews'
import progressRoutes from './routes/progress'
import { badgeRoutes, talentRoutes, teamJoinRoutes } from './routes/teams'
import { disputeRoutes, publicRoutes, shareRoutes } from './routes/growth'
import { sitemap } from './controllers/growth.controller'
import cronRoutes from './routes/cron'

initSentry()

const app: Express = express()

// Real client IP behind a proxy/CDN (see TRUST_PROXY in env.ts). Without
// this every visitor shares the proxy's IP (rate limits break); with `true`
// anyone could spoof X-Forwarded-For. A hop count is the safe middle.
app.set('trust proxy', env.trustProxy)
app.disable('x-powered-by')
app.set('etag', false)

// ── Security headers. This server only returns JSON, so the CSP denies everything.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: env.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  }),
)
app.use((_req, res, next) => {
  // API responses carry personal data: never cache them anywhere.
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  next()
})

// ── CORS: only our own frontend(s), with cookies.
const allowedOrigins = new Set(env.frontendOrigins)
app.use(
  cors({
    origin(origin, cb) {
      // No Origin = same-origin request or a server-to-server call (health checks).
      if (!origin || allowedOrigins.has(origin)) return cb(null, true)
      return cb(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
)

// Block cross-site state-changing requests from unknown origins outright
// (CORS alone only hides the response; the request would still run).
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origin = req.headers.origin
  if (origin && !allowedOrigins.has(origin)) {
    res.status(403).json({ success: false, error: 'Origin not allowed' })
    return
  }
  next()
})

app.use(globalLimiter)

// Body size caps: JSON up to 1 MB (avatar data URLs), forms tiny.
app.use(express.json({ limit: '1mb', strict: true }))
app.use(express.urlencoded({ extended: false, limit: '10kb', parameterLimit: 20 }))
app.use(cookieParser())

if (env.isDev) {
  app.use(morgan('dev'))
} else {
  // Production access log without IPs, query strings or user agents.
  morgan.token('path', (req) => String((req as { originalUrl?: string }).originalUrl || '').split('?')[0])
  app.use(morgan(':method :path :status :res[content-length] - :response-time ms'))
}

app.get('/sitemap.xml', sitemap)
app.get('/api/sitemap.xml', sitemap)

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ ok: true })
})

// Scheduled jobs, triggered by Vercel Cron / cron-job.org (see routes/cron.ts).
app.use('/api/cron', cronRoutes)

app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/cv', cvRoutes)
app.use('/api/tracker', trackerRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/recruiter', recruiterRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/freelance', freelanceRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/records', recordRoutes)
app.use('/api/interviews', interviewRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/team', teamJoinRoutes)
app.use('/api/talent', talentRoutes)
app.use('/api/badge', badgeRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/share', shareRoutes)
app.use('/api/disputes', disputeRoutes)

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

app.use(errorHandler)

export default app
