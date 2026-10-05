import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/config/env', () => ({ env: { redisUrl: 'https://example.upstash.io', redisToken: 't', ipHashSecret: 's' } }))

import { UpstashStore } from '../../src/middleware/rateLimitStore'

const opts = { windowMs: 60_000 } as never

afterEach(() => vi.unstubAllGlobals())

describe('UpstashStore', () => {
  it('counts with one EVAL and never sends the raw key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [3, 42_000] }) })
    vi.stubGlobal('fetch', fetchMock)
    const store = new UpstashStore('t1')
    store.init(opts)
    const r = await store.increment('1.2.3.4:victim@example.com')
    expect(r.totalHits).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = String(fetchMock.mock.calls[0][1].body)
    expect(body).toContain('EVAL')
    expect(body).not.toContain('victim@example.com')
    expect(body).not.toContain('1.2.3.4')
  })
  it('falls back to memory when Redis fails, still counting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    const store = new UpstashStore('t2')
    store.init(opts)
    expect((await store.increment('k')).totalHits).toBe(1)
    expect((await store.increment('k')).totalHits).toBe(2)
  })
})
