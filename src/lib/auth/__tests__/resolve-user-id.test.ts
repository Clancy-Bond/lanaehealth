import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getCurrentUser = vi.fn()
vi.mock('../get-user', () => ({ getCurrentUser: () => getCurrentUser() }))

import { resolveUserId, UserIdUnresolvableError } from '../resolve-user-id'

describe('resolveUserId', () => {
  const ORIG = process.env.OWNER_USER_ID
  beforeEach(() => { getCurrentUser.mockReset() })
  afterEach(() => {
    if (ORIG === undefined) delete process.env.OWNER_USER_ID
    else process.env.OWNER_USER_ID = ORIG
  })

  it('prefers Supabase session', async () => {
    getCurrentUser.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', email: 'a@b' })
    process.env.OWNER_USER_ID = '22222222-2222-2222-2222-222222222222'
    const r = await resolveUserId()
    expect(r.userId).toBe('11111111-1111-1111-1111-111111111111')
    expect(r.via).toBe('session')
  })

  it('falls back to OWNER_USER_ID env when no session', async () => {
    getCurrentUser.mockResolvedValue(null)
    process.env.OWNER_USER_ID = '22222222-2222-2222-2222-222222222222'
    const r = await resolveUserId()
    expect(r.userId).toBe('22222222-2222-2222-2222-222222222222')
    expect(r.via).toBe('owner_env')
  })

  it('throws when no session and no OWNER_USER_ID', async () => {
    getCurrentUser.mockResolvedValue(null)
    delete process.env.OWNER_USER_ID
    await expect(resolveUserId()).rejects.toBeInstanceOf(UserIdUnresolvableError)
  })

  it('rejects malformed OWNER_USER_ID (e.g. accidental whitespace)', async () => {
    getCurrentUser.mockResolvedValue(null)
    process.env.OWNER_USER_ID = 'not-a-uuid'
    await expect(resolveUserId()).rejects.toBeInstanceOf(UserIdUnresolvableError)
  })
})
