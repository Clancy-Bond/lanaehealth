import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getCurrentUser = vi.fn()
vi.mock('../get-user', () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}))

import { withUser } from '../with-auth'

function nextReq(): NextRequest {
  return new NextRequest('http://x/test')
}

describe('withUser', () => {
  it('returns 401 when no session', async () => {
    getCurrentUser.mockResolvedValue(null)
    const handler = vi.fn()
    const wrapped = withUser(handler)
    const res = await wrapped(nextReq())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'unauthenticated' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('invokes handler with user when session present', async () => {
    const user = { id: 'u1', email: 'a@b.com' }
    getCurrentUser.mockResolvedValue(user)
    const handler = vi.fn(async () => new Response('ok'))
    const wrapped = withUser(handler)
    const res = await wrapped(nextReq())
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
    const call = handler.mock.calls[0] as unknown as [unknown, { user: unknown }]
    expect(call[1].user).toEqual(user)
  })

  it('forwards params untouched', async () => {
    const user = { id: 'u1', email: 'a@b.com' }
    getCurrentUser.mockResolvedValue(user)
    const handler = vi.fn(async () => new Response('ok'))
    const wrapped = withUser<{ id: string }>(handler)
    await wrapped(nextReq(), { params: { id: 'abc' } })
    const call = handler.mock.calls[0] as unknown as [unknown, { params?: { id: string } }]
    expect(call[1].params).toEqual({ id: 'abc' })
  })
})
