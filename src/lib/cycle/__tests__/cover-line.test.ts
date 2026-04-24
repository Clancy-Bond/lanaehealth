import { describe, it, expect } from 'vitest'
import { computeCoverLine } from '@/lib/cycle/cover-line'
import type { BbtReading } from '@/lib/cycle/bbt-source'

function makeAbsolute(values: number[], startDate = '2026-04-01'): BbtReading[] {
  const start = Date.parse(startDate + 'T00:00:00Z')
  return values.map((v, i) => ({
    date: new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    value: v,
    kind: 'absolute' as const,
    source: 'manual' as const,
  }))
}

function makeDeviation(values: number[], startDate = '2026-04-01'): BbtReading[] {
  const start = Date.parse(startDate + 'T00:00:00Z')
  return values.map((v, i) => ({
    date: new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    value: v,
    kind: 'deviation' as const,
    source: 'oura' as const,
  }))
}

describe('computeCoverLine', () => {
  it('returns null baseline when no readings', () => {
    const r = computeCoverLine([])
    expect(r.baseline).toBeNull()
    expect(r.kind).toBeNull()
    expect(r.confidence).toBe('low')
    expect(r.sampleSize).toBe(0)
  })

  it('returns low confidence on small samples (<5)', () => {
    const r = computeCoverLine(makeAbsolute([36.4, 36.5, 36.6]))
    expect(r.confidence).toBe('low')
    expect(r.sampleSize).toBe(3)
    expect(r.baseline).toBeCloseTo(36.5, 2)
  })

  it('returns medium confidence at mid sample size (14 readings)', () => {
    const r = computeCoverLine(makeAbsolute(Array.from({ length: 14 }, () => 36.5)))
    expect(r.confidence).toBe('medium')
    expect(r.baseline).toBeCloseTo(36.5, 3)
  })

  it('returns high confidence when sample is 28+', () => {
    const r = computeCoverLine(makeAbsolute(Array.from({ length: 30 }, (_, i) => 36.4 + (i % 3) * 0.05)))
    expect(r.confidence).toBe('high')
    expect(r.sampleSize).toBe(30)
  })

  it('drops 3-sigma outliers from the baseline calculation', () => {
    const series = makeAbsolute([
      36.4, 36.5, 36.45, 36.55, 36.5, 36.48, 36.52, 36.5, 36.48, 36.5,
      40.0, // garbage outlier
      36.5,
    ])
    const r = computeCoverLine(series)
    expect(r.baseline).toBeLessThan(36.6)
    expect(r.sampleSize).toBe(11) // outlier dropped
  })

  it('handles deviation streams (Oura) without confusing them with absolute readings', () => {
    const r = computeCoverLine(makeDeviation([0.1, 0.15, 0.2, 0.25, 0.3, 0.1, 0.15]))
    expect(r.kind).toBe('deviation')
    expect(r.baseline).toBeCloseTo(0.18, 1)
    expect(r.confidence).toBe('low') // 7 readings; below medium threshold
  })

  it('prefers deviation when both kinds are present in equal counts', () => {
    const r = computeCoverLine([
      ...makeAbsolute([36.5, 36.5, 36.5]),
      ...makeDeviation([0.2, 0.25, 0.3]),
    ])
    expect(r.kind).toBe('deviation')
    expect(r.baseline).toBeCloseTo(0.25, 2)
  })

  it('reports SD alongside the baseline for callers who need noise gating', () => {
    const r = computeCoverLine(makeAbsolute([36.4, 36.5, 36.6, 36.5, 36.5, 36.5]))
    expect(r.sd).not.toBeNull()
    expect(r.sd!).toBeGreaterThan(0)
    expect(r.sd!).toBeLessThan(0.2)
  })
})
