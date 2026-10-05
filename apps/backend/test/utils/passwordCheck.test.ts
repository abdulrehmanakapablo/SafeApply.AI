import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, signIn } = vi.hoisted(() => {
  const signIn = vi.fn()
  const createClient = vi.fn(() => ({ auth: { signInWithPassword: signIn } }))
  return { createClient, signIn }
})
vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { verifySupabasePassword } from '../../src/utils/passwordCheck'

describe('verifySupabasePassword', () => {
  beforeEach(() => {
    createClient.mockClear()
    signIn.mockReset()
  })

  it('uses a fresh anon-key client per call, never the service key', async () => {
    signIn.mockResolvedValue({ data: { user: { id: 'u' } }, error: null })
    expect(await verifySupabasePassword('a@b.co', 'pw1')).toBe(true)
    expect(await verifySupabasePassword('a@b.co', 'pw2')).toBe(true)
    expect(createClient).toHaveBeenCalledTimes(2)
    for (const call of createClient.mock.calls as unknown as [string, string, { auth: object }][]) {
      expect(call[1]).toBe('anon-test-key')
      expect(call[2].auth).toMatchObject({ persistSession: false, autoRefreshToken: false })
    }
    expect(signIn).toHaveBeenCalledWith({ email: 'a@b.co', password: 'pw1' })
  })

  it('returns false on error or missing user', async () => {
    signIn.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } })
    expect(await verifySupabasePassword('a@b.co', 'x')).toBe(false)
    signIn.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect(await verifySupabasePassword('a@b.co', 'x')).toBe(false)
  })
})
