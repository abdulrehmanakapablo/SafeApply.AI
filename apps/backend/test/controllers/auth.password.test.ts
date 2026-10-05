import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabaseMock'
import { mockReq, mockRes } from '../helpers/http'

const { sbRef, verify } = vi.hoisted(() => ({
  sbRef: { current: null as unknown as ReturnType<typeof createSupabaseMock> },
  verify: vi.fn(),
}))
vi.mock('../../src/config/supabase', () => ({
  get supabaseAdmin() {
    return sbRef.current.client
  },
  supabase: {},
}))
vi.mock('../../src/utils/passwordCheck', () => ({ verifySupabasePassword: verify }))

import { changePassword, login } from '../../src/controllers/auth.controller'

const staleUser = { id: 'u-1', email: 'a@b.co', full_name: 'A B', role: 'user', plan: 'free', password_hash: '!' }

describe('auth password checks (F1)', () => {
  let r: ReturnType<typeof mockRes>
  beforeEach(() => {
    sbRef.current = createSupabaseMock()
    verify.mockReset()
    r = mockRes()
  })

  it('login with a stale mirror verifies through verifySupabasePassword, not supabaseAdmin', async () => {
    sbRef.current.queue('users', { data: staleUser, error: null })
    verify.mockResolvedValue(true)
    await login(mockReq({ body: { email: 'A@b.co ', password: 'pw' } }), r.res)
    expect(verify).toHaveBeenCalledWith('a@b.co', 'pw')
    expect(sbRef.current.client.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(r.statusCode()).toBe(200)
    expect(r.body().data.accessToken).toEqual(expect.any(String))
  })

  it('login returns 401 when the fallback check fails', async () => {
    sbRef.current.queue('users', { data: staleUser, error: null })
    verify.mockResolvedValue(false)
    await login(mockReq({ body: { email: 'a@b.co', password: 'nope' } }), r.res)
    expect(r.statusCode()).toBe(401)
    expect(r.body().error).toBe('Invalid email or password')
    expect(sbRef.current.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('changePassword verifies the current password through verifySupabasePassword', async () => {
    verify.mockResolvedValue(true)
    await changePassword(mockReq({ body: { current_password: 'old-pw', new_password: 'new-pw-123' } }), r.res)
    expect(verify).toHaveBeenCalledWith('a@b.co', 'old-pw')
    expect(sbRef.current.client.auth.signInWithPassword).not.toHaveBeenCalled()
    expect(sbRef.current.client.auth.admin.updateUserById).toHaveBeenCalledWith('u-1', { password: 'new-pw-123' })
    expect(r.statusCode()).toBe(200)
  })

  it('changePassword returns 401 on a wrong current password and never calls updateUserById', async () => {
    verify.mockResolvedValue(false)
    await changePassword(mockReq({ body: { current_password: 'wrong', new_password: 'new-pw-123' } }), r.res)
    expect(r.statusCode()).toBe(401)
    expect(r.body().error).toBe('Current password is incorrect')
    expect(sbRef.current.client.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
})
