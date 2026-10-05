import { describe, expect, it } from 'vitest'
import { compareToken, hashToken } from '../../src/utils/hash'

describe('hash utils', () => {
  it('compareToken matches its own hash and rejects a malformed one', async () => {
    const h = await hashToken('abc')
    expect(await compareToken('abc', h)).toBe(true)
    expect(await compareToken('abc', 'short')).toBe(false)
  })
})
