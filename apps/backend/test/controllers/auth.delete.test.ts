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

import { deleteAccount } from '../../src/controllers/auth.controller'
import { deleteAccountSchema } from '../../src/validators/auth.validator'

describe('delete account re-authentication (F2)', () => {
  let r: ReturnType<typeof mockRes>
  beforeEach(() => {
    sbRef.current = createSupabaseMock()
    verify.mockReset()
    r = mockRes()
  })

  it('deleteAccountSchema requires a password', () => {
    expect(deleteAccountSchema.validate({ confirm: 'DELETE' }).error).toBeDefined()
    expect(deleteAccountSchema.validate({ confirm: 'DELETE', password: 'pw' }).error).toBeUndefined()
  })

  // 403, not 401: the frontend treats any 401 as an expired session and
  // replays the request after a refresh.
  it('wrong password → 403 and the user is not deleted', async () => {
    verify.mockResolvedValue(false)
    await deleteAccount(mockReq({ body: { confirm: 'DELETE', password: 'nope' } }), r.res)
    expect(r.statusCode()).toBe(403)
    expect(r.body().error).toBe('Password is incorrect')
    expect(sbRef.current.client.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('right password → deleteUser(userId) and 200', async () => {
    verify.mockResolvedValue(true)
    await deleteAccount(mockReq({ body: { confirm: 'DELETE', password: 'pw' } }), r.res)
    expect(verify).toHaveBeenCalledWith('a@b.co', 'pw')
    expect(sbRef.current.client.auth.admin.deleteUser).toHaveBeenCalledWith('u-1')
    expect(r.statusCode()).toBe(200)
  })
})
