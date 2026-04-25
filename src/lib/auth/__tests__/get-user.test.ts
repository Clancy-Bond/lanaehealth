import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the SSR Supabase client before importing the module under test.
const getUser = vi.fn()
vi.mock('../supabase-server', () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { getUser } })),
}))

import { UnauthenticatedError, getCurrentUser, requireUser } from '../get-user'

describe('getCurrentUser', () => {
  beforeEach(() => {
    getUser.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when no user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await getCurrentUser()).toBe(null)
  })

  it('returns null on error from Supabase', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('boom') })
    expect(await getCurrentUser()).toBe(null)
  })

  it('returns null when getSupabaseServerClient throws', async () => {
    getUser.mockImplementation(() => {
      throw new Error('no env')
    })
    expect(await getCurrentUser()).toBe(null)
  })

  it('returns user when present', async () => {
    const user = { id: 'u1', email: 'a@b.com' }
    getUser.mockResolvedValue({ data: { user }, error: null })
    expect(await getCurrentUser()).toEqual(user)
  })
})

describe('requireUser', () => {
  beforeEach(() => {
    getUser.mockReset()
  })

  it('throws UnauthenticatedError when no user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it('returns the user when present', async () => {
    const user = { id: 'u1', email: 'a@b.com' }
    getUser.mockResolvedValue({ data: { user }, error: null })
    expect(await requireUser()).toEqual(user)
  })
})
