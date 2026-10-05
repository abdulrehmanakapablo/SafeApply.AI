import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '../helpers/supabaseMock'
import { mockReq, mockRes } from '../helpers/http'

const { sbRef } = vi.hoisted(() => ({
  sbRef: { current: null as unknown as ReturnType<typeof createSupabaseMock> },
}))
vi.mock('../../src/config/supabase', () => ({
  get supabaseAdmin() {
    return sbRef.current.client
  },
  supabase: {},
}))

import * as tracker from '../../src/controllers/tracker.controller'

describe('tracker id validation', () => {
  beforeEach(() => {
    sbRef.current = createSupabaseMock()
  })

  it.each(['getApplication', 'updateApplication', 'deleteApplication', 'addCommunication'] as const)(
    '%s returns 400 for a non-UUID id without querying the DB',
    async (name) => {
      const r = mockRes()
      await tracker[name](mockReq({ params: { id: "1' or 1=1" }, body: {} } as never), r.res)
      expect(r.statusCode()).toBe(400)
      expect(r.body().error).toBe('Invalid application id')
      expect(sbRef.current.calls).toEqual([])
    },
  )
})
