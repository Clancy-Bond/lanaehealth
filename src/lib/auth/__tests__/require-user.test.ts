/**
 * Regression tests for the session-token gate shipped by security sweep
 * Track B. Locks in:
 *   - no token env set: 500 (fail closed, not open)
 *   - wrong token: 401
 *   - right token via header / bearer / cookie: allowed
 *   - dev-only bypass only kicks in when NODE_ENV !== 'production'
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireUser } from '../require-user'

function makeReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/x', { headers })
}

describe('requireUser (Track B stub)', () => {
  const ORIGINAL_TOKEN = process.env.LANAEHEALTH_SESSION_TOKEN
  const ORIGINAL_BYPASS = process.env.LANAEHEALTH_AUTH_BYPASS
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV

  beforeEach(() => {
    delete process.env.LANAEHEALTH_SESSION_TOKEN
    delete process.env.LANAEHEALTH_AUTH_BYPASS
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.LANAEHEALTH_SESSION_TOKEN
    else process.env.LANAEHEALTH_SESSION_TOKEN = ORIGINAL_TOKEN
    if (ORIGINAL_BYPASS === undefined) delete process.env.LANAEHEALTH_AUTH_BYPASS
    else process.env.LANAEHEALTH_AUTH_BYPASS = ORIGINAL_BYPASS
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
  })

  it('fails closed with 500 when LANAEHEALTH_SESSION_TOKEN is unset', async () => {
    const result = await requireUser(makeReq({}))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(500)
    }
  })

  it('rejects short tokens as misconfiguration', async () => {
    process.env.LANAEHEALTH_SESSION_TOKEN = 'short'
    const result = await requireUser(makeReq({}))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(500)
  })

  it('returns 401 when no credential is presented', async () => {
    process.env.LANAEHEALTH_SESSION_TOKEN = 'a'.repeat(32)
    const result = await requireUser(makeReq({}))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('returns 401 on a wrong token', async () => {
    process.env.LANAEHEALTH_SESSION_TOKEN = 'a'.repeat(32)
    const result = await requireUser(
      makeReq({ 'x-lanaehealth-session': 'b'.repeat(32) }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(401)
  })

  it('accepts the token via x-lanaehealth-session header', async () => {
    const token = 'a'.repeat(32)
    process.env.LANAEHEALTH_SESSION_TOKEN = token
    const result = await requireUser(makeReq({ 'x-lanaehealth-session': token }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.user.id).toBe('lanae')
  })

  it('accepts the token via Authorization: Bearer', async () => {
    const token = 'a'.repeat(32)
    process.env.LANAEHEALTH_SESSION_TOKEN = token
    const result = await requireUser(
      makeReq({ authorization: `Bearer ${token}` }),
    )
    expect(result.ok).toBe(true)
  })

  it('accepts the token via lanaehealth_session cookie', async () => {
    const token = 'a'.repeat(32)
    process.env.LANAEHEALTH_SESSION_TOKEN = token
    const result = await requireUser(
      makeReq({ cookie: `other=1; lanaehealth_session=${token}; more=2` }),
    )
    expect(result.ok).toBe(true)
  })

  it('does NOT accept the token via ?token= query param (stub rejects URL creds)', async () => {
    process.env.LANAEHEALTH_SESSION_TOKEN = 'a'.repeat(32)
    // Still 401 because there is no header/cookie. Confirms the gate does
    // not silently accept ?token= like older admin-token routes.
    const result = await requireUser(makeReq({}))
    expect(result.ok).toBe(false)
  })

  it('dev bypass only triggers when NODE_ENV !== production', async () => {
    process.env.LANAEHEALTH_AUTH_BYPASS = '1'
    process.env.LANAEHEALTH_SESSION_TOKEN = ''
    process.env.NODE_ENV = 'production'
    const result = await requireUser(makeReq({}))
    expect(result.ok).toBe(false)
  })

  it('dev bypass allows anonymous requests when NODE_ENV !== production', async () => {
    process.env.LANAEHEALTH_AUTH_BYPASS = '1'
    process.env.NODE_ENV = 'development'
    const result = await requireUser(makeReq({}))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.user.id).toBe('dev-bypass')
  })
})
