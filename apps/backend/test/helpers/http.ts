// Minimal Express req/res fakes for calling controllers directly.
import type { Request, Response } from 'express'
import { vi } from 'vitest'

export function mockReq(over: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: { userId: 'u-1', email: 'a@b.co', role: 'user', plan: 'free' },
    ...over,
  } as unknown as Request
}

export function mockRes() {
  let code = 200
  let payload: any
  const res = {} as Response
  Object.assign(res, {
    status: vi.fn((c: number) => {
      code = c
      return res
    }),
    json: vi.fn((b: unknown) => {
      payload = b
      return res
    }),
    cookie: vi.fn(() => res),
    clearCookie: vi.fn(() => res),
  })
  return { res, statusCode: () => code, body: () => payload }
}
