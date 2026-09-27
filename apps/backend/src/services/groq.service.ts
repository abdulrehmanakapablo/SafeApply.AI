// ============================================================
// FILE: apps/backend/src/services/groq.service.ts
// PURPOSE: All Groq AI calls — JD extraction, CV matching, rewrites
// Returns null gracefully if Groq is unavailable
// All prompts request strict JSON output — no markdown
// ============================================================

import { groqClient, GROQ_MODEL, GROQ_MAX_TOKENS } from '../config/groq'

// ─── JD EXTRACTION ────────────────────────────────────────
// Extracts structured data from raw job description text.
// The `maxTokens` option lets the anonymous landing-page demo run a
// cheaper call (800 tokens) while authenticated reports use the full
// budget (4000 tokens). Declared tokens count against Groq's free-tier
// TPM budget regardless of what the model actually generates, so this
// matters.
export async function extractJDData(
  jdText: string,
  options: { maxTokens?: number } = {}
): Promise<Record<string, unknown> | null> {
  if (!groqClient) return null

  const maxTokens = options.maxTokens ?? GROQ_MAX_TOKENS

  try {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: `You are a structured data extraction assistant. 
Extract information from job descriptions and return ONLY valid JSON.
No markdown, no code blocks, no extra text. Just the JSON object.`,
        },
        {
          role: 'user',
          content: `Extract data from this job description and return ONLY this JSON structure:
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
${jdText}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null

    const cleaned = content.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch (error) {
    console.error('Groq JD extraction error:', error)
    return null
  }
}

// ─── CV MATCH ─────────────────────────────────────────────
export async function matchCVtoJD(
  cvText: string,
  jdText: string
): Promise<Record<string, unknown> | null> {
  if (!groqClient) return null

  try {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: GROQ_MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: `You are a CV analysis assistant. 
Compare CVs against job descriptions and return ONLY valid JSON.
No markdown, no code blocks, no extra text.`,
        },
        {
          role: 'user',
          content: `Compare this CV against the job description and return ONLY this JSON:
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

CV:
${cvText}

Job Description:
${jdText}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null

    const cleaned = content.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch (error) {
    console.error('Groq CV match error:', error)
    return null
  }
}

// ─── BULLET REWRITE ───────────────────────────────────────
export async function rewriteBullet(
  originalBullet: string,
  jdContext: string
): Promise<string | null> {
  if (!groqClient) return null

  try {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `You are a professional CV writer. 
Rewrite bullet points to be stronger and match job description language.
Return ONLY the rewritten bullet point. No explanation, no quotes.`,
        },
        {
          role: 'user',
          content: `Rewrite this CV bullet to match the job description language.
Use strong action verbs and quantified impact where possible.

Original bullet: ${originalBullet}

Job description context: ${jdContext}

Return only the rewritten bullet:`,
        },
      ],
    })

    return completion.choices[0]?.message?.content?.trim() || null
  } catch (error) {
    console.error('Groq bullet rewrite error:', error)
    return null
  }
}

// ─── SUMMARY GENERATOR ────────────────────────────────────
export async function generateSummary(
  background: string,
  targetRole: string
): Promise<string | null> {
  if (!groqClient) return null

  try {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are a professional CV writer.
Write concise, impactful professional summaries.
Return ONLY the summary text. No explanation, no quotes, no labels.`,
        },
        {
          role: 'user',
          content: `Write a 2-3 sentence professional summary for a CV.

Background: ${background}
Target role: ${targetRole}

Return only the summary:`,
        },
      ],
    })

    return completion.choices[0]?.message?.content?.trim() || null
  } catch (error) {
    console.error('Groq summary error:', error)
    return null
  }
}

// ─── ANALYTICS INSIGHTS ───────────────────────────────────
export async function generateAnalyticsInsights(
  stats: Record<string, unknown>
): Promise<string[] | null> {
  if (!groqClient) return null

  try {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a career coach analyzing job search data.
Generate actionable insights from application statistics.
Return ONLY a JSON array of 3-4 insight strings. No markdown.`,
        },
        {
          role: 'user',
          content: `Generate 3-4 actionable insights from these job search statistics.
Return ONLY a JSON array of strings like: ["insight 1", "insight 2", "insight 3"]

Statistics:
${JSON.stringify(stats, null, 2)}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null

    const cleaned = content.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch (error) {
    console.error('Groq analytics insights error:', error)
    return null
  }
}