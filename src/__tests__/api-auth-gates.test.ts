/**
 * Regression tests: every scoped Track A route rejects unauthenticated
 * traffic with 401. Mocks the downstream handlers so we only exercise
 * the auth gate.
 *
 * Security sweep 2026-04-19, Track A.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// These mocks prevent real DB / AI work from running during the gate
// check. Every module the routes import is replaced by a no-op.
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: () => () => ({}) }),
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ error: null, data: [], count: 0 }),
        order: () => ({
          limit: () => Promise.resolve({ error: null, data: [] }),
          ascending: () => ({}),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      update: () => ({
        eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }),
      }),
    }),
    rpc: () => Promise.resolve({ error: null }),
  }),
}))

vi.mock('@/lib/context/permanent-core', () => ({
  generatePermanentCore: () => Promise.resolve('core'),
}))
vi.mock('@/lib/context/summary-engine', () => ({
  detectRelevantTopics: () => [],
  getSummary: () => Promise.resolve(''),
  regenerateAllSummaries: () => Promise.resolve({}),
}))
vi.mock('@/lib/context/assembler', () => ({
  getFullSystemPrompt: () =>
    Promise.resolve({ systemPrompt: '', tokenEstimate: 0, charCount: 0, sections: { summaries: [] } }),
}))
vi.mock('@/lib/context/handoff', () => ({
  getLatestHandoff: () => Promise.resolve(null),
}))
vi.mock('@/lib/context/dream-cycle', () => ({
  runDreamCycle: () => Promise.resolve({}),
}))
vi.mock('@/lib/context/vector-store', () => ({
  getVectorStoreStats: () => Promise.resolve({}),
}))
vi.mock('@/lib/context/sync-pipeline', () => ({
  syncDateRange: () => Promise.resolve(0),
  syncAllHistory: () => Promise.resolve(0),
}))
vi.mock('@/lib/intelligence/auto-trigger', () => ({
  maybeTriggerAnalysis: () => Promise.resolve(),
}))
vi.mock('@/lib/api/user-preferences', () => ({
  getPreferences: () => Promise.resolve(null),
  savePreferences: () => Promise.resolve(),
  MODULE_DEFINITIONS: [],
  CONDITION_PRESETS: [],
  getDefaultModulesForArchetype: () => [],
}))
vi.mock('@/lib/api/privacy-prefs', () => ({
  getPrivacyPrefs: () => Promise.resolve({}),
  updatePrivacyPrefs: () => Promise.resolve({}),
}))

const GOOD = 'track-a-test-token-bytes-base64-encoded-len-==xx'

function noAuth(url: string, init: RequestInit = {}): Request {
  return new Request(url, init)
}

describe('auth-gated routes reject unauthenticated requests', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.APP_AUTH_TOKEN = GOOD
  })

  afterEach(() => {
    Object.assign(process.env, originalEnv)
  })

  const cases: Array<[
    string,
    () => Promise<{ default?: unknown; GET?: Function; POST?: Function; PUT?: Function; PATCH?: Function }>,
    Array<'GET' | 'POST' | 'PUT' | 'PATCH'>,
  ]> = [
    ['api/admin/apply-migration-011',
      () => import('@/app/api/admin/apply-migration-011/route'),
      ['GET', 'POST']],
    ['api/admin/apply-migration-013',
      () => import('@/app/api/admin/apply-migration-013/route'),
      ['GET', 'POST']],
    ['api/profile',
      () => import('@/app/api/profile/route'),
      ['PUT']],
    ['api/onboarding',
      () => import('@/app/api/onboarding/route'),
      ['GET', 'POST']],
    ['api/preferences',
      () => import('@/app/api/preferences/route'),
      ['GET', 'PUT']],
    ['api/privacy-prefs',
      () => import('@/app/api/privacy-prefs/route'),
      ['GET', 'PATCH']],
    ['api/health',
      () => import('@/app/api/health/route'),
      ['GET']],
    ['api/context/core',
      () => import('@/app/api/context/core/route'),
      ['GET']],
    ['api/context/assemble',
      () => import('@/app/api/context/assemble/route'),
      ['POST']],
    ['api/context/summaries',
      () => import('@/app/api/context/summaries/route'),
      ['GET', 'POST']],
    ['api/context/sync',
      () => import('@/app/api/context/sync/route'),
      ['GET', 'POST']],
    ['api/context/sync-status',
      () => import('@/app/api/context/sync-status/route'),
      ['GET']],
    ['api/context/dream',
      () => import('@/app/api/context/dream/route'),
      ['POST']],
    ['api/context/test',
      () => import('@/app/api/context/test/route'),
      ['GET']],
  ]

  for (const [name, loader, verbs] of cases) {
    for (const verb of verbs) {
      it(`${verb} ${name} returns 401 without credentials`, async () => {
        const mod = (await loader()) as Record<string, (r: Request) => Promise<Response>>
        const handler = mod[verb]
        expect(handler).toBeTypeOf('function')
        const res = await handler(noAuth(`http://x/${name}`, { method: verb, body: verb === 'GET' ? undefined : '{}' }))
        expect(res.status).toBe(401)
      })

      it(`${verb} ${name} accepts a valid Bearer token`, async () => {
        const mod = (await loader()) as Record<string, (r: Request) => Promise<Response>>
        const handler = mod[verb]
        const req = new Request(`http://x/${name}`, {
          method: verb,
          headers: { authorization: `Bearer ${GOOD}`, 'content-type': 'application/json' },
          body: verb === 'GET' ? undefined : '{}',
        })
        const res = await handler(req)
        // Accept any non-401 response; a 200 is ideal but 400/500 still
        // proves auth passed.
        expect(res.status).not.toBe(401)
      })
    }
  }
})
