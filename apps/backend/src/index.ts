import './config/env'

import express from 'express'
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

initSentry()

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())

if (env.isDev) {
  app.use(morgan('dev'))
}

app.use(globalLimiter)

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'SafeApply.AI API is running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/cv', cvRoutes)
app.use('/api/tracker', trackerRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payments', paymentRoutes)

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`✅ SafeApply.AI backend running on port ${env.port}`)
  console.log(`📍 Environment: ${env.nodeEnv}`)
  console.log(`🌐 Frontend URL: ${env.frontendUrl}`)
})

export default app