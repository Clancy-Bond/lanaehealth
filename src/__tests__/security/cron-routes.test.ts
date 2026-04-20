/**
 * Track C — C-001 route-level regression test.
 *
 * For every Vercel cron target, a request without the shared secret
 * returns 401 on the method the cron invokes. Routes that read from
 * Supabase have the client mocked so the test can observe the 401
 * without spinning up a DB.
 *
 * Note: `/api/push/send` and `/api/push/prn-poll` keep GET as an
 * unauthenticated config probe (returns VAPID config flag). Only POST
 * is auth-gated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_SECRET = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = 'test-secret-cron-abc'
})

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = ORIGINAL_SECRET
})

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: async () => ({ error: null }),
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
  supabase: {},
}))

vi.mock('@/lib/integrations/sync-scheduler', () => ({
  runOverdueSyncs: async () => [],
  getSyncSummary: async () => ({ integrations: [] }),
}))

interface Handlers {
  GET?: (req: Request) => Promise<Response>
  POST?: (req: Request) => Promise<Response>
  methods?: Array<'GET' | 'POST'>
}

const cases: Array<{ name: string; methods: Array<'GET' | 'POST'>; load: () => Promise<Handlers> }> = [
  { name: 'api/sync', methods: ['GET', 'POST'], load: async () => await import('@/app/api/sync/route') },
  { name: 'api/weather', methods: ['GET', 'POST'], load: async () => await import('@/app/api/weather/route') },
  { name: 'api/weather/sync', methods: ['GET', 'POST'], load: async () => await import('@/app/api/weather/sync/route') },
  { name: 'api/cron/doctor-prep', methods: ['GET'], load: async () => await import('@/app/api/cron/doctor-prep/route') },
  { name: 'api/cron/build-status', methods: ['GET'], load: async () => await import('@/app/api/cron/build-status/route') },
  { name: 'api/push/send', methods: ['POST'], load: async () => await import('@/app/api/push/send/route') },
  { name: 'api/push/prn-poll', methods: ['POST'], load: async () => await import('@/app/api/push/prn-poll/route') },
]

describe('cron routes reject unauthenticated callers', () => {
  for (const tc of cases) {
    for (const method of tc.methods) {
      it(`${tc.name} ${method} 401s without Authorization`, async () => {
        const mod = await tc.load()
        const handler = mod[method as 'GET' | 'POST']
        if (!handler) return
        const res = await handler(
          new Request(`https://example.test/${tc.name}`, { method }),
        )
        expect(res.status).toBe(401)
      })

      it(`${tc.name} ${method} 401s with wrong bearer`, async () => {
        const mod = await tc.load()
        const handler = mod[method as 'GET' | 'POST']
        if (!handler) return
        const res = await handler(
          new Request(`https://example.test/${tc.name}`, {
            method,
            headers: { authorization: 'Bearer not-the-secret' },
          }),
        )
        expect(res.status).toBe(401)
      })

      it(`${tc.name} ${method} 401s when CRON_SECRET is unset`, async () => {
        delete process.env.CRON_SECRET
        const mod = await tc.load()
        const handler = mod[method as 'GET' | 'POST']
        if (!handler) return
        const res = await handler(
          new Request(`https://example.test/${tc.name}`, {
            method,
            headers: { authorization: 'Bearer anything' },
          }),
        )
        expect(res.status).toBe(401)
      })
    }
  }
})
