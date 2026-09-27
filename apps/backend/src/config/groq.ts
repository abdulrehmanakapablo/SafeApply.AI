// ============================================================
// FILE: apps/backend/src/config/groq.ts
// PURPOSE: Initializes Groq SDK client for AI operations
// Used for JD extraction, CV matching, bullet rewrites
// If API key missing all AI features return null gracefully
// ============================================================

import Groq from 'groq-sdk'
import { env } from './env'

// Initialize Groq client — null if no API key configured
export const groqClient = env.groqApiKey
  ? new Groq({ apiKey: env.groqApiKey })
  : null

if (!groqClient) {
  console.warn('⚠️  Groq API key not configured — AI features disabled')
}

// Model to use for all completions
// llama-3.1-70b-versatile is best free model for structured extraction
export const GROQ_MODEL = 'llama-3.1-70b-versatile'

// Max tokens for responses — keeps costs low and responses fast
export const GROQ_MAX_TOKENS = 2000