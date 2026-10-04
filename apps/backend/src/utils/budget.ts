// ============================================================
// FILE: apps/backend/src/utils/budget.ts
// PURPOSE: Spending guard for paid third-party calls (AI + web search).
//   • recordSpend() adds an estimated cost to this month's ledger.
//   • budgetState() says whether free users are paused (free_usd reached)
//     or everything is stopped (hard_usd reached).
// Reads are cached for 60s so the guard adds no latency per request.
// Estimates are deliberately a little high so the guard trips early.
// ============================================================

import { supabaseAdmin } from '../config/supabase'

// openai/gpt-oss-120b on Groq: $0.15 input / $0.60 output per 1M tokens.
const AI_IN_PER_TOKEN = 0.15 / 1_000_000
const AI_OUT_PER_TOKEN = 0.6 / 1_000_000
/** One SerpApi search on the smallest paid plan ($25 / 1,000). */
export const SEARCH_USD = 0.025

export interface BudgetState {
  month: string
  spent: number
  ai_usd: number
  search_usd: number
  ai_calls: number
  searches: number
  free_usd: number
  hard_usd: number
  freePaused: boolean
  hardStopped: boolean
}

const TTL = 60_000
let cache: { at: number; state: BudgetState } | null = null
const month = () => new Date().toISOString().slice(0, 7)

export async function budgetState(force = false): Promise<BudgetState> {
  if (!force && cache && Date.now() - cache.at < TTL && cache.state.month === month()) return cache.state
  const m = month()
  const [{ data: row }, { data: setting }] = await Promise.all([
    supabaseAdmin.from('spend_months').select('ai_usd, search_usd, ai_calls, searches').eq('month', m).maybeSingle(),
    supabaseAdmin.from('app_settings').select('value').eq('key', 'budget').maybeSingle(),
  ])
  const v = (setting?.value || {}) as { free_usd?: number; hard_usd?: number }
  const ai = Number(row?.ai_usd || 0)
  const search = Number(row?.search_usd || 0)
  const spent = ai + search
  const free_usd = Number(v.free_usd ?? 5)
  const hard_usd = Number(v.hard_usd ?? 15)
  const state: BudgetState = {
    month: m,
    spent,
    ai_usd: ai,
    search_usd: search,
    ai_calls: row?.ai_calls || 0,
    searches: row?.searches || 0,
    free_usd,
    hard_usd,
    freePaused: spent >= free_usd,
    hardStopped: spent >= hard_usd,
  }
  cache = { at: Date.now(), state }
  return state
}

export async function recordSpend(kind: 'ai' | 'search', usd: number): Promise<void> {
  if (!(usd > 0)) return
  if (cache) {
    cache.state.spent += usd
    cache.state.freePaused = cache.state.spent >= cache.state.free_usd
    cache.state.hardStopped = cache.state.spent >= cache.state.hard_usd
  }
  const { error } = await supabaseAdmin.rpc('spend_add', { p_kind: kind, p_usd: Number(usd.toFixed(6)) })
  if (error) console.warn('[budget] record failed', error.message)
}

export const aiCost = (inputTokens = 0, outputTokens = 0) => inputTokens * AI_IN_PER_TOKEN + outputTokens * AI_OUT_PER_TOKEN

/** Drop the cache (after an admin edits the budget). */
export const resetBudgetCache = () => {
  cache = null
}
