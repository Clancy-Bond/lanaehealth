/**
 * Tests for Positional Vitals Intelligence
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyOrthostatic, classifyBP, classifyRestingHR, detectMultiVitalOutlier } from '../../api/vitals-classification'

// ── Shared mock state for getVitalsIntelligence tests ───────────────
// These rows feed the mocked supabase client below. Tests mutate them in
// beforeEach / test body.
let labRows: Array<{ date: string; value: number; test_name: string }> = []
let ouraTodayRow: { resting_hr: number | null; hrv_avg: number | null; body_temp_deviation: number | null; spo2_avg: number | null } | null = null
let ouraBaselineRows: Array<{ resting_hr: number | null; hrv_avg: number | null; body_temp_deviation: number | null; spo2_avg: number | null }> = []

type QueryState = {
  table: string
  rows: Array<{ date: string; value: number; test_name: string }>
  filterDate?: string
  filterNames?: string[]
  filterSingleName?: string
  limitVal?: number
}

function makeLabQuery(): unknown {
  const state: QueryState = { table: 'lab_results', rows: labRows }
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.in = (col: string, values: string[]) => {
    if (col === 'test_name') state.filterNames = values
    return builder
  }
  builder.eq = (col: string, value: string) => {
    if (col === 'date') state.filterDate = value
    else if (col === 'test_name') state.filterSingleName = value
    return builder
  }
  builder.gte = () => builder
  builder.order = () => builder
  builder.limit = (n: number) => { state.limitVal = n; return builder }
  const resolve = () => {
    let rows = state.rows
    if (state.filterDate) rows = rows.filter(r => r.date === state.filterDate)
    if (state.filterNames) rows = rows.filter(r => state.filterNames?.includes(r.test_name))
    if (state.filterSingleName) rows = rows.filter(r => r.test_name === state.filterSingleName)
    return rows
  }
  builder.maybeSingle = () => Promise.resolve({ data: resolve()[0] ?? null, error: null })
  builder.then = (cb: (v: { data: unknown[]; error: null }) => unknown) =>
    cb({ data: resolve(), error: null })
  return builder
}

function makeOuraQuery(isToday: boolean): unknown {
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.gte = () => builder
  builder.order = () => builder
  builder.maybeSingle = () => Promise.resolve({ data: isToday ? ouraTodayRow : null, error: null })
  builder.then = (cb: (v: { data: unknown[]; error: null }) => unknown) =>
    cb({ data: ouraBaselineRows, error: null })
  return builder
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'lab_results') return makeLabQuery()
      if (table === 'oura_daily') {
        // First call is today lookup (.eq('date', today).maybeSingle()).
        // Second call is baseline (.gte('date', ...).order()).
        // Our makeOuraQuery covers both via maybeSingle vs then.
        return makeOuraQuery(true)
      }
      return makeLabQuery()
    },
  }),
  supabase: {},
}))

describe('Vitals Classification', () => {
  describe('Orthostatic HR Delta', () => {
    it('should classify 30+ bpm as POTS threshold', () => {
      const result = classifyOrthostatic(32)
      expect(result.meetsPOTS).toBe(true)
      expect(result.label).toContain('POTS')
    })

    it('should classify 40+ bpm as significant', () => {
      const result = classifyOrthostatic(45)
      expect(result.meetsPOTS).toBe(true)
      expect(result.label).toContain('Significant')
    })

    it('should classify <10 bpm as normal', () => {
      const result = classifyOrthostatic(8)
      expect(result.meetsPOTS).toBe(false)
      expect(result.label).toContain('Normal')
    })

    it('should classify 20-29 bpm as elevated', () => {
      const result = classifyOrthostatic(25)
      expect(result.meetsPOTS).toBe(false)
      expect(result.label).toContain('Elevated')
    })
  })

  describe('Blood Pressure Classification (AHA)', () => {
    it('should classify 115/75 as normal', () => {
      const result = classifyBP(115, 75)
      expect(result.category).toBe('normal')
    })

    it('should classify 125/78 as elevated', () => {
      const result = classifyBP(125, 78)
      expect(result.category).toBe('elevated')
    })

    it('should classify 135/85 as stage 1 hypertension', () => {
      const result = classifyBP(135, 85)
      expect(result.category).toBe('stage1')
    })

    it('should classify 155/95 as stage 2 hypertension', () => {
      const result = classifyBP(155, 95)
      expect(result.category).toBe('stage2')
    })

    it('should classify 185/125 as hypertensive crisis', () => {
      const result = classifyBP(185, 125)
      expect(result.category).toBe('crisis')
    })
  })

  describe('Resting Heart Rate', () => {
    it('should classify 48 bpm as bradycardia', () => {
      const result = classifyRestingHR(48)
      expect(result.zone).toBe('bradycardia')
    })

    it('should classify 55 bpm as athletic', () => {
      const result = classifyRestingHR(55)
      expect(result.zone).toBe('athletic')
    })

    it('should classify 72 bpm as normal', () => {
      const result = classifyRestingHR(72)
      expect(result.zone).toBe('normal')
    })

    it('should classify 110 bpm as elevated', () => {
      const result = classifyRestingHR(110)
      expect(result.zone).toBe('elevated')
    })

    it('should classify 125 bpm as tachycardia', () => {
      const result = classifyRestingHR(125)
      expect(result.zone).toBe('tachycardia')
    })
  })

  describe('Multi-Vital Outlier Detection', () => {
    it('should detect outlier when 2+ metrics deviate', () => {
      const result = detectMultiVitalOutlier(
        { hr: 75, hrv: 30, temp: 37.5 },
        {
          hr: { mean: 50, std: 5 },  // 75 is 5 std devs above
          hrv: { mean: 65, std: 10 }, // 30 is 3.5 std devs below
          temp: { mean: 36.5, std: 0.3 }, // 37.5 is 3.3 std devs above
        },
      )
      expect(result.isOutlier).toBe(true)
      expect(result.deviatingMetrics.length).toBeGreaterThanOrEqual(2)
      expect(result.severity).toBe('significant')
    })

    it('should NOT flag normal variation', () => {
      const result = detectMultiVitalOutlier(
        { hr: 52, hrv: 62, temp: 36.6 },
        {
          hr: { mean: 50, std: 5 },
          hrv: { mean: 65, std: 10 },
          temp: { mean: 36.5, std: 0.3 },
        },
      )
      expect(result.isOutlier).toBe(false)
      expect(result.deviatingMetrics.length).toBe(0)
    })
  })
})

// ── Orthostatic delta sourcing (direct vs computed) ────────────────
// Import after mocks are defined so the module picks up our stubbed client.
import { computePulseDeltasFromRows, getVitalsIntelligence } from '@/lib/ai/vitals-intelligence'

describe('computePulseDeltasFromRows', () => {
  it('pairs supine + standing on the same date and returns the delta', () => {
    const pairs = computePulseDeltasFromRows([
      { date: '2026-04-07', value: 91, test_name: 'Supine pulse rate' },
      { date: '2026-04-07', value: 106, test_name: 'Standing Pulse Rate' },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual({ date: '2026-04-07', supine: 91, standing: 106, delta: 15 })
  })

  it('matches case-insensitively (myAH uses mixed casing)', () => {
    const pairs = computePulseDeltasFromRows([
      { date: '2026-04-07', value: 91, test_name: 'SUPINE PULSE RATE' },
      { date: '2026-04-07', value: 106, test_name: 'standing pulse rate' },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].delta).toBe(15)
  })

  it('drops dates where only one half of the pair is present', () => {
    const pairs = computePulseDeltasFromRows([
      { date: '2026-04-07', value: 91, test_name: 'Supine pulse rate' },
      // no standing row on 04-07
      { date: '2026-04-09', value: 88, test_name: 'Supine pulse rate' },
      { date: '2026-04-09', value: 120, test_name: 'Standing Pulse Rate' },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].date).toBe('2026-04-09')
    expect(pairs[0].delta).toBe(32)
  })
})

describe('getVitalsIntelligence: delta source resolution', () => {
  beforeEach(() => {
    labRows = []
    ouraTodayRow = null
    ouraBaselineRows = []
  })

  it('uses direct Orthostatic HR Delta row when present', async () => {
    labRows = [
      { date: '2026-04-05', value: 12, test_name: 'Orthostatic HR Delta' },
      { date: '2026-04-05', value: 70, test_name: 'HR (supine)' },
      { date: '2026-04-05', value: 82, test_name: 'HR (standing)' },
    ]
    const result = await getVitalsIntelligence()
    expect(result.thirtyDayTrend.totalTests).toBe(1)
    expect(result.thirtyDayTrend.directCount).toBe(1)
    expect(result.thirtyDayTrend.computedCount).toBe(0)
    expect(result.latestOrthostatic?.hrDelta).toBe(12)
    expect(result.latestOrthostatic?.source).toBe('direct')
  })

  it('computes delta from myAH supine + standing rows when no direct delta exists', async () => {
    // Mirrors the real 2026-04-07 myAH row set: supine 91, standing 106.
    labRows = [
      { date: '2026-04-07', value: 91, test_name: 'Supine pulse rate' },
      { date: '2026-04-07', value: 106, test_name: 'Standing Pulse Rate' },
    ]
    const result = await getVitalsIntelligence()
    expect(result.thirtyDayTrend.totalTests).toBe(1)
    expect(result.thirtyDayTrend.directCount).toBe(0)
    expect(result.thirtyDayTrend.computedCount).toBe(1)
    expect(result.latestOrthostatic).not.toBeNull()
    expect(result.latestOrthostatic?.supineHR).toBe(91)
    expect(result.latestOrthostatic?.standingHR).toBe(106)
    expect(result.latestOrthostatic?.hrDelta).toBe(15)
    expect(result.latestOrthostatic?.source).toBe('computed')
    // Below POTS threshold of 30
    expect(result.latestOrthostatic?.meetsPOTSThreshold).toBe(false)
    expect(result.thirtyDayTrend.meetsPOTSCount).toBe(0)
  })

  it('ignores a date that has only one half of the pair (partial data)', async () => {
    // Supine only -- no pair possible, should not surface as a test.
    labRows = [
      { date: '2026-04-10', value: 80, test_name: 'Supine pulse rate' },
    ]
    const result = await getVitalsIntelligence()
    expect(result.thirtyDayTrend.totalTests).toBe(0)
    expect(result.thirtyDayTrend.directCount).toBe(0)
    expect(result.thirtyDayTrend.computedCount).toBe(0)
    expect(result.latestOrthostatic).toBeNull()
  })

  it('prefers direct delta over computed when both exist for the same date', async () => {
    // Direct delta is 12, but raw pulse rows imply 15. Direct wins.
    labRows = [
      { date: '2026-04-07', value: 12, test_name: 'Orthostatic HR Delta' },
      { date: '2026-04-07', value: 91, test_name: 'Supine pulse rate' },
      { date: '2026-04-07', value: 106, test_name: 'Standing Pulse Rate' },
    ]
    const result = await getVitalsIntelligence()
    expect(result.thirtyDayTrend.totalTests).toBe(1)
    expect(result.thirtyDayTrend.directCount).toBe(1)
    expect(result.thirtyDayTrend.computedCount).toBe(0)
    expect(result.latestOrthostatic?.hrDelta).toBe(12)
    expect(result.latestOrthostatic?.source).toBe('direct')
  })

  it('unions direct and computed across different dates', async () => {
    labRows = [
      { date: '2026-04-05', value: 10, test_name: 'Orthostatic HR Delta' },
      { date: '2026-04-07', value: 91, test_name: 'Supine pulse rate' },
      { date: '2026-04-07', value: 106, test_name: 'Standing Pulse Rate' },
    ]
    const result = await getVitalsIntelligence()
    expect(result.thirtyDayTrend.totalTests).toBe(2)
    expect(result.thirtyDayTrend.directCount).toBe(1)
    expect(result.thirtyDayTrend.computedCount).toBe(1)
    // Latest date is 2026-04-07, which is the computed one.
    expect(result.latestOrthostatic?.date).toBe('2026-04-07')
    expect(result.latestOrthostatic?.source).toBe('computed')
  })
})
