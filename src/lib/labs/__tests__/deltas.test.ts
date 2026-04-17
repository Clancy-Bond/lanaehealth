/**
 * Tests for src/lib/labs/deltas.ts.
 *
 * Covers median math, daysBetween utility, and the computeDeltas reducer
 * over 30d / 90d / 1y windows. The brief specifies "current vs
 * 30-day, 90-day, 1-year rolling medians" so we validate both the
 * inclusion rule (strictly prior, within window) and the formatting helpers.
 */

import { describe, it, expect } from 'vitest'
import {
  median,
  daysBetween,
  computeDeltas,
  formatDelta,
  formatPercent,
  type TimedValue,
} from '@/lib/labs/deltas'

describe('median', () => {
  it('returns null for empty arrays', () => {
    expect(median([])).toBeNull()
  })
  it('returns the middle of odd-length arrays', () => {
    expect(median([5])).toBe(5)
    expect(median([3, 1, 2])).toBe(2)
  })
  it('averages the two middles of even-length arrays', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([10, 20])).toBe(15)
  })
})

describe('daysBetween', () => {
  it('computes positive day difference', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30)
  })
  it('handles month and year boundaries', () => {
    expect(daysBetween('2025-12-25', '2026-01-01')).toBe(7)
  })
  it('returns 0 for invalid dates', () => {
    expect(daysBetween('not-a-date', '2026-01-01')).toBe(0)
  })
})

describe('computeDeltas', () => {
  const series: TimedValue[] = [
    // 1+ year old reading
    { date: '2024-06-01', value: 40 },
    // 120 days prior (inside 1y only)
    { date: '2025-12-01', value: 50 },
    // 60 days prior (inside 90d + 1y)
    { date: '2026-01-30', value: 60 },
    // 20 days prior (inside 30d + 90d + 1y)
    { date: '2026-03-11', value: 70 },
    // current
    { date: '2026-03-31', value: 100 },
  ]

  it('returns null for empty series', () => {
    expect(computeDeltas([])).toBeNull()
  })

  it('picks the latest value as "current"', () => {
    const s = computeDeltas(series)
    expect(s?.current).toBe(100)
    expect(s?.currentDate).toBe('2026-03-31')
  })

  it('30-day window excludes readings older than 30d', () => {
    const s = computeDeltas(series)
    const w30 = s?.windows.find((w) => w.label === '30d')
    expect(w30).toBeDefined()
    // Only the 2026-03-11 reading (20 days prior) qualifies
    expect(w30?.sampleSize).toBe(1)
    expect(w30?.median).toBe(70)
    expect(w30?.delta).toBe(30)
    expect(w30?.percent).toBeCloseTo((30 / 70) * 100, 5)
  })

  it('90-day window includes the 60d and 20d readings', () => {
    const s = computeDeltas(series)
    const w90 = s?.windows.find((w) => w.label === '90d')
    expect(w90?.sampleSize).toBe(2)
    expect(w90?.median).toBe(65) // median of [60, 70]
    expect(w90?.delta).toBe(35)
  })

  it('1-year window includes all prior readings within 365 days', () => {
    const s = computeDeltas(series)
    const w1y = s?.windows.find((w) => w.label === '1y')
    // 2025-12-01 (121d prior), 2026-01-30 (60d), 2026-03-11 (20d)
    // The 2024-06-01 reading is > 365 days before 2026-03-31 so excluded.
    expect(w1y?.sampleSize).toBe(3)
    expect(w1y?.median).toBe(60) // median of [50, 60, 70]
    expect(w1y?.delta).toBe(40)
  })

  it('reports null median / delta for windows with no prior readings', () => {
    const s = computeDeltas([
      { date: '2026-04-01', value: 42 },
      { date: '2026-04-02', value: 50 },
    ])
    const w90 = s?.windows.find((w) => w.label === '90d')
    expect(w90?.sampleSize).toBe(1)
    expect(w90?.median).toBe(42)

    const singleton = computeDeltas([{ date: '2026-04-01', value: 42 }])
    const w30 = singleton?.windows.find((w) => w.label === '30d')
    expect(w30?.sampleSize).toBe(0)
    expect(w30?.median).toBeNull()
    expect(w30?.delta).toBeNull()
    expect(w30?.percent).toBeNull()
  })

  it('handles a median of 0 without dividing by zero for percent', () => {
    const s = computeDeltas([
      { date: '2026-01-01', value: 0 },
      { date: '2026-01-10', value: 5 },
    ])
    const w30 = s?.windows.find((w) => w.label === '30d')
    expect(w30?.median).toBe(0)
    expect(w30?.delta).toBe(5)
    expect(w30?.percent).toBeNull()
  })
})

describe('formatDelta', () => {
  it('uses +/- prefix and one decimal', () => {
    expect(formatDelta(3.14159)).toBe('+3.1')
    expect(formatDelta(-2.76)).toBe('-2.8')
    expect(formatDelta(0)).toBe('0')
  })
  it('returns "no baseline" for null', () => {
    expect(formatDelta(null)).toBe('no baseline')
  })
})

describe('formatPercent', () => {
  it('rounds to whole percent with + prefix', () => {
    expect(formatPercent(12.4)).toBe('+12%')
    expect(formatPercent(-4.6)).toBe('-5%')
    expect(formatPercent(0)).toBe('0%')
  })
  it('returns "no baseline" for null', () => {
    expect(formatPercent(null)).toBe('no baseline')
  })
})
