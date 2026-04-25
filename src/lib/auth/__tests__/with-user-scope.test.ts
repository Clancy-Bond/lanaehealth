import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
vi.mock('../get-user', () => ({ getCurrentUser: () => getCurrentUser() }))
const createServiceClient = vi.fn(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ createServiceClient: () => createServiceClient() }))

import { requireUserScope, insertForUser, upsertForUser } from '../with-user-scope'

describe('requireUserScope', () => {
  beforeEach(() => { getCurrentUser.mockReset(); createServiceClient.mockClear() })
  it('returns 401 when no session', async () => {
    getCurrentUser.mockResolvedValue(null)
    const ctx = await requireUserScope()
    expect(ctx.ok).toBe(false)
    if (ctx.ok) throw new Error('unreachable')
    expect(ctx.response.status).toBe(401)
  })
  it('returns user + supabase when session present', async () => {
    const user = { id: 'u', email: 'a@b.com' }
    getCurrentUser.mockResolvedValue(user)
    const ctx = await requireUserScope()
    expect(ctx.ok).toBe(true)
    if (!ctx.ok) throw new Error('unreachable')
    expect(ctx.user).toBe(user)
  })
})

describe('insertForUser', () => {
  it('attaches user_id automatically', () => {
    const insert = vi.fn(() => 'r')
    const sb = { from: vi.fn(() => ({ insert })) } as unknown as Parameters<typeof insertForUser>[0]
    insertForUser(sb, 't', { a: 1 }, 'u-1')
    expect(insert).toHaveBeenCalledWith({ a: 1, user_id: 'u-1' })
  })
})

describe('upsertForUser', () => {
  it('attaches user_id and forwards onConflict', () => {
    const upsert = vi.fn(() => 'r')
    const sb = { from: vi.fn(() => ({ upsert })) } as unknown as Parameters<typeof upsertForUser>[0]
    upsertForUser(sb, 't', { a: 1 }, 'u-1', { onConflict: 'user_id,date' })
    expect(upsert).toHaveBeenCalledWith({ a: 1, user_id: 'u-1' }, { onConflict: 'user_id,date' })
  })
})
