/**
 * Tests for POST /api/auth/v2/change-password.
 *
 * The route does three things:
 *   1. Refuse anonymous callers (401)
 *   2. Validate body shape + new-password rules
 *   3. Re-verify the current password against Supabase Auth
 *      before rotating, so a stolen session cannot lock the
 *      real owner out
 *
 * We mock the auth helpers and the Supabase client so the spec
 * stays hermetic. The integration shape (header propagation,
 * cookie rewrite) is covered by the wider auth e2e suite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requireUser = vi.fn()
const updateUser = vi.fn()
const signInWithPassword = vi.fn()
const createServerClientStub = vi.fn(async () => ({ auth: { updateUser } }))

vi.mock('@/lib/auth/get-user', () => ({
  requireUser,
  UnauthenticatedError: class UnauthenticatedError extends Error {
    constructor() {
      super('unauthenticated')
      this.name = 'UnauthenticatedError'
    }
  },
}))
vi.mock('@/lib/auth/supabase-server', () => ({
  getSupabaseServerClient: createServerClientStub,
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}))

let POST: (req: Request) => Promise<Response>
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  POST = (await import('@/app/api/auth/v2/change-password/route')).POST
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonReq(body: unknown): Request {
  return new Request('http://x/api/auth/v2/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const SESSION_USER = { id: 'u-123', email: 'lanae@example.com' }

describe('POST /api/auth/v2/change-password', () => {
  it('rejects anonymous callers with 401', async () => {
    // Use the mocked UnauthenticatedError class so the route's
    // `instanceof` check matches.
    const mod = await import('@/lib/auth/get-user')
    requireUser.mockRejectedValueOnce(new mod.UnauthenticatedError())
    const res = await POST(jsonReq({ currentPassword: 'a', newPassword: 'b' }))
    expect(res.status).toBe(401)
  })

  it('rejects a body missing fields', async () => {
    requireUser.mockResolvedValueOnce(SESSION_USER)
    const res = await POST(jsonReq({ currentPassword: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects a new password shorter than 8 characters', async () => {
    requireUser.mockResolvedValueOnce(SESSION_USER)
    const res = await POST(jsonReq({ currentPassword: 'oldoldoldold', newPassword: 'short' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/at least 8/i)
  })

  it('rejects a new password that equals the current password', async () => {
    requireUser.mockResolvedValueOnce(SESSION_USER)
    const res = await POST(jsonReq({ currentPassword: 'samepass1', newPassword: 'samepass1' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/different/i)
  })

  it('refuses sso accounts that have no email on file', async () => {
    requireUser.mockResolvedValueOnce({ id: 'u-456', email: null })
    const res = await POST(jsonReq({ currentPassword: 'oldoldoldold', newPassword: 'newnewnewnew' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/single sign-on|forgot password/i)
  })

  it('rejects an incorrect current password and does not call updateUser', async () => {
    requireUser.mockResolvedValueOnce(SESSION_USER)
    signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials', status: 400 },
    })

    const res = await POST(jsonReq({ currentPassword: 'wrongpassword', newPassword: 'newpass1234' }))
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/current password is incorrect/i)
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rotates the password when the current is verified', async () => {
    requireUser.mockResolvedValueOnce(SESSION_USER)
    signInWithPassword.mockResolvedValueOnce({
      data: { user: SESSION_USER, session: {} },
      error: null,
    })
    updateUser.mockResolvedValueOnce({ data: { user: SESSION_USER }, error: null })

    const res = await POST(jsonReq({ currentPassword: 'oldpass1234', newPassword: 'newpass1234' }))
    expect(res.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith({ password: 'newpass1234' })
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 500 when updateUser fails after the verification succeeds', async () => {
    requireUser.mockResolvedValueOnce(SESSION_USER)
    signInWithPassword.mockResolvedValueOnce({
      data: { user: SESSION_USER, session: {} },
      error: null,
    })
    updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'storage backend down' },
    })

    const res = await POST(jsonReq({ currentPassword: 'oldpass1234', newPassword: 'newpass1234' }))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/could not update/i)
  })
})
