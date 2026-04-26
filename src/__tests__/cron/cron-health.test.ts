/**
 * Tests for /api/cron/_health and the cron_runs migration wiring.
 *
 * Cover:
 *   - 401s without bearer
 *   - 503 with `migration_045_not_applied` when the table is missing
 *   - aggregates per-cron status from a mocked supabase response
 *   - the notifications + push/send GET handlers (new alias) ALSO 401
 *     without the bearer (regression guard for the new code path)
 *
 * Mocks: createServiceClient is replaced with a chainable stub.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_SECRET = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret-cron-health'
})

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = ORIGINAL_SECRET
  vi.resetModules()
})

interface MockSupabaseConfig {
  recentRows?: unknown[]
  recentError?: { message: string } | null
  fallbackRow?: unknown
}

function buildMock({ recentRows = [], recentError = null, fallbackRow = null }: MockSupabaseConfig) {
  // Returns a chainable proxy that resolves like supabase-js: terminal
  // calls (.limit awaited, .maybeSingle, .single) return the same
  // shape, intermediate calls (.select/.eq/.gte/.order/.limit) return
  // the same chain so they can be chained further or awaited.
  return () => ({
    from: () => {
      let isInitialQuery = true
      const result = { data: recentRows, error: recentError }
      const fallback = { data: fallbackRow, error: null }
      const chain = {
        select: (..._args: unknown[]) => chain,
        eq: (..._args: unknown[]) => {
          isInitialQuery = false
          return chain
        },
        gte: (..._args: unknown[]) => chain,
        order: (..._args: unknown[]) => chain,
        // limit() doubles as a thenable so the route can await it
        // directly *and* chain `.maybeSingle()` afterwards.
        limit: (..._args: unknown[]) => {
          const promise = Promise.resolve(isInitialQuery ? result : fallback)
          return Object.assign(promise, {
            maybeSingle: () => Promise.resolve(fallback),
          })
        },
        maybeSingle: () => Promise.resolve(fallback),
        single: () => Promise.resolve(fallback),
        insert: (..._args: unknown[]) => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'fake-id' }, error: null }) }),
        }),
        update: (..._args: unknown[]) => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }
      return chain
    },
  })
}

describe('/api/cron/_health', () => {
  it('401s without Authorization', async () => {
    vi.doMock('@/lib/supabase', () => ({ createServiceClient: buildMock({}) }))
    const mod = await import('@/app/api/cron/_health/route')
    const res = await mod.GET(
      new Request('https://example.test/api/cron/_health', { method: 'GET' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 503 migration_045_not_applied when cron_runs table missing', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createServiceClient: buildMock({
        recentError: { message: 'relation "public.cron_runs" does not exist' },
      }),
    }))
    const mod = await import('@/app/api/cron/_health/route')
    const res = await mod.GET(
      new Request('https://example.test/api/cron/_health', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret-cron-health' },
      }),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe('migration_045_not_applied')
  })

  it('aggregates per-cron summary when table is present', async () => {
    const now = new Date().toISOString()
    vi.doMock('@/lib/supabase', () => ({
      createServiceClient: buildMock({
        recentRows: [
          {
            id: 'r1',
            cron_name: 'api/cron/notifications',
            started_at: now,
            completed_at: now,
            status: 'success',
            duration_ms: 120,
            payload_summary: 'subs=1 sent=0',
            error_message: null,
          },
          {
            id: 'r2',
            cron_name: 'api/cron/notifications',
            started_at: now,
            completed_at: now,
            status: 'failed',
            duration_ms: 80,
            payload_summary: null,
            error_message: 'kaboom',
          },
        ],
      }),
    }))
    const mod = await import('@/app/api/cron/_health/route')
    const res = await mod.GET(
      new Request('https://example.test/api/cron/_health', {
        method: 'GET',
        headers: { authorization: 'Bearer test-secret-cron-health' },
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      jobs: Array<{ cron_name: string; last_status: string; last_error: string | null }>
      failureCountLast24h: number
    }
    expect(body.failureCountLast24h).toBe(1)
    const notify = body.jobs.find((j) => j.cron_name === 'api/cron/notifications')!
    expect(notify.last_status).toBe('success')
    expect(notify.last_error).toBe('kaboom')
  })
})

describe('GET handlers added to formerly POST-only cron routes', () => {
  beforeEach(() => {
    vi.doMock('@/lib/supabase', () => ({
      createServiceClient: buildMock({}),
      supabase: {},
    }))
  })

  it('/api/cron/notifications GET 401s without bearer', async () => {
    const mod = await import('@/app/api/cron/notifications/route')
    const res = await mod.GET(
      new Request('https://example.test/api/cron/notifications', { method: 'GET' }),
    )
    expect(res.status).toBe(401)
  })

  it('/api/push/send GET without bearer returns vapidConfigured probe (200)', async () => {
    // Public probe stays open so the existing client widget keeps working.
    const mod = await import('@/app/api/push/send/route')
    const res = await mod.GET(
      new Request('https://example.test/api/push/send', { method: 'GET' }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { vapidConfigured: boolean }
    expect(typeof body.vapidConfigured).toBe('boolean')
  })
})
