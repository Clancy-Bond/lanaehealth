/**
 * Track C — C-002 regression test.
 *
 * `/api/health-sync` must enforce:
 *  - Fail-closed when HEALTH_SYNC_TOKEN is not configured (503).
 *  - Bearer auth via timing-safe compare (401 on mismatch).
 *  - 1 MB body cap (413 on breach).
 *  - Zod schema validation (400 on invalid payload).
 *  - 60 req / min / caller rate limit (429 on breach).
 *  - Happy path writes succeed (200).
 *  - Opaque error response on DB failure (never leaks supabase msg).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_TOKEN = process.env.HEALTH_SYNC_TOKEN

type MockTable = {
  upsertShouldFail?: boolean
}

const mockState: MockTable = { upsertShouldFail: false }

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (_table: string) => ({
      upsert: async () => ({
        error: mockState.upsertShouldFail ? { message: 'boom table detail' } : null,
      }),
    }),
  }),
  supabase: {},
}))

beforeEach(() => {
  process.env.HEALTH_SYNC_TOKEN = 'health-sync-test-token-xyz'
  mockState.upsertShouldFail = false
})

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.HEALTH_SYNC_TOKEN
  else process.env.HEALTH_SYNC_TOKEN = ORIGINAL_TOKEN
})

async function loadRoute() {
  vi.resetModules()
  const mod = await import('@/app/api/health-sync/route')
  mod.__resetRateLimitForTests()
  return mod
}

function url() {
  return 'https://example.test/api/health-sync'
}

function bearer(token = 'health-sync-test-token-xyz'): Record<string, string> {
  return { authorization: `Bearer ${token}` }
}

describe('health-sync route', () => {
  it('503s when HEALTH_SYNC_TOKEN is unset', async () => {
    delete process.env.HEALTH_SYNC_TOKEN
    const { POST } = await loadRoute()
    const res = await POST(new Request(url(), { method: 'POST', body: '{}' }) as never)
    expect(res.status).toBe(503)
  })

  it('401s on missing Authorization header', async () => {
    const { POST } = await loadRoute()
    const res = await POST(new Request(url(), { method: 'POST', body: '{}' }) as never)
    expect(res.status).toBe(401)
  })

  it('401s on wrong bearer', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      new Request(url(), {
        method: 'POST',
        body: '{}',
        headers: { ...bearer('nope'), 'content-type': 'application/json' },
      }) as never,
    )
    expect(res.status).toBe(401)
  })

  it('413s on body over 1 MB', async () => {
    const { POST } = await loadRoute()
    const oversized = 'x'.repeat(1_000_001)
    const res = await POST(
      new Request(url(), {
        method: 'POST',
        body: oversized,
        headers: { ...bearer(), 'content-length': String(oversized.length) },
      }) as never,
    )
    expect(res.status).toBe(413)
  })

  it('400s on invalid JSON', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      new Request(url(), {
        method: 'POST',
        body: '{not-json}',
        headers: bearer(),
      }) as never,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'invalid_json' })
  })

  it('400s on schema-invalid payload', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      new Request(url(), {
        method: 'POST',
        body: JSON.stringify({ menstrualFlow: 'not-an-array' }),
        headers: bearer(),
      }) as never,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'invalid_payload' })
  })

  it('200s on happy path and records counts', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      new Request(url(), {
        method: 'POST',
        body: JSON.stringify({
          menstrualFlow: [{ date: '2026-04-18', value: 'medium' }],
          basalTemp: [{ date: '2026-04-18', celsius: 36.5 }],
        }),
        headers: bearer(),
      }) as never,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.synced.menstrualFlow).toBe(1)
    expect(body.synced.basalTemp).toBe(1)
    expect(body.errors).toEqual([])
  })

  it('returns opaque write_failed on DB error and does not echo Supabase message', async () => {
    mockState.upsertShouldFail = true
    const { POST } = await loadRoute()
    const res = await POST(
      new Request(url(), {
        method: 'POST',
        body: JSON.stringify({
          menstrualFlow: [{ date: '2026-04-18', value: 'medium' }],
        }),
        headers: bearer(),
      }) as never,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors.every((s: string) => s === 'write_failed')).toBe(true)
    expect(JSON.stringify(body)).not.toContain('boom table detail')
  })

  it('429s when the rate limit is exceeded', async () => {
    process.env.RATE_LIMIT_IN_TESTS = '1'
    try {
      const { POST } = await loadRoute()
      // Default limit is 60 per minute. Fire 61 quick requests.
      for (let i = 0; i < 60; i++) {
        const res = await POST(
          new Request(url(), {
            method: 'POST',
            body: '{}',
            headers: bearer(),
          }) as never,
        )
        // 200 or 400 both indicate we passed the rate limiter.
        expect([200, 400]).toContain(res.status)
      }
      const res = await POST(
        new Request(url(), {
          method: 'POST',
          body: '{}',
          headers: bearer(),
        }) as never,
      )
      expect(res.status).toBe(429)
    } finally {
      delete process.env.RATE_LIMIT_IN_TESTS
    }
  })
})
