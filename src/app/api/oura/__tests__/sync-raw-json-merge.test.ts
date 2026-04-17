/**
 * Tests for /api/oura/sync raw_json merge behavior.
 *
 * The sync route must NOT overwrite raw_json keys written by other importers
 * (e.g. raw_json.apple_health populated by /api/import/apple-health). Only
 * raw_json.oura should be (re-)written. This regression test mocks an
 * existing oura_daily row with a nested apple_health payload, runs the sync
 * POST handler with stubbed Oura API responses, and asserts that the final
 * upsert argument carries BOTH apple_health (preserved) AND oura (fresh).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture for assertion. The module-under-test calls supabase.from('oura_daily')
// with .upsert(rows, {onConflict:'date'}). We capture those rows.
const capturedUpsertArgs: { rows: unknown; onConflict: unknown }[] = []
const capturedSelectCalls: string[] = []

// Fixture existing rows -- keyed by date.
const existingRowsByDate: Record<string, { date: string; raw_json: Record<string, unknown> }> = {
  '2026-04-12': {
    date: '2026-04-12',
    raw_json: {
      apple_health: {
        source: 'apple_health_export',
        steps: 9123,
        active_energy: 412,
      },
      // intentionally include an older flat key that must not be preserved as-is
      // (this simulates a row from BEFORE the namespacing fix). It should be
      // overwritten cleanly by the new oura-key merge, but other importer keys
      // at the same level (apple_health) must survive.
      sleep_detail: {
        total_sleep_duration: 20000,
      },
    },
  },
}

vi.mock('@/lib/supabase', () => {
  const buildQuery = (table: string) => {
    const chain = {
      select: (cols: string) => {
        capturedSelectCalls.push(cols)
        return {
          in: (_col: string, dates: string[]) => {
            const rows = dates
              .map((d) => existingRowsByDate[d])
              .filter((r): r is { date: string; raw_json: Record<string, unknown> } => !!r)
            return Promise.resolve({ data: rows, error: null })
          },
        }
      },
      upsert: (rows: unknown, opts: { onConflict: string }) => {
        capturedUpsertArgs.push({ rows, onConflict: opts.onConflict })
        return Promise.resolve({ error: null })
      },
    }
    // mark `table` as used to satisfy eslint
    void table
    return chain
  }
  return {
    createServiceClient: () => ({
      from: (table: string) => buildQuery(table),
    }),
    supabase: {},
  }
})

// Stub the oura client helpers: provide a valid token and one-day worth of
// fake Oura API responses for the 2026-04-12 row.
vi.mock('@/lib/oura', () => ({
  getValidAccessToken: async () => 'fake-token',
  fetchSleepData: async () => ({
    data: [{ day: '2026-04-12', score: 82 }],
  }),
  fetchReadinessData: async () => ({
    data: [{ day: '2026-04-12', score: 74, temperature_deviation: 0.2 }],
  }),
  fetchStressData: async () => ({ data: [{ day: '2026-04-12', stress_high: 0 }] }),
  fetchSpO2Data: async () => ({
    data: [{ day: '2026-04-12', spo2_percentage: { average: 98 } }],
  }),
  fetchSleepDetail: async () => ({
    data: [
      {
        day: '2026-04-12',
        total_sleep_duration: 26820,
        deep_sleep_duration: 3660,
        rem_sleep_duration: 5820,
        average_hrv: 44,
        highest_hrv: 60,
        lowest_heart_rate: 48,
        average_breath: 14.2,
      },
    ],
  }),
}))

// Stub the auto-trigger so it does nothing during tests.
vi.mock('@/lib/intelligence/auto-trigger', () => ({
  maybeTriggerAnalysis: async () => undefined,
}))

import { POST } from '../sync/route'

function makePost(body: { start_date?: string; end_date?: string }): Request {
  return new Request('http://localhost:3005/api/oura/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/oura/sync raw_json merge', () => {
  beforeEach(() => {
    capturedUpsertArgs.length = 0
    capturedSelectCalls.length = 0
  })

  it('preserves raw_json.apple_health written by another importer while refreshing raw_json.oura', async () => {
    const res = await POST(
      makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest
    )
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.synced_days).toBeGreaterThan(0)

    // The sync must have read the existing raw_json to merge into it.
    expect(capturedSelectCalls.some((c) => c.includes('raw_json'))).toBe(true)

    // Exactly one upsert should have happened.
    expect(capturedUpsertArgs.length).toBe(1)
    const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
    expect(Array.isArray(rows)).toBe(true)
    const row = rows.find((r) => r.date === '2026-04-12')
    expect(row).toBeDefined()

    const rawJson = row!.raw_json as Record<string, unknown>

    // apple_health key from the previous importer MUST still be present.
    expect(rawJson.apple_health).toBeDefined()
    const applePart = rawJson.apple_health as Record<string, unknown>
    expect(applePart.source).toBe('apple_health_export')
    expect(applePart.steps).toBe(9123)

    // oura namespace is freshly populated with every stream.
    expect(rawJson.oura).toBeDefined()
    const ouraPart = rawJson.oura as Record<string, unknown>
    expect(ouraPart.sleep_daily).toBeDefined()
    expect(ouraPart.readiness).toBeDefined()
    expect(ouraPart.stress).toBeDefined()
    expect(ouraPart.spo2).toBeDefined()
    expect(ouraPart.sleep_detail).toBeDefined()

    // And onConflict should be by date.
    expect(capturedUpsertArgs[0].onConflict).toBe('date')
  })

  it('writes raw_json.oura for a date with no existing row (fresh insert path)', async () => {
    // Remove the fixture so the select returns nothing for this day.
    const priorFixture = existingRowsByDate['2026-04-12']
    delete existingRowsByDate['2026-04-12']
    try {
      const res = await POST(
        makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest
      )
      await res.json()
      expect(capturedUpsertArgs.length).toBe(1)
      const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
      const row = rows.find((r) => r.date === '2026-04-12')
      const rawJson = row!.raw_json as Record<string, unknown>
      // No apple_health to preserve; just oura present.
      expect(rawJson.apple_health).toBeUndefined()
      expect(rawJson.oura).toBeDefined()
    } finally {
      existingRowsByDate['2026-04-12'] = priorFixture
    }
  })
})
