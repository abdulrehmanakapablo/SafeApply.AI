// Guard for F1: signing a user in on the shared service-role client stores
// that user's session on it, and supabase-js then sends the user's JWT on
// every later admin query instead of the service key.
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '../../src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
}

describe('service-role client', () => {
  it('no source file signs a user in on the service-role client', () => {
    const offenders = walk(SRC).filter((f) =>
      /supabaseAdmin\s*\.auth\s*\.(signInWith\w+|signUp|verifyOtp|setSession|exchangeCodeForSession)\b/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([])
  })
})
