import { describe, expect, it } from 'vitest'
import { normalizeGithub, normalizePhone, normalizePortfolio } from '../../src/utils/profileLinks'

describe('normalizePhone', () => {
  it('normalises to E.164', () => {
    expect(normalizePhone('+92 300-1234567')).toBe('+923001234567')
  })
  it.each(['03001234567', '+0123456789', '+12', '+9230012345678901', '', null])('rejects %s', (v) => {
    expect(normalizePhone(v)).toBeNull()
  })
})

describe('normalizeGithub', () => {
  it.each(['abdul-rehman', '@abdul-rehman', 'github.com/abdul-rehman', 'https://www.github.com/abdul-rehman/'])('accepts %s', (v) => {
    expect(normalizeGithub(v)).toBe('https://github.com/abdul-rehman')
  })
  it.each(['https://github.com/a/b', 'https://github.com/settings', '-bad', 'a--b', 'https://evil.com/github.com/x', 'https://user:pw@github.com/x', 'javascript:alert(1)'])(
    'rejects %s',
    (v) => {
      expect(normalizeGithub(v)).toBeNull()
    },
  )
})

describe('normalizePortfolio', () => {
  it('adds https and drops the fragment', () => {
    expect(normalizePortfolio('pablo.dev')).toBe('https://pablo.dev/')
    expect(normalizePortfolio('https://pablo.dev/work#top')).toBe('https://pablo.dev/work')
  })
  it.each(['http://pablo.dev', 'javascript:alert(1)', 'data:text/html,x', 'https://localhost/x', 'https://127.0.0.1', 'https://[::1]/', 'https://user:pw@pablo.dev', 'https://intranet'])(
    'rejects %s',
    (v) => {
      expect(normalizePortfolio(v)).toBeNull()
    },
  )
})
