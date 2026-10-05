// ============================================================
// FILE: apps/backend/src/services/email.service.ts
// PURPOSE: Transactional email through Resend's REST API (no SDK).
//          Best effort: a failed email never fails the request.
//          Without RESEND_API_KEY, emails are skipped (logged in dev).
// ============================================================

import axios from 'axios'
import { env } from '../config/env'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Plain, readable layout. `lines` are escaped; `cta.path` must start with '/'. */
export function emailHtml(title: string, lines: string[], cta?: { label: string; path: string }): string {
  const link = cta && cta.path.startsWith('/') ? `${env.frontendUrl}${cta.path}` : ''
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;color:#0d0d0d">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:14px;font-weight:700;margin:0 0 24px">SafeApply<span style="color:#16a34a">.AI</span></p>
<div style="background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${lines.map((l) => `<p style="font-size:14px;line-height:1.6;color:#404040;margin:0 0 12px">${esc(l)}</p>`).join('')}
${link ? `<a href="${esc(link)}" style="display:inline-block;margin-top:8px;background:#16a34a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">${esc(cta!.label)}</a>` : ''}
</div>
<p style="font-size:12px;color:#737373;margin:20px 0 0">You get this email because you have a SafeApply account.</p>
</div></body></html>`
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Email is switched off until a sending service is set up (EMAIL_ENABLED).
  if (!env.emailEnabled || !env.resendApiKey) {
    if (env.isDev) console.info(`[email skipped] ${subject} -> ${to.replace(/(.).+@/, '$1***@')}`)
    return false
  }
  try {
    await axios.post(
      'https://api.resend.com/emails',
      { from: env.emailFrom, to: [to], subject: subject.slice(0, 200), html },
      { headers: { Authorization: `Bearer ${env.resendApiKey}` }, timeout: 10_000 },
    )
    return true
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    console.warn('[email] send failed', status ?? (e instanceof Error ? e.message : ''))
    return false
  }
}
