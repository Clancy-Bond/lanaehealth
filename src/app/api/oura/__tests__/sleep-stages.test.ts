/**
 * Tests for /api/oura/sleep-stages
 *
 * Verifies the endpoint reads the real oura_daily columns
 * (sleep_duration, deep_sleep_min, rem_sleep_min, raw_json) and correctly
 * converts seconds to minutes, builds a hypnogram, and reports bedtime/wakeTime
 * pulled from raw_json.sleep_detail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase service client. The route uses createServiceClient() and then
// chains .from(...).select(...).eq(...).maybeSingle(). We return a stub that
// captures the select list and resolves with a fixture row.
const mockSelectList = { value: '' }
const mockRow = {
  value: null as Record<string, unknown> | null,
}

vi.mock('@/lib/supabase', () => {
  const buildQuery = () => ({
    select: (cols: string) => {
      mockSelectList.value = cols
      return {
        eq: () => ({
          maybeSingle: async () => ({ data: mockRow.value, error: null }),
        }),
      }
    },
  })
  return {
    createServiceClient: () => ({
      from: () => buildQuery(),
    }),
    supabase: {},
  }
})

import { GET } from '../sleep-stages/route'
import { NextRequest } from 'next/server'

function makeReq(url: string): NextRequest {
  // NextRequest accepts a standard Request, which a string URL becomes via new Request(url)
  return new NextRequest(new Request(url))
}

describe('GET /api/oura/sleep-stages', () => {
  beforeEach(() => {
    mockSelectList.value = ''
    mockRow.value = null
  })

  it('selects the real oura_daily columns (not the legacy sleep_total/sleep_deep names)', async () => {
    mockRow.value = null // returns empty response, but we just assert the select
    await GET(makeReq('http://localhost:3005/api/oura/sleep-stages?date=2026-04-13'))

    expect(mockSelectList.value).toContain('sleep_duration')
    expect(mockSelectList.value).toContain('deep_sleep_min')
    expect(mockSelectList.value).toContain('rem_sleep_min')
    expect(mockSelectList.value).toContain('raw_json')
    // Negative asserts: none of the legacy nonexistent columns
    expect(mockSelectList.value).not.toMatch(/\bsleep_total\b/)
    expect(mockSelectList.value).not.toMatch(/\bsleep_deep\b/)
    expect(mockSelectList.value).not.toMatch(/\bsleep_rem\b/)
    expect(mockSelectList.value).not.toMatch(/\bsleep_light\b/)
    expect(mockSelectList.value).not.toMatch(/\bsleep_awake\b/)
    expect(mockSelectList.value).not.toMatch(/\bsleep_bedtime\b/)
    expect(mockSelectList.value).not.toMatch(/\bsleep_wake\b/)
  })

  it('returns an empty payload when no row exists for the date', async () => {
    mockRow.value = null
    const res = await GET(makeReq('http://localhost:3005/api/oura/sleep-stages?date=1999-01-01'))
    const body = await res.json()
    expect(body.stages).toEqual([])
    expect(body.totalMinutes).toBe(0)
    expect(body.bedtime).toBeNull()
    expect(body.wakeTime).toBeNull()
    expect(body.message).toBe('No sleep data for this night')
  })

  it('builds a hypnogram from aggregates for a real Oura night (2026-04-13)', async () => {
    // Fixture: real shape of the 2026-04-13 row from oura_daily
    // sleep_duration = 26820 seconds = 447 minutes
    // deep_sleep_min = 61, rem_sleep_min = 97
    // raw_json.sleep_detail.light_sleep_duration = 17370 sec = 290 min
    // raw_json.sleep_detail.awake_time = 2761 sec = 46 min
    mockRow.value = {
      date: '2026-04-13',
      sleep_duration: 26820,
      deep_sleep_min: 61,
      rem_sleep_min: 97,
      raw_json: {
        sleep_detail: {
          light_sleep_duration: 17370,
          awake_time: 2761,
          bedtime_start: '2026-04-12T22:55:28.000-10:00',
          bedtime_end: '2026-04-13T07:08:29.000-10:00',
        },
      },
    }

    const res = await GET(makeReq('http://localhost:3005/api/oura/sleep-stages?date=2026-04-13'))
    const body = await res.json()

    // totalMinutes should be ~447 (26820 / 60)
    expect(body.totalMinutes).toBe(Math.round(26820 / 60))

    // stages should not be empty
    expect(Array.isArray(body.stages)).toBe(true)
    expect(body.stages.length).toBeGreaterThan(0)

    // Each stage block has the expected shape
    for (const s of body.stages) {
      expect(s).toHaveProperty('startMinute')
      expect(s).toHaveProperty('stage')
      expect(s).toHaveProperty('durationMinutes')
      expect(['awake', 'rem', 'light', 'deep']).toContain(s.stage)
      expect(typeof s.startMinute).toBe('number')
      expect(typeof s.durationMinutes).toBe('number')
    }

    // We expect at least one block each of deep, rem, and light to appear
    const stageTypes = new Set(body.stages.map((s: { stage: string }) => s.stage))
    expect(stageTypes.has('deep')).toBe(true)
    expect(stageTypes.has('rem')).toBe(true)
    expect(stageTypes.has('light')).toBe(true)

    // bedtime + wake time are populated from raw_json.sleep_detail
    expect(body.bedtime).toMatch(/^\d{2}:\d{2}$/)
    expect(body.wakeTime).toMatch(/^\d{2}:\d{2}$/)
  })

  it('falls back to the sum of stage buckets when sleep_duration is missing', async () => {
    mockRow.value = {
      date: '2026-04-10',
      sleep_duration: null,
      deep_sleep_min: 60,
      rem_sleep_min: 90,
      raw_json: {
        sleep_detail: {
          light_sleep_duration: 12000, // 200 min
          awake_time: 1200, // 20 min
          bedtime_start: null,
          bedtime_end: null,
        },
      },
    }

    const res = await GET(makeReq('http://localhost:3005/api/oura/sleep-stages?date=2026-04-10'))
    const body = await res.json()
    // 60 + 90 + 200 + 20 = 370
    expect(body.totalMinutes).toBe(370)
    expect(body.stages.length).toBeGreaterThan(0)
    expect(body.bedtime).toBeNull()
    expect(body.wakeTime).toBeNull()
  })

  it('returns empty payload when the row has zero sleep of any kind', async () => {
    mockRow.value = {
      date: '1999-01-01',
      sleep_duration: null,
      deep_sleep_min: null,
      rem_sleep_min: null,
      raw_json: {},
    }

    const res = await GET(makeReq('http://localhost:3005/api/oura/sleep-stages?date=1999-01-01'))
    const body = await res.json()
    expect(body.stages).toEqual([])
    expect(body.totalMinutes).toBe(0)
    expect(body.message).toBe('No sleep stage data available')
  })
})
