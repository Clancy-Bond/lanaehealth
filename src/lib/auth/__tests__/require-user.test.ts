import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE_NAME,
  checkAuth,
  constantTimeEqual,
  isAuthed,
  requireAuth,
} from '../require-user'

const GOOD_TOKEN = 'test-token-long-enough-for-realistic-bytes-AA=='
const WRONG_TOKEN = 'wrong-token-same-length-for-constant-time-check'

function req(init: { auth?: string; cookie?: string } = {}): Request {
  const headers = new Headers()
  if (init.auth) headers.set('authorization', init.auth)
  if (init.cookie) headers.set('cookie', init.cookie)
  return new Request('http://x/test', { headers })
}

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
  })

  it('returns false for different-length strings without leaking shape', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
  })

  it('returns false for empty inputs', () => {
    expect(constantTimeEqual('', '')).toBe(false)
    expect(constantTimeEqual('abc', '')).toBe(false)
  })
})

describe('checkAuth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.APP_AUTH_TOKEN = GOOD_TOKEN
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key]
    }
    Object.assign(process.env, originalEnv)
  })

  it('accepts a valid Bearer token', () => {
    const r = checkAuth(req({ auth: `Bearer ${GOOD_TOKEN}` }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.via).toBe('bearer')
  })

  it('accepts a valid session cookie', () => {
    const r = checkAuth(
      req({ cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(GOOD_TOKEN)}` }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.via).toBe('cookie')
  })

  it('rejects a missing credential with 401', async () => {
    const r = checkAuth(req())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('rejects a wrong Bearer token with 401', async () => {
    const r = checkAuth(req({ auth: `Bearer ${WRONG_TOKEN}` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('rejects a wrong cookie value with 401', async () => {
    const r = checkAuth(req({ cookie: `${SESSION_COOKIE_NAME}=${WRONG_TOKEN}` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('returns 500 if APP_AUTH_TOKEN is unset (fail closed)', async () => {
    delete process.env.APP_AUTH_TOKEN
    const r = checkAuth(req({ auth: `Bearer ${GOOD_TOKEN}` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(500)
  })

  it('ignores malformed Authorization headers', () => {
    const r = checkAuth(req({ auth: GOOD_TOKEN }))
    expect(r.ok).toBe(false)
  })

  it('is case-insensitive on the Bearer scheme', () => {
    const r = checkAuth(req({ auth: `bearer ${GOOD_TOKEN}` }))
    expect(r.ok).toBe(true)
  })

  it('only reads the session cookie by name, not a substring', () => {
    const header = `x${SESSION_COOKIE_NAME}=${GOOD_TOKEN}`
    const r = checkAuth(req({ cookie: header }))
    expect(r.ok).toBe(false)
  })
})

describe('requireAuth and isAuthed', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.APP_AUTH_TOKEN = GOOD_TOKEN
  })

  afterEach(() => {
    Object.assign(process.env, originalEnv)
  })

  it('requireAuth mirrors checkAuth', () => {
    expect(requireAuth(req({ auth: `Bearer ${GOOD_TOKEN}` })).ok).toBe(true)
    expect(requireAuth(req()).ok).toBe(false)
  })

  it('isAuthed returns a boolean', () => {
    expect(isAuthed(req({ auth: `Bearer ${GOOD_TOKEN}` }))).toBe(true)
    expect(isAuthed(req())).toBe(false)
  })
})
