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
// openai/gpt-oss-120b is Groq's recommended replacement for the
// decommissioned llama-3.3-70b-versatile (shut down Aug 16, 2026).
// Context window: 131,072 tokens · Max output: 65,536 tokens
export const GROQ_MODEL = 'openai/gpt-oss-120b'

// Max tokens for responses.
//
// ⚠️  Groq's free tier caps you at 8,000 tokens per minute (TPM),
// and that budget is charged against the max_tokens you DECLARE,
// not the number the model actually generates.[reference:1]
//
// So declaring 8,000+ here will cause 413 errors even if the model
// would only generate 200 tokens. Keep this safely under 8,000.
export const GROQ_MAX_TOKENS = 4000