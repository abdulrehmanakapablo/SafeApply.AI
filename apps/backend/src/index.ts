// ============================================================
// FILE: apps/backend/src/index.ts
// PURPOSE: Long-running server (local dev, or any VM/container host).
//          On Vercel this file isn't used: the app is served as a function
//          and scheduled jobs run through /api/cron instead.
// ============================================================

import app from './app'
import { env } from './config/env'
import { startScheduler } from './jobs/scheduler'

const server = app.listen(env.port, () => {
  console.log(`SafeApply.AI backend running on port ${env.port} (${env.nodeEnv})`)
  startScheduler()
})

// Slow-client protection (slowloris): cap how long headers/bodies may take.
server.headersTimeout = 20_000
server.requestTimeout = 90_000 // CV structuring streams for up to ~60s
server.keepAliveTimeout = 5_000
server.maxHeadersCount = 50

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason instanceof Error ? reason.message : reason)
})

export default app
