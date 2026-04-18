/**
 * Tests for POST /api/share/care-card (Wave 2d D6).
 *
 * Behavior locked in:
 *   - Missing SHARE_TOKEN_ADMIN_TOKEN env -> 401.
 *   - Wrong/missing client token -> 401.
 *   - Correct token + valid body -> 200 with { token, expiresAt, url }.
 *   - Unsupported resourceType -> 400.
 *   - Token string MUST NOT appear to encode body fields (opaque).
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

function buildReq(
  body: unknown,
  opts: { adminHeader?: string | null; queryToken?: string | null } = {},
) {
  const url = new URL('http://localhost:3005/api/share/care-card')
  if (opts.queryToken) url.searchParams.set('token', opts.queryToken)
  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.adminHeader !== undefined && opts.adminHeader !== null) {
    headers.set('x-share-admin-token', opts.adminHeader)
  }
  // Next's NextRequest is a thin wrapper around Request. The route only
  // reads .headers, .nextUrl, and .json(); all three are available here.
  const req = new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  }) as unknown as import('next/server').NextRequest
  // Simulate NextRequest.nextUrl
  Object.defineProperty(req, 'nextUrl', { value: url, configurable: true })
  return req
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  createCalls.length = 0
  delete process.env.SHARE_TOKEN_ADMIN_TOKEN
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('POST /api/share/care-card', () => {
  it('returns 401 when SHARE_TOKEN_ADMIN_TOKEN is not configured', async () => {
    const res = await POST(buildReq({ resourceType: 'care_card' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/not configured/i)
    expect(createCalls).toHaveLength(0)
  })

  it('returns 401 when no admin token is presented', async () => {
    process.env.SHARE_TOKEN_ADMIN_TOKEN = 'correct-secret'
    const res = await POST(buildReq({ resourceType: 'care_card' }))
    expect(res.status).toBe(401)
    expect(createCalls).toHaveLength(0)
  })

  it('returns 401 when the presented admin token is wrong', async () => {
    process.env.SHARE_TOKEN_ADMIN_TOKEN = 'correct-secret'
    const res = await POST(
      buildReq({ resourceType: 'care_card' }, { adminHeader: 'wrong' }),
    )
    expect(res.status).toBe(401)
    expect(createCalls).toHaveLength(0)
  })

  it('accepts a matching header token', async () => {
    process.env.SHARE_TOKEN_ADMIN_TOKEN = 'correct-secret'
    const res = await POST(
      buildReq({ resourceType: 'care_card' }, { adminHeader: 'correct-secret' }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.token).toBeTruthy()
    expect(json.expiresAt).toBeTruthy()
    expect(json.url).toMatch(/\/share\//)
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0].resourceType).toBe('care_card')
  })

  it('accepts a matching ?token= query param (fallback)', async () => {
    process.env.SHARE_TOKEN_ADMIN_TOKEN = 'correct-secret'
    const res = await POST(
      buildReq({ resourceType: 'care_card' }, { queryToken: 'correct-secret' }),
    )
    expect(res.status).toBe(200)
  })

  it('rejects unsupported resourceType with 400', async () => {
    process.env.SHARE_TOKEN_ADMIN_TOKEN = 'correct-secret'
    const res = await POST(
      buildReq(
        { resourceType: 'full_chart_dump' },
        { adminHeader: 'correct-secret' },
      ),
    )
    expect(res.status).toBe(400)
    expect(createCalls).toHaveLength(0)
  })

  it('response token does not embed any body field (opaque)', async () => {
    process.env.SHARE_TOKEN_ADMIN_TOKEN = 'correct-secret'
    const res = await POST(
      buildReq(
        { resourceType: 'care_card', resourceId: 'lanae-secret-id' },
        { adminHeader: 'correct-secret' },
      ),
    )
    const json = await res.json()
    expect(json.token).not.toContain('lanae')
    expect(json.token).not.toContain('care_card')
    // url carries the token but nothing else PII-bearing
    expect(json.url).not.toContain('lanae')
  })
})
