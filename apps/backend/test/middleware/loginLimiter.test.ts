import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { mockReq } from '../helpers/http'
import { loginEmailKey, loginEmailLimiter } from '../../src/middleware/rateLimiter'

describe('per-account login limit (F3)', () => {
  it('loginEmailKey ignores IP, case and whitespace', () => {
    const a = loginEmailKey(mockReq({ ip: '1.1.1.1', body: { email: 'Victim@X.com ' } } as never))
    const b = loginEmailKey(mockReq({ ip: '9.9.9.9', body: { email: 'victim@x.com' } } as never))
    expect(a).toBe(b)
  })

  it('31st failed attempt for one email from rotating IPs → 429, other emails unaffected', async () => {
    const app = express()
    app.set('trust proxy', 1)
    app.use(express.json())
    app.post('/l', loginEmailLimiter, (_req, res) => {
      res.status(401).end()
    })

    for (let i = 0; i < 30; i++) {
      await request(app).post('/l').set('X-Forwarded-For', `10.0.${i}.1`).send({ email: 'v@x.com' }).expect(401)
    }
    const blocked = await request(app).post('/l').set('X-Forwarded-For', '10.9.9.9').send({ email: 'V@x.com' })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error).toBe('Too many login attempts for this account. Try again in an hour.')

    await request(app).post('/l').set('X-Forwarded-For', '10.9.9.9').send({ email: 'other@x.com' }).expect(401)
  })
})
