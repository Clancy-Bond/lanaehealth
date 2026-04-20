import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, resetRateLimitsForTests, clientIdFromRequest } from '../rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimitsForTests())

  it('allows calls up to the budget', () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit({ scope: 't', max: 3, windowMs: 60_000, key: 'k' })
      expect(r.ok).toBe(true)
    }
  })

  it('rejects the call that exceeds the budget', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ scope: 't', max: 3, windowMs: 60_000, key: 'k' })
    }
    const r = checkRateLimit({ scope: 't', max: 3, windowMs: 60_000, key: 'k' })
    expect(r.ok).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('keeps scopes and keys isolated from each other', () => {
    checkRateLimit({ scope: 'a', max: 1, windowMs: 60_000, key: 'k' })
    const other = checkRateLimit({ scope: 'b', max: 1, windowMs: 60_000, key: 'k' })
    expect(other.ok).toBe(true)
    const otherKey = checkRateLimit({ scope: 'a', max: 1, windowMs: 60_000, key: 'k2' })
    expect(otherKey.ok).toBe(true)
  })

  it('reset + re-allow after reset helper fires', () => {
    checkRateLimit({ scope: 't', max: 1, windowMs: 60_000, key: 'k' })
    const blocked = checkRateLimit({ scope: 't', max: 1, windowMs: 60_000, key: 'k' })
    expect(blocked.ok).toBe(false)
    resetRateLimitsForTests()
    const allowed = checkRateLimit({ scope: 't', max: 1, windowMs: 60_000, key: 'k' })
    expect(allowed.ok).toBe(true)
  })
})

describe('clientIdFromRequest', () => {
  function makeHeaders(h: Record<string, string>) {
    return { headers: new Headers(h) }
  }

  it('prefers x-forwarded-for when present', () => {
    const req = makeHeaders({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    expect(clientIdFromRequest(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = makeHeaders({ 'x-real-ip': '9.9.9.9' })
    expect(clientIdFromRequest(req)).toBe('9.9.9.9')
  })

  it('returns anon when no header is present', () => {
    const req = makeHeaders({})
    expect(clientIdFromRequest(req)).toBe('anon')
  })
})
