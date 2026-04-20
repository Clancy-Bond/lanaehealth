import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as logout } from '@/app/api/auth/logout/route'
import { SESSION_COOKIE_NAME } from '@/lib/auth/require-user'

const TOKEN = 'logintesttokenbase64paddedXY'
const PASSWORD = 'correct-horse-battery-staple'

function jsonReq(body: unknown): Request {
  return new Request('http://x/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/login', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.APP_AUTH_TOKEN = TOKEN
    process.env.APP_AUTH_PASSWORD = PASSWORD
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    Object.assign(process.env, originalEnv)
  })

  it('accepts the correct password and sets the session cookie', async () => {
    const res = await login(jsonReq({ password: PASSWORD }))
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=${TOKEN}`)
    expect(setCookie.toLowerCase()).toContain('httponly')
    expect(setCookie.toLowerCase()).toContain('samesite=strict')
  })

  it('rejects a wrong password with 401 and no cookie', async () => {
    const res = await login(jsonReq({ password: 'guessing' }))
    expect(res.status).toBe(401)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).not.toContain(TOKEN)
  })

  it('rejects a missing password field', async () => {
    const res = await login(jsonReq({}))
    expect(res.status).toBe(401)
  })

  it('returns 500 when server is misconfigured (no password env)', async () => {
    delete process.env.APP_AUTH_PASSWORD
    const res = await login(jsonReq({ password: PASSWORD }))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie with maxAge=0', async () => {
    const res = await logout()
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(setCookie.toLowerCase()).toMatch(/max-age=0/)
  })
})
