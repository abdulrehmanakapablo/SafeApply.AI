// ============================================================
// FILE: apps/backend/src/services/groq.service.ts
// PURPOSE: All Groq AI calls — JD extraction, CV matching, rewrites,
//          summaries, analytics insights, CV structuring.
//
// CV STRUCTURING (v3 — line-index labelling):
//   1. Local preprocess: strip page markers, re-join wrapped PDF lines.
//   2. ONE Groq call sees numbered (truncated) lines and returns only
//      line ranges + short header strings (company / role / dates).
//   3. Text is copied VERBATIM from the original lines locally.
//   4. Deterministic heuristic parser fills gaps and is the full
//      fallback on 429 / timeout / parse failure.
// Output is ~10x smaller than transcription → fits the 8K TPM budget.
// ============================================================

import { aiCost, budgetState, recordSpend } from '../utils/budget'
import { groqClient, GROQ_MODEL, GROQ_MAX_TOKENS } from '../config/groq'

// ─── Structure progress events (streamed to frontend) ─────
export interface StructureProgressEvent {
  type: 'start' | 'progress' | 'merging'
  total_chunks?: number
  chunk?: number
  total?: number
  chunks_done?: number
  chunks_total?: number
  stats?: { exp: number; edu: number; skills: number }
}

// ─── Token budget (8,000 TPM — declared max_tokens counts) ─
const TPM_BUDGET = 7600
const CHARS_PER_TOKEN = 3.2

function estTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ══════════════════════════════════════════════════════════
// ─── Groq call wrapper ────────────────────────────────────
// ══════════════════════════════════════════════════════════
interface Completion {
  choices: Array<{
    message?: { content?: string | null }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

interface CompleteOptions {
  system: string
  user: string
  maxTokens: number
  temperature?: number
  timeoutMs?: number
}

class GroqCallError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message)
  }
}

function readRetryAfter(headers: unknown): number | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  const h = headers as { get?: (k: string) => string | null } & Record<string, unknown>
  const raw = typeof h.get === 'function' ? h.get('retry-after') : (h['retry-after'] as string | undefined)
  const secs = raw ? parseFloat(raw) : NaN
  return Number.isFinite(secs) ? Math.ceil(secs * 1000) : undefined
}

async function complete(opts: CompleteOptions): Promise<{ content: string; finish: string | null }> {
  const client = groqClient
  if (!client) throw new GroqCallError('GROQ_DISABLED')
  // Pocket protection: no AI calls once the month's hard budget is reached.
  if ((await budgetState()).hardStopped) throw new GroqCallError('BUDGET_STOPPED', 503)

  // reasoning_effort: gpt-oss is a reasoning model — hidden reasoning
  // tokens are charged against max_tokens. 'low' keeps them small.
  const params = {
    model: GROQ_MODEL,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature ?? 0.2,
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const call = client.chat.completions.create(params as never) as unknown as Promise<Completion>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new GroqCallError('TIMEOUT')), opts.timeoutMs ?? 45_000)
    })
    const completion = await Promise.race([call, timeout])
    void recordSpend('ai', aiCost(completion.usage?.prompt_tokens, completion.usage?.completion_tokens || opts.maxTokens))
    const choice = completion.choices?.[0]
    return {
      content: choice?.message?.content?.trim() ?? '',
      finish: choice?.finish_reason ?? null,
    }
  } catch (error) {
    if (error instanceof GroqCallError) throw error
    const e = error as { status?: number; message?: string; headers?: unknown }
    throw new GroqCallError(e.message || 'GROQ_ERROR', e.status, readRetryAfter(e.headers))
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function logGroqError(tag: string, error: unknown): void {
  const e = error as GroqCallError
  if (e?.status === 413 || e?.status === 429) {
    console.warn(`[${tag}] rate limited (${e.status})`)
  } else {
    console.error(`[${tag}] error:`, (e?.message || String(error)).slice(0, 200))
  }
}

// ══════════════════════════════════════════════════════════
// ─── JSON parsing / repair ────────────────────────────────
// ══════════════════════════════════════════════════════════
function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    /* fall through to repair */
  }
  try {
    const firstObj = cleaned.indexOf('{')
    const firstArr = cleaned.indexOf('[')
    const start =
      firstArr >= 0 && (firstObj < 0 || firstArr < firstObj) ? firstArr : firstObj
    if (start < 0) return null
    let s = cleaned.slice(start)
    const endChar = s[0] === '[' ? ']' : '}'
    const end = s.lastIndexOf(endChar)
    if (end > 0) s = s.slice(0, end + 1)
    s = replaceControlCharsInStrings(s)
    s = s.replace(/,\s*([}\]])/g, '$1')
    s = attemptCloseTruncatedJson(s)
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function replaceControlCharsInStrings(input: string): string {
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      result += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }
    if (inString) {
      if (ch === '\n') result += '\\n'
      else if (ch === '\r') result += '\\r'
      else if (ch === '\t') result += '\\t'
      else if (ch.charCodeAt(0) < 0x20) continue
      else result += ch
    } else {
      result += ch
    }
  }
  return result
}

function attemptCloseTruncatedJson(input: string): string {
  let s = input.trim()
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') inString = !inString
  }
  if (inString) s += '"'

  const stack: string[] = []
  inString = false
  escaped = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  while (stack.length > 0) s += stack.pop()
  return s
}

// ══════════════════════════════════════════════════════════
// ─── Text helpers (shared by match + structure) ───────────
// ══════════════════════════════════════════════════════════
const BULLET_RE = /^(?:[●•▪◦‣∙·○■□➢►▸]\s*|[-–*]\s+)/
const PAGE_MARKER_RE = /^-+\s*\d+\s*(?:of|\/)\s*\d+\s*-+$/i
const PAGE_WORD_RE = /^page\s+\d+(?:\s+of\s+\d+)?$/i

const MONTH = '\\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?'
const DATE_TOKEN = `(?:${MONTH}\\s*,?\\s*(?:19|20)\\d{2}|\\d{1,2}\\/(?:19|20)\\d{2}|\\b(?:19|20)\\d{2}\\b)`
const DATE_RANGE_RE = new RegExp(
  `(${DATE_TOKEN})\\s*(?:–|—|-|to|until)\\s*(${DATE_TOKEN}|present|current|now|ongoing|today)`,
  'i',
)
const SINGLE_DATE_RE = new RegExp(`(?:expected\\s+)?${DATE_TOKEN}`, 'i')

function isBullet(line: string): boolean {
  return BULLET_RE.test(line)
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim()
}

function hasDateRange(line: string): boolean {
  return DATE_RANGE_RE.test(line)
}

function isPresent(value: string): boolean {
  return /^(present|current|now|ongoing|today)$/i.test(value.trim())
}

function compactText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Section detection (anchored, so project names never match) ─
type SectionType =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'

const SECTION_RULES: Array<[SectionType, RegExp]> = [
  ['summary', /^(professional\s+|career\s+|executive\s+|expertise\s+)?(summary|profile|objective|about(\s+me)?|overview)$/i],
  ['experience', /^(work\s+|professional\s+|relevant\s+|employment\s+|career\s+)?(experience|employment(\s+history)?|work\s+history|career\s+history)$/i],
  ['education', /^(education(al)?(\s+background)?|academics?(\s+background)?|qualifications)$/i],
  ['skills', /^(technical\s+|core\s+|key\s+)?(skills|competencies|technologies|tech\s+stack|expertise)(\s*(&|and)\s*\w+)?$/i],
  ['projects', /^((personal|side|selected|notable|key|academic)\s+)?projects$/i],
  ['certifications', /^(certifications?|certificates?|licenses?(\s*(&|and)\s*certifications?)?|credentials|awards?(\s*(&|and)\s*\w+)?)$/i],
]

function sectionOf(line: string): SectionType | null {
  if (isBullet(line)) return null
  const t = line.replace(/[:\s]+$/, '').trim()
  if (!t || t.length > 45) return null
  for (const [type, re] of SECTION_RULES) {
    if (re.test(t)) return type
  }
  return null
}

// ─── Preprocess: strip page markers, re-join wrapped lines ─
function isContinuation(prev: string, line: string): boolean {
  if (isBullet(line) || sectionOf(line) || hasDateRange(line)) return false
  if (sectionOf(prev)) return false
  if (/[.!?]$/.test(prev)) return false
  if (isBullet(prev)) {
    if (/^[a-z0-9(&,/]/.test(line)) return true
    if (/[,;:&(\-–/]$/.test(prev)) return true
    if (/\b(and|or|of|to|with|for|in|on|the|a|an|via|using|by)$/i.test(prev)) return true
    return /^[^,]{1,40},/.test(line) // wrapped list, e.g. "Learning, Pandas, …"
  }
  return /^[a-z(&,]/.test(line)
}

const MAX_LINES = 400

function preprocessLines(raw: string): string[] {
  const rawLines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\t/g, ' ')
    .split('\n')

  const out: string[] = []
  for (const r of rawLines) {
    const line = r.replace(/\s+/g, ' ').trim()
    if (!line || PAGE_MARKER_RE.test(line) || PAGE_WORD_RE.test(line)) continue
    const prev = out[out.length - 1]
    if (prev !== undefined && isContinuation(prev, line)) {
      out[out.length - 1] = `${prev} ${line}`
    } else {
      out.push(line)
    }
  }
  return out.slice(0, MAX_LINES)
}

function compactCV(raw: string, maxChars: number): string {
  const text = preprocessLines(raw)
    .filter((l) => !/^relevant coursework/i.test(stripBullet(l)))
    .join('\n')
  if (text.length <= maxChars) return text
  // Keep head (header + recent roles) and tail (skills usually live there)
  const tail = Math.floor(maxChars * 0.3)
  const head = maxChars - tail - 3
  return `${text.slice(0, head)}\n…\n${text.slice(-tail)}`
}

// ══════════════════════════════════════════════════════════
// ─── JD EXTRACTION ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
const JD_MAX_CHARS = 8000

export async function extractJDData(
  jdText: string,
  options: { maxTokens?: number } = {},
): Promise<Record<string, unknown> | null> {
  if (!groqClient) return null

  const maxTokens = Math.min(options.maxTokens ?? 1500, GROQ_MAX_TOKENS)
  const input = compactText(jdText).slice(0, JD_MAX_CHARS)

  try {
    const { content } = await complete({
      system:
        'You are a structured data extraction assistant. Return ONLY valid JSON. No markdown, no commentary.',
      user: `Extract data from this job description and return ONLY this JSON structure:
{
  "role": "job title or null",
  "seniority": "junior|mid|senior|lead|principal|null",
  "experience_years": number or null,
  "required_skills": ["array of strings"],
  "nice_to_have_skills": ["array of strings"],
  "salary_mentioned": true or false,
  "salary_text": "raw salary text or null",
  "location": "location or null",
  "remote": true or false or null,
  "employment_type": "full-time|part-time|contract|null",
  "company_name": "company name if mentioned or null"
}

Job Description:
${input}`,
      maxTokens,
      temperature: 0.1,
    })
    return parseJsonLoose<Record<string, unknown>>(content)
  } catch (error) {
    logGroqError('extractJDData', error)
    return null
  }
}

// ══════════════════════════════════════════════════════════
// ─── CV MATCH ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
const MATCH_OUTPUT_TOKENS = 2000
const MATCH_PROMPT_TOKENS = 450
const MATCH_JD_MAX_CHARS = 5000
const MATCH_CV_MAX_CHARS = 12000

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
}

function normalizeMatch(raw: Record<string, unknown>): Record<string, unknown> {
  const pct = Number(raw.match_percentage)
  const pairs = <K extends string>(v: unknown, a: K, b: K) =>
    Array.isArray(v)
      ? v
          .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
          .map((x) => ({ [a]: String(x[a] ?? '').trim(), [b]: String(x[b] ?? '').trim() }))
          .filter((x) => x[a] && x[b])
      : []

  return {
    match_percentage: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0,
    matched_skills: toStringArray(raw.matched_skills),
    missing_skills: toStringArray(raw.missing_skills),
    probably_have: toStringArray(raw.probably_have),
    keyword_mismatches: pairs(raw.keyword_mismatches, 'jd_term', 'cv_term'),
    seniority_gaps: toStringArray(raw.seniority_gaps),
    ats_warnings: toStringArray(raw.ats_warnings),
    bullet_rewrites: pairs(raw.bullet_rewrites, 'original', 'suggested'),
  }
}

export async function matchCVtoJD(
  cvText: string,
  jdText: string,
): Promise<Record<string, unknown> | null> {
  if (!groqClient) return null

  const jdInput = compactText(jdText).slice(0, MATCH_JD_MAX_CHARS)
  const cvBudgetChars = Math.min(
    MATCH_CV_MAX_CHARS,
    Math.max(
      4000,
      Math.floor((TPM_BUDGET - MATCH_OUTPUT_TOKENS - MATCH_PROMPT_TOKENS - estTokens(jdInput)) * CHARS_PER_TOKEN),
    ),
  )
  const cvInput = compactCV(cvText, cvBudgetChars)

  console.log(
    `[matchCVtoJD] cv ${cvInput.length}/${cvText.length}, jd ${jdInput.length}/${jdText.length} chars`,
  )

  try {
    const { content } = await complete({
      system:
        'You are a CV analysis assistant. Compare CVs against job descriptions. Return ONLY valid JSON. No markdown, no commentary.',
      user: `Compare this CV against the job description and return ONLY this JSON:
{
  "match_percentage": number 0-100,
  "matched_skills": ["skills in both CV and JD"],
  "missing_skills": ["skills in JD but not in CV"],
  "probably_have": ["skills likely possessed but not mentioned in CV"],
  "keyword_mismatches": [{"jd_term": "string", "cv_term": "string"}],
  "seniority_gaps": ["weak bullet points that undersell the candidate"],
  "ats_warnings": ["formatting issues that break ATS parsers"],
  "bullet_rewrites": [{"original": "string", "suggested": "string"}]
}
Rules:
- bullet_rewrites: up to 6 CV bullets most relevant to this JD. "original" MUST be copied word-for-word from the CV (without the bullet symbol). "suggested" rewrites it in the JD's language. Never invent experience.
- Keep every array to 12 items max.

CV:
${cvInput}

Job Description:
${jdInput}`,
      maxTokens: MATCH_OUTPUT_TOKENS,
      temperature: 0.2,
      timeoutMs: 60_000,
    })

    const parsed = parseJsonLoose<Record<string, unknown>>(content)
    return parsed ? normalizeMatch(parsed) : null
  } catch (error) {
    logGroqError('matchCVtoJD', error)
    return null
  }
}

// ══════════════════════════════════════════════════════════
// ─── BULLET REWRITE ───────────────────────────────────────
// ══════════════════════════════════════════════════════════
export async function rewriteBullet(
  originalBullet: string,
  jdContext: string,
): Promise<string | null> {
  if (!groqClient) return null

  try {
    const { content } = await complete({
      system:
        'You are a professional CV writer. Rewrite bullet points to be stronger and match job description language. Return ONLY the rewritten bullet point. No explanation, no quotes.',
      user: `Rewrite this CV bullet to match the job description language.
Use strong action verbs and quantified impact where possible. Never invent facts.

Original bullet: ${originalBullet}

Job description context: ${jdContext.slice(0, 3000)}

Return only the rewritten bullet:`,
      maxTokens: 400,
    })
    return content.replace(/^["'\s]+|["'\s]+$/g, '') || null
  } catch (error) {
    logGroqError('rewriteBullet', error)
    return null
  }
}

// ══════════════════════════════════════════════════════════
// ─── SUMMARY GENERATOR ────────────────────────────────────
// ══════════════════════════════════════════════════════════
export async function generateSummary(
  background: string,
  targetRole: string,
): Promise<string | null> {
  if (!groqClient) return null

  try {
    const { content } = await complete({
      system:
        'You are a professional CV writer. Write concise, impactful professional summaries. Return ONLY the summary text. No explanation, no quotes, no labels.',
      user: `Write a 2-3 sentence professional summary for a CV.

Background: ${background.slice(0, 3000)}
Target role: ${targetRole}

Return only the summary:`,
      maxTokens: 500,
    })
    return content || null
  } catch (error) {
    logGroqError('generateSummary', error)
    return null
  }
}

// ══════════════════════════════════════════════════════════
// ─── ANALYTICS INSIGHTS ───────────────────────────────────
// ══════════════════════════════════════════════════════════
export async function generateAnalyticsInsights(
  stats: Record<string, unknown>,
): Promise<string[] | null> {
  if (!groqClient) return null

  try {
    const { content } = await complete({
      system:
        'You are a career coach analyzing job search data. Return ONLY a JSON array of 3-4 insight strings. No markdown.',
      user: `Generate 3-4 actionable insights from these job search statistics.
Return ONLY a JSON array of strings like: ["insight 1", "insight 2", "insight 3"]

Statistics:
${JSON.stringify(stats)}`,
      maxTokens: 700,
    })
    const parsed = parseJsonLoose<unknown>(content)
    const insights = toStringArray(parsed)
    return insights.length > 0 ? insights : null
  } catch (error) {
    logGroqError('generateAnalyticsInsights', error)
    return null
  }
}

// ══════════════════════════════════════════════════════════
// ─── STRUCTURE RAW CV TEXT (line-index labelling) ─────────
// ══════════════════════════════════════════════════════════
export interface StructuredCVData {
  personal: {
    full_name: string
    job_title: string
    email: string
    phone: string
    location: string
    linkedin: string
    github: string
    summary: string
  }
  experience: Array<{
    company: string
    role: string
    start_date: string
    end_date: string | null
    is_current: boolean
    bullets: string[]
  }>
  education: Array<{
    institution: string
    degree: string
    field: string
    start_date: string
    end_date: string
  }>
  skills: string[]
  projects: Array<{
    name: string
    description: string
    url: string
    tech_stack: string[]
  }>
  certifications: Array<{
    name: string
    issuer: string
    date: string
    url: string
  }>
}

type Personal = StructuredCVData['personal']
type Exp = StructuredCVData['experience'][number]
type Edu = StructuredCVData['education'][number]
type Proj = StructuredCVData['projects'][number]
type Cert = StructuredCVData['certifications'][number]

function emptyStructured(): StructuredCVData {
  return {
    personal: {
      full_name: '',
      job_title: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      summary: '',
    },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  }
}

// ─── Shared parsing helpers ───────────────────────────────
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/[^\s|,•·]+/i
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|,•·]+/i
const URL_RE = /https?:\/\/[^\s|,•·]+/i
const CONTACTISH_RE = /@|https?:\/\/|www\.|linkedin\.com|github\.|\+?\d[\d\s().-]{7,}/i

const ROLE_WORD_RE =
  /\b(engineer|developer|intern|manager|analyst|lead|director|designer|consultant|ambassador|grader|assistant|scientist|architect|specialist|officer|head|president|founder|researcher|programmer|administrator|coordinator|associate|executive|technician|teacher|tutor|instructor|fellow|volunteer|representative)\b/i
const INSTITUTION_RE = /universit|college|institut|school|academy|polytechnic/i
const DEGREE_RE =
  /\b(bachelor|master|associate|doctor|ph\.?\s?d|b\.?\s?sc?|m\.?\s?sc?|b\.?\s?a|m\.?\s?a|mba|diploma)\b[^|,]*/i
const LEVEL_RE = /\s*\((advanced|intermediate|basic|beginner|expert|proficient|native|fluent|familiar)\)/gi

function str(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
}

function findUrl(text: string): string {
  return text.match(URL_RE)?.[0]?.replace(/[).;]+$/, '') ?? ''
}

function isLocationPart(p: string): boolean {
  return (
    /^(remote|hybrid|on-?site)$/i.test(p) ||
    /\((remote|hybrid|on-?site)\)/i.test(p) ||
    /^[A-Z]{2}$/.test(p) ||
    /^(usa|us|uk|uae|india|pakistan|canada|germany|australia)(\s*\(.*\))?$/i.test(p)
  )
}

function splitHeader(text: string): string[] {
  return text
    .split(/\s+[|–—-]\s+|\s*\|\s*|,\s+/)
    .map((p) => p.replace(/^[\s|,–—-]+|[\s|,–—-]+$/g, '').trim())
    .filter(Boolean)
}

function matchDateRange(line: string): { start: string; end: string; rest: string } | null {
  const m = line.match(DATE_RANGE_RE)
  if (!m || m.index === undefined) return null
  const rest = `${line.slice(0, m.index)} ${line.slice(m.index + m[0].length)}`
    .replace(/\s+/g, ' ')
    .replace(/^[\s|,–—-]+|[\s|,–—-]+$/g, '')
    .trim()
  return { start: m[1].trim(), end: m[2].trim(), rest }
}

function applyDates(e: Exp, range: { start: string; end: string }): void {
  e.start_date = range.start
  e.is_current = isPresent(range.end)
  e.end_date = e.is_current ? null : range.end
}

function makeExp(company: string, role: string): Exp {
  return { company, role, start_date: '', end_date: null, is_current: false, bullets: [] }
}

function splitSkills(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    let t = stripBullet(line)
    const colon = t.indexOf(':')
    if (colon > 0 && colon < 50) t = t.slice(colon + 1)
    for (const raw of t.replace(LEVEL_RE, '').split(/[,;|•·]|\.(?=[A-Z])|\s+\/\s+/)) {
      const s = raw.trim().replace(/[.\s]+$/, '')
      if (!s || s.length > 50 || s.split(/\s+/).length > 6) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
  }
  return out
}

function extractContacts(lines: string[]): Pick<Personal, 'email' | 'phone' | 'linkedin' | 'github'> {
  const head = lines.slice(0, 12).join(' | ')
  const all = lines.join(' | ')
  const pick = (re: RegExp, text: string) => text.match(re)?.[0]?.replace(/[).;]+$/, '').trim() ?? ''
  return {
    email: pick(EMAIL_RE, head) || pick(EMAIL_RE, all),
    phone: pick(PHONE_RE, head),
    linkedin: pick(LINKEDIN_RE, head) || pick(LINKEDIN_RE, all),
    github: pick(GITHUB_RE, head) || pick(GITHUB_RE, all),
  }
}

function guessName(lines: string[]): string {
  for (const l of lines.slice(0, 5)) {
    const words = l.split(/\s+/)
    if (!CONTACTISH_RE.test(l) && !/\d/.test(l) && words.length >= 2 && words.length <= 6 && l.length <= 60) {
      return l
    }
  }
  return ''
}

function guessTitle(headerLines: string[], name: string): string {
  for (const l of headerLines) {
    if (l === name || CONTACTISH_RE.test(l) || l.length > 120) continue
    if (/^[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+$/.test(l)) continue
    return l
  }
  return ''
}

function guessLocation(headerLines: string[]): string {
  for (const l of headerLines) {
    for (const seg of l.split(/[|•·]/)) {
      const s = seg.trim()
      if (!CONTACTISH_RE.test(s) && /^[A-Z][A-Za-z .'-]+,\s*[A-Z][A-Za-z .'-]+$/.test(s)) return s
    }
  }
  return ''
}

// ─── Heuristic parser (fallback + gap filler, 0 tokens) ───
function parseExperience(body: string[]): Exp[] {
  const items: Exp[] = []
  let company = ''
  let cur: Exp | null = null

  for (const line of body) {
    if (isBullet(line) || line.length > 90) {
      if (!cur) {
        cur = makeExp(company, '')
        items.push(cur)
      }
      cur.bullets.push(stripBullet(line))
      continue
    }

    const range = matchDateRange(line)
    const parts = splitHeader(range ? range.rest : line)

    // Date on its own line → attach to the entry above
    if (range && parts.length === 0) {
      if (cur && !cur.start_date) applyDates(cur, range)
      continue
    }

    const roleIdx = parts.findIndex((p) => ROLE_WORD_RE.test(p))
    const companyPart = parts.find((p, i) => i !== roleIdx && !isLocationPart(p)) ?? ''

    // Plain company line (roles with dates follow)
    if (!range && roleIdx < 0) {
      company = companyPart || company
      cur = null
      continue
    }

    const entryCompany = companyPart || company
    if (companyPart) company = companyPart
    cur = makeExp(entryCompany, roleIdx >= 0 ? parts[roleIdx] : '')
    if (range) applyDates(cur, range)
    items.push(cur)
  }

  // Drop company-only shells ("ALL3D … 2021 – 2025") and dateless role lists
  return items.filter((e) => e.bullets.length > 0 || (e.role && e.start_date))
}

function parseEducation(body: string[]): Edu[] {
  const items: Edu[] = []
  for (const line of body) {
    if (isBullet(line)) continue // coursework, GPA, honours

    let text = line
    let start = ''
    let end = ''
    const range = matchDateRange(line)
    if (range) {
      text = range.rest
      start = range.start
      end = range.end
    } else {
      const single = line.match(SINGLE_DATE_RE)
      if (single) {
        end = single[0].replace(/^expected\s+/i, '').trim()
        text = line.replace(single[0], ' ')
      }
    }

    const parts = splitHeader(text)
    const institution = parts.find((p) => INSTITUTION_RE.test(p)) ?? parts[0] ?? ''
    const degreeRaw = text.match(DEGREE_RE)?.[0]?.trim() ?? ''
    const split = degreeRaw.match(/^(.*?)\s+in\s+(.+)$/i)
    const degree = (split ? split[1] : degreeRaw).replace(/[\s|–—-]+$/, '').trim()
    const field = (split ? split[2] : '').replace(/[\s|–—-]+$/, '').trim()

    if (institution || degree) {
      items.push({ institution, degree, field, start_date: start, end_date: end })
    }
  }
  return items
}

function parseProjects(body: string[]): Proj[] {
  const items: Proj[] = []
  let cur: Proj | null = null
  for (const line of body) {
    if (isBullet(line) || (cur && line.length > 90)) {
      if (!cur) {
        cur = { name: '', description: '', url: '', tech_stack: [] }
        items.push(cur)
      }
      const text = stripBullet(line)
      cur.description = cur.description ? `${cur.description}\n${text}` : text
      if (!cur.url) cur.url = findUrl(text)
      continue
    }
    const url = findUrl(line)
    const name = line.replace(URL_RE, '').replace(/[\s|,–—-]+$/, '').trim()
    cur = { name, description: '', url, tech_stack: [] }
    items.push(cur)
  }
  return items.filter((p) => p.name || p.description)
}

function parseCerts(body: string[]): Cert[] {
  return body
    .map(stripBullet)
    .filter(Boolean)
    .map((t) => {
      const date = t.match(SINGLE_DATE_RE)?.[0] ?? ''
      const url = findUrl(t)
      const parts = splitHeader(t.replace(date, ' ').replace(url, ' '))
      return {
        name: parts[0] ?? '',
        issuer: parts[1] ?? '',
        date: date.replace(/^expected\s+/i, '').trim(),
        url,
      }
    })
    .filter((c) => c.name)
}

function heuristicParse(lines: string[]): StructuredCVData {
  const out = emptyStructured()
  const headerLines: string[] = []
  const sections: Array<{ type: SectionType; body: string[] }> = []
  let current: { type: SectionType; body: string[] } | null = null

  for (const line of lines) {
    const type = sectionOf(line)
    if (type) {
      current = { type, body: [] }
      sections.push(current)
      continue
    }
    if (current) current.body.push(line)
    else headerLines.push(line)
  }

  // No headers at all → treat everything after the contact block as experience
  if (sections.length === 0) {
    const split = Math.min(4, lines.length)
    headerLines.splice(0, headerLines.length, ...lines.slice(0, split))
    sections.push({ type: 'experience', body: lines.slice(split) })
  }

  const contactSource = headerLines.length > 0 ? headerLines : lines
  const name = guessName(contactSource)
  out.personal = {
    ...out.personal,
    ...extractContacts(lines),
    full_name: name,
    job_title: guessTitle(headerLines, name),
    location: guessLocation(contactSource.slice(0, 6)),
  }

  for (const s of sections) {
    switch (s.type) {
      case 'summary': {
        const text = s.body.map(stripBullet).join(' ').trim()
        out.personal.summary = [out.personal.summary, text].filter(Boolean).join(' ')
        break
      }
      case 'experience':
        out.experience.push(...parseExperience(s.body))
        break
      case 'education':
        out.education.push(...parseEducation(s.body))
        break
      case 'skills':
        out.skills.push(...splitSkills(s.body))
        break
      case 'projects':
        out.projects.push(...parseProjects(s.body))
        break
      case 'certifications':
        out.certifications.push(...parseCerts(s.body))
        break
    }
  }
  return out
}

// ─── AI labelling (one call, line ranges only) ────────────
type LineRange = number[]

interface AiLabels {
  name?: unknown
  title?: unknown
  location?: unknown
  summary?: LineRange
  exp?: Array<{ c?: unknown; r?: unknown; s?: unknown; e?: unknown; b?: LineRange }>
  edu?: Array<{ i?: unknown; d?: unknown; f?: unknown; s?: unknown; e?: unknown }>
  skills?: LineRange[]
  proj?: Array<{ n?: unknown; u?: unknown; b?: LineRange }>
  cert?: Array<{ n?: unknown; i?: unknown; d?: unknown; u?: unknown }>
}

const STRUCTURE_OUTPUT_TOKENS = 1800
const STRUCTURE_PROMPT_TOKENS = 700
const VIEW_TOKEN_BUDGET = Math.min(
  4800,
  TPM_BUDGET - STRUCTURE_OUTPUT_TOKENS - STRUCTURE_PROMPT_TOKENS,
)

const STRUCTURE_SYSTEM =
  'You map the structure of résumés. Output ONLY minified JSON. No markdown, no commentary.'

const STRUCTURE_INSTRUCTIONS = `The CV below is given as numbered lines "N|text". Long lines are cut with "…" — you never need their full text.
Return JSON with exactly these keys (use [] or "" when absent):
{"name":"","title":"","location":"","summary":[a,b],"exp":[{"c":"company","r":"role","s":"start date","e":"end date or Present","b":[a,b]}],"edu":[{"i":"institution","d":"degree","f":"field of study","s":"","e":""}],"skills":[[a,b]],"proj":[{"n":"project name","u":"url","b":[a,b]}],"cert":[{"n":"name","i":"issuer","d":"date","u":"url"}]}
Rules:
- [a,b] = inclusive line-number range.
- "summary" = body lines of the summary/profile/expertise section.
- "b" = description/bullet lines of THAT entry only — never its header line.
- Copy c, r, s, e, n, i, d, f text exactly as written. Never invent anything.
- One "exp" object per role. If one company lists several roles with their own dates, output one object per role, each repeating the company name.
- Include EVERY job, internship and position (teaching, research, volunteer included).
- "skills" = line ranges of the skills section body.
- Ignore coursework lines. Do not output example or empty objects.
CV:
`

function buildLineView(lines: string[], bulletChars: number, otherChars: number): string {
  return lines
    .map((l, i) => {
      const limit = isBullet(l) ? bulletChars : otherChars
      return `${i}|${l.length > limit ? `${l.slice(0, limit)}…` : l}`
    })
    .join('\n')
}

function fitView(lines: string[]): string {
  const tiers: Array<[number, number]> = [
    [80, 160],
    [50, 110],
    [32, 80],
  ]
  let view = ''
  for (const [b, o] of tiers) {
    view = buildLineView(lines, b, o)
    if (estTokens(view) <= VIEW_TOKEN_BUDGET) return view
  }
  let n = lines.length
  while (estTokens(view) > VIEW_TOKEN_BUDGET && n > 40) {
    n = Math.floor(n * 0.85)
    view = buildLineView(lines.slice(0, n), 32, 80)
  }
  return view
}

function linesIn(range: unknown, lines: string[]): string[] {
  if (!Array.isArray(range) || range.length === 0) return []
  const a = Math.trunc(Number(range[0]))
  const b = Math.trunc(Number(range[range.length - 1]))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return []
  const max = lines.length - 1
  const from = Math.max(0, Math.min(max, Math.min(a, b)))
  const to = Math.max(0, Math.min(max, Math.max(a, b)))
  return lines.slice(from, to + 1)
}

// Body lines only — guards against off-by-one ranges swallowing headers
function bodyLines(range: unknown, lines: string[]): string[] {
  return linesIn(range, lines)
    .filter((l) => !sectionOf(l) && (isBullet(l) || !hasDateRange(l)))
    .map(stripBullet)
    .filter(Boolean)
}

function buildFromLabels(l: AiLabels, lines: string[]): StructuredCVData {
  const out = emptyStructured()

  out.personal = {
    ...out.personal,
    ...extractContacts(lines),
    full_name: str(l.name),
    job_title: str(l.title),
    location: str(l.location),
    summary: linesIn(l.summary, lines).map(stripBullet).join(' ').trim(),
  }

  out.experience = (Array.isArray(l.exp) ? l.exp : [])
    .map((e) => {
      const end = str(e.e)
      const current = isPresent(end)
      return {
        company: str(e.c),
        role: str(e.r),
        start_date: str(e.s),
        end_date: current || !end ? null : end,
        is_current: current,
        bullets: bodyLines(e.b, lines),
      }
    })
    .filter((e) => e.company || e.role)

  out.education = (Array.isArray(l.edu) ? l.edu : [])
    .map((e) => ({
      institution: str(e.i),
      degree: str(e.d),
      field: str(e.f),
      start_date: str(e.s),
      end_date: str(e.e),
    }))
    .filter((e) => e.institution || e.degree)

  out.skills = splitSkills(
    (Array.isArray(l.skills) ? l.skills : []).flatMap((r) => linesIn(r, lines)),
  )

  out.projects = (Array.isArray(l.proj) ? l.proj : [])
    .map((p) => {
      const body = bodyLines(p.b, lines)
      const description = body.join('\n')
      return {
        name: str(p.n),
        description,
        url: str(p.u) || findUrl(description),
        tech_stack: [] as string[],
      }
    })
    .filter((p) => p.name || p.description)

  out.certifications = (Array.isArray(l.cert) ? l.cert : [])
    .map((c) => ({ name: str(c.n), issuer: str(c.i), date: str(c.d), url: str(c.u) }))
    .filter((c) => c.name)

  return out
}

async function aiLabelStructure(lines: string[]): Promise<StructuredCVData | null> {
  const view = fitView(lines)
  console.log(
    `[structureCVText] ${lines.length} lines → view ${view.length} chars (~${estTokens(view)} tokens)`,
  )

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { content, finish } = await complete({
        system: STRUCTURE_SYSTEM,
        user: STRUCTURE_INSTRUCTIONS + view,
        maxTokens: STRUCTURE_OUTPUT_TOKENS,
        temperature: 0,
        timeoutMs: 60_000,
      })
      const labels = parseJsonLoose<AiLabels>(content)
      if (!labels) {
        throw new GroqCallError(`PARSE_FAILED finish=${finish} len=${content.length}`)
      }
      return buildFromLabels(labels, lines)
    } catch (error) {
      const e = error as GroqCallError
      if (e.status !== 429 || attempt > 0) throw error
      const wait = Math.min(e.retryAfterMs ?? 15_000, 20_000)
      console.warn(`[structureCVText] 429 — retrying in ${wait}ms`)
      await delay(wait)
    }
  }
  return null
}

// ─── Merge + finalize ─────────────────────────────────────
function bulletCount(exp: Exp[]): number {
  return exp.reduce((sum, e) => sum + e.bullets.length, 0)
}

function fillGaps(primary: StructuredCVData, backup: StructuredCVData): StructuredCVData {
  const personal = { ...primary.personal }
  for (const k of Object.keys(personal) as Array<keyof Personal>) {
    if (!personal[k]) personal[k] = backup.personal[k]
  }

  // If AI captured far fewer bullets than the deterministic parse, it missed roles
  const aiBullets = bulletCount(primary.experience)
  const hBullets = bulletCount(backup.experience)
  const useAiExp = primary.experience.length > 0 && aiBullets >= hBullets * 0.6
  if (!useAiExp && backup.experience.length > 0) {
    console.warn(`[structureCVText] AI experience incomplete (${aiBullets}/${hBullets} bullets) — using local parse`)
  }

  return {
    personal,
    experience: useAiExp || backup.experience.length === 0 ? primary.experience : backup.experience,
    education: primary.education.length ? primary.education : backup.education,
    skills: primary.skills.length ? primary.skills : backup.skills,
    projects: primary.projects.length ? primary.projects : backup.projects,
    certifications: primary.certifications.length ? primary.certifications : backup.certifications,
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function finalize(data: StructuredCVData): StructuredCVData {
  const dedupe = (items: string[]) => {
    const seen = new Set<string>()
    return items.filter((s) => {
      const k = s.toLowerCase().trim()
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  const skills = dedupe(data.skills)
  const skillPatterns = skills
    .filter((s) => s.length >= 2)
    .map((s) => ({ skill: s, re: new RegExp(`(?<![\\w])${escapeRegex(s)}(?![\\w])`, 'i') }))

  return {
    ...data,
    skills,
    experience: data.experience.map((e) => ({ ...e, bullets: dedupe(e.bullets) })),
    projects: data.projects.map((p) => ({
      ...p,
      tech_stack:
        p.tech_stack.length > 0
          ? p.tech_stack
          : skillPatterns.filter(({ re }) => re.test(p.description)).map(({ skill }) => skill).slice(0, 8),
    })),
  }
}

function statsOf(d: StructuredCVData): { exp: number; edu: number; skills: number } {
  return { exp: d.experience.length, edu: d.education.length, skills: d.skills.length }
}

// ─── Main entry ───────────────────────────────────────────
export async function structureCVText(
  rawText: string,
  onProgress?: (event: StructureProgressEvent) => void,
): Promise<StructuredCVData | null> {
  const lines = preprocessLines(rawText)
  if (lines.length === 0) return null

  onProgress?.({ type: 'start', total_chunks: 2 })

  // Step 1 — local deterministic parse (0 tokens)
  const heuristic = heuristicParse(lines)
  onProgress?.({ type: 'progress', chunk: 1, total: 2, stats: statsOf(heuristic) })

  // Step 2 — single AI labelling call
  let ai: StructuredCVData | null = null
  if (groqClient) {
    try {
      ai = await aiLabelStructure(lines)
    } catch (error) {
      logGroqError('structureCVText', error)
    }
  }
  onProgress?.({ type: 'progress', chunk: 2, total: 2, stats: statsOf(ai ?? heuristic) })
  onProgress?.({ type: 'merging', chunks_done: ai ? 2 : 1, chunks_total: 2 })

  const merged = finalize(ai ? fillGaps(ai, heuristic) : heuristic)
  console.log(
    `[structureCVText] ${ai ? 'AI+local' : 'local-only'} → ` +
      `${merged.experience.length} exp (${bulletCount(merged.experience)} bullets), ` +
      `${merged.education.length} edu, ${merged.skills.length} skills, ` +
      `${merged.projects.length} proj, ${merged.certifications.length} certs`,
  )
  return merged
}