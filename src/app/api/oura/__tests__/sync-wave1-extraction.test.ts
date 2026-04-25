/**
 * Tests for /api/oura/sync Wave 1 extraction logic.
 *
 * Covers the new column writes added by migrations 030-034:
 *   - sleep_latency_min   (sleep_detail.latency seconds -> minutes)
 *   - stress_high_min     (stress.stress_high)
 *   - recovery_high_min   (stress.recovery_high)
 *   - stress_score        (stress.stress_high only, no recovery_high fallback)
 *   - breathing_disturbance_index (spo2.breathing_disturbance_index)
 *   - hrv_max             (max of sleep_detail.hrv.items intraday array)
 *   - activity_score + intensity buckets (sedentary/low/medium/high)
 *
 * Also exercises the pure helpers `secondsToMinutes` and `computeHrvMax`
 * which the route exports for accountability.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const capturedUpsertArgs: { rows: unknown }[] = []

vi.mock('@/lib/supabase', () => {
  const buildQuery = () => ({
    select: () => ({
      // user-scoped read: .select(cols).eq('user_id', uid).in('date', dates)
      eq: () => ({
        in: () => Promise.resolve({ data: [], error: null }),
      }),
      in: () => Promise.resolve({ data: [], error: null }),
    }),
    upsert: (rows: unknown) => {
      capturedUpsertArgs.push({ rows })
      return Promise.resolve({ error: null })
    },
  })
  return {
    createServiceClient: () => ({ from: () => buildQuery() }),
    supabase: {},
  }
})

vi.mock('@/lib/oura', () => ({
  getValidAccessToken: async () => 'fake-token',
  fetchSleepData: async () => ({
    data: [{ day: '2026-04-12', score: 82 }],
  }),
  fetchReadinessData: async () => ({
    data: [{ day: '2026-04-12', score: 74, temperature_deviation: 0.2 }],
  }),
  fetchStressData: async () => ({
    data: [
      {
        day: '2026-04-12',
        stress_high: 1800, // 30 minutes
        recovery_high: 7200, // 120 minutes
      },
    ],
  }),
  fetchSpO2Data: async () => ({
    data: [
      {
        day: '2026-04-12',
        spo2_percentage: { average: 98 },
        breathing_disturbance_index: 7,
      },
    ],
  }),
  fetchSleepDetail: async () => ({
    data: [
      {
        day: '2026-04-12',
        total_sleep_duration: 26820,
        deep_sleep_duration: 3660,
        rem_sleep_duration: 5820,
        average_hrv: 44,
        // highest_hrv intentionally omitted: Oura's /sleep does not return it.
        // hrv_max should be computed from the intraday items array below.
        hrv: { items: [40, 55, 62, 48, null, 51, 60] },
        latency: 720, // seconds -> 12 minutes
        lowest_heart_rate: 48,
        average_breath: 14.2,
      },
    ],
  }),
  fetchActivityData: async () => ({
    data: [
      {
        day: '2026-04-12',
        score: 73,
        steps: 5432,
        active_calories: 210,
        total_calories: 1980,
        sedentary_time: 18000, // 300 min
        low_activity_time: 9000, // 150 min
        medium_activity_time: 1800, // 30 min
        high_activity_time: 600, // 10 min
      },
    ],
  }),
}))

vi.mock('@/lib/intelligence/auto-trigger', () => ({
  maybeTriggerAnalysis: async () => undefined,
}))

import { POST, computeHrvMax, secondsToMinutes } from '../sync/route'

function makePost(body: { start_date: string; end_date: string }): Request {
  return new Request('http://localhost:3005/api/oura/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/oura/sync wave 1 extraction', () => {
  beforeEach(() => {
    capturedUpsertArgs.length = 0
    // resolveUserId() falls back to OWNER_USER_ID when there is no
    // session. The cron path takes that branch, so set it here.
    process.env.OWNER_USER_ID = '11111111-1111-1111-1111-111111111111'
  })

  it('writes sleep_latency_min from sleep_detail.latency in whole minutes', async () => {
    const res = await POST(
      makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest,
    )
    await res.json()
    const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
    const row = rows.find((r) => r.date === '2026-04-12')!
    expect(row.sleep_latency_min).toBe(12)
  })

  it('splits stress_high_min and recovery_high_min into separate columns and never conflates them', async () => {
    const res = await POST(
      makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest,
    )
    await res.json()
    const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
    const row = rows.find((r) => r.date === '2026-04-12')!
    expect(row.stress_high_min).toBe(1800)
    expect(row.recovery_high_min).toBe(7200)
    // stress_score keeps backward compat but is now ONLY sourced from
    // stress_high. It must equal stress_high, NEVER recovery_high.
    expect(row.stress_score).toBe(1800)
    expect(row.stress_score).not.toBe(7200)
  })

  it('writes breathing_disturbance_index from spo2 payload', async () => {
    const res = await POST(
      makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest,
    )
    await res.json()
    const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
    const row = rows.find((r) => r.date === '2026-04-12')!
    expect(row.breathing_disturbance_index).toBe(7)
  })

  it('writes hrv_max as the max of the intraday hrv.items array, not from highest_hrv', async () => {
    const res = await POST(
      makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest,
    )
    await res.json()
    const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
    const row = rows.find((r) => r.date === '2026-04-12')!
    // [40, 55, 62, 48, null, 51, 60] -> max 62, ignoring the null
    expect(row.hrv_max).toBe(62)
  })

  it('writes activity_score and the four intensity buckets in minutes', async () => {
    const res = await POST(
      makePost({ start_date: '2026-04-12', end_date: '2026-04-13' }) as unknown as import('next/server').NextRequest,
    )
    await res.json()
    const rows = capturedUpsertArgs[0].rows as Array<Record<string, unknown>>
    const row = rows.find((r) => r.date === '2026-04-12')!
    expect(row.activity_score).toBe(73)
    expect(row.sedentary_min).toBe(300)
    expect(row.low_activity_min).toBe(150)
    expect(row.medium_activity_min).toBe(30)
    expect(row.high_activity_min).toBe(10)
  })
})

describe('secondsToMinutes', () => {
  it('rounds seconds to whole minutes', () => {
    expect(secondsToMinutes(60)).toBe(1)
    expect(secondsToMinutes(90)).toBe(2)
    expect(secondsToMinutes(120)).toBe(2)
    expect(secondsToMinutes(0)).toBe(0)
  })

  it('returns null on missing or non-finite input', () => {
    expect(secondsToMinutes(undefined)).toBeNull()
    expect(secondsToMinutes(null)).toBeNull()
    expect(secondsToMinutes(NaN)).toBeNull()
    expect(secondsToMinutes(Infinity)).toBeNull()
    expect(secondsToMinutes('120')).toBeNull()
  })
})

describe('computeHrvMax', () => {
  it('returns the max of finite numeric items', () => {
    expect(computeHrvMax({ hrv: { items: [40, 55, 62, 48] } })).toBe(62)
  })

  it('skips null and non-finite entries', () => {
    expect(
      computeHrvMax({
        hrv: { items: [40, null, NaN, 55, undefined, 70] as unknown[] },
      }),
    ).toBe(70)
  })

  it('returns null when items is missing or empty', () => {
    expect(computeHrvMax({})).toBeNull()
    expect(computeHrvMax({ hrv: {} })).toBeNull()
    expect(computeHrvMax({ hrv: { items: [] } })).toBeNull()
    expect(computeHrvMax({ hrv: { items: [null, NaN] } })).toBeNull()
  })

  it('returns null when hrv is not an object', () => {
    expect(computeHrvMax({ hrv: null })).toBeNull()
    expect(computeHrvMax({ hrv: 42 })).toBeNull()
  })
})
