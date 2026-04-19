/**
 * Tests for POST /api/share/care-card.
 *
 * Behavior locked in (post sweep 2026-04-19):
 *   - Missing APP_AUTH_TOKEN env -> 500 (server misconfigured).
 *   - Wrong/missing Bearer token -> 401.
 *   - Correct Bearer + valid body -> 200 with { token, expiresAt, url }.
 *   - Unsupported resourceType -> 400.
 *   - Token string MUST NOT appear to encode body fields (opaque).
 *   - No `?token=` query fallback: the prior pattern landed the token
 *     in history / referer / access logs (D-001, D-008 class).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture calls to createShareToken so we can make cheap assertions.
const createCalls: Array<Record<string, unknown>> = []

vi.mock('@/lib/api/share-tokens', () => ({
  createShareToken: vi.fn(async (input: Record<string, unknown>) => {
    createCalls.push(input)
    return {
      token: 'fake-random-token-00000000000000000000000000000000',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }),
}))

import { POST } from '../route'

const APP_TOKEN = 'share-care-card-test-token'

function buildReq(
  body: unknown,
  opts: { bearer?: string | null } = {},
) {
  const url = new URL('http://localhost:3005/api/share/care-card')
  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.bearer) headers.set('authorization', `Bearer ${opts.bearer}`)
  const req = new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  }) as unknown as import('next/server').NextRequest
  Object.defineProperty(req, 'nextUrl', { value: url, configurable: true })
  return req
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  createCalls.length = 0
  process.env.APP_AUTH_TOKEN = APP_TOKEN
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('POST /api/share/care-card', () => {
  it('returns 500 when APP_AUTH_TOKEN is not configured (server misconfigured)', async () => {
    delete process.env.APP_AUTH_TOKEN
    const res = await POST(buildReq({ resourceType: 'care_card' }))
    expect(res.status).toBe(500)
    expect(createCalls).toHaveLength(0)
  })

  it('returns 401 when no Bearer is presented', async () => {
    const res = await POST(buildReq({ resourceType: 'care_card' }))
    expect(res.status).toBe(401)
    expect(createCalls).toHaveLength(0)
  })

  it('returns 401 when the presented Bearer is wrong', async () => {
    const res = await POST(
      buildReq({ resourceType: 'care_card' }, { bearer: 'wrong' }),
    )
    expect(res.status).toBe(401)
    expect(createCalls).toHaveLength(0)
  })

  it('accepts a matching Bearer token', async () => {
    const res = await POST(
      buildReq({ resourceType: 'care_card' }, { bearer: APP_TOKEN }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.token).toBeTruthy()
    expect(json.expiresAt).toBeTruthy()
    expect(json.url).toMatch(/\/share\//)
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0].resourceType).toBe('care_card')
  })

  it('rejects unsupported resourceType with 400 when authed', async () => {
    const res = await POST(
      buildReq(
        { resourceType: 'full_chart_dump' },
        { bearer: APP_TOKEN },
      ),
    )
    expect(res.status).toBe(400)
    expect(createCalls).toHaveLength(0)
  })

  it('response token does not embed any body field (opaque)', async () => {
    const res = await POST(
      buildReq(
        { resourceType: 'care_card', resourceId: 'lanae-secret-id' },
        { bearer: APP_TOKEN },
      ),
    )
    const json = await res.json()
    expect(typeof json.token).toBe('string')
    expect(json.token).not.toContain('lanae')
    expect(json.token).not.toContain('care_card')
    expect(json.url).not.toContain('lanae')
  })
})
