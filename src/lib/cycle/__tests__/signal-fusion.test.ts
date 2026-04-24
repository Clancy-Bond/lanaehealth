import { describe, it, expect } from 'vitest'
import {
  fuseOvulationSignal,
  detectBbtShift,
  detectAnovulatoryCycle,
} from '@/lib/cycle/signal-fusion'
import type { BbtReading } from '@/lib/cycle/bbt-source'

function deviationSeries(values: number[], startDate = '2026-04-01'): BbtReading[] {
  const start = Date.parse(startDate + 'T00:00:00Z')
  return values.map((v, i) => ({
    date: new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    value: v,
    kind: 'deviation' as const,
    source: 'oura' as const,
  }))
}

describe('detectBbtShift', () => {
  it('returns null when fewer than 6 readings', () => {
    expect(detectBbtShift(deviationSeries([0, 0.1, 0.2]))).toBeNull()
  })

  it('detects a sustained 3-day rise above baseline', () => {
    // Baseline is around 0.0; the rise to 0.3 for 3 days is the shift.
    const series = deviationSeries([0, -0.05, 0.05, 0.0, 0.3, 0.35, 0.32])
    const shift = detectBbtShift(series)
    expect(shift).not.toBeNull()
    expect(shift!.shiftMagnitude).toBeGreaterThan(0.15)
  })

  it('returns null when the apparent rise is just one day', () => {
    const series = deviationSeries([0, 0, 0, 0, 0.3, 0, 0])
    expect(detectBbtShift(series)).toBeNull()
  })
})

describe('fuseOvulationSignal', () => {
  it('returns "none" with low confidence when nothing informative', () => {
    const r = fuseOvulationSignal({ bbt: [], lhTests: [], ncRows: [] })
    expect(r.source).toBe('none')
    expect(r.ovulationDate).toBeNull()
    expect(r.confidence).toBe('low')
  })

  it('honors NC OVU_CONFIRMED above all other signals', () => {
    const r = fuseOvulationSignal({
      bbt: deviationSeries([0, 0, 0, 0, 0, 0, 0]), // no shift
      ncRows: [
        {
          date: '2026-04-15',
          fertility_color: 'GREEN',
          ovulation_status: 'OVU_CONFIRMED',
          cycle_day: 14,
        },
      ],
    })
    expect(r.source).toBe('bbt+lh')
    expect(r.ovulationDate).toBe('2026-04-15')
    expect(r.confidence).toBe('high')
  })

  it('marks bbt+lh when a positive LH test precedes the BBT shift within 3 days', () => {
    const series = deviationSeries(
      [0, 0, -0.02, 0.05, 0.3, 0.35, 0.4],
      '2026-04-10',
    )
    const r = fuseOvulationSignal({
      bbt: series,
      lhTests: [{ date: '2026-04-12', result: 'positive' }],
    })
    expect(r.source).toBe('bbt+lh')
    expect(r.bbtShiftDetected).toBe(true)
    expect(r.lhPositiveDetected).toBe(true)
    expect(r.confidence).toBe('high')
  })

  it('classifies BBT-only signal with medium confidence on small shifts', () => {
    const series = deviationSeries([0, 0, 0, 0.16, 0.18, 0.17], '2026-04-10')
    const r = fuseOvulationSignal({ bbt: series })
    expect(r.source).toBe('bbt')
    expect(r.confidence).toBe('medium')
  })

  it('classifies LH-only as low confidence with rationale', () => {
    const r = fuseOvulationSignal({
      bbt: [],
      lhTests: [{ date: '2026-04-13', result: 'positive' }],
    })
    expect(r.source).toBe('lh')
    expect(r.confidence).toBe('low')
    expect(r.ovulationDate).toBe('2026-04-14')
    expect(r.rationale).toMatch(/24-48 hours/i)
  })

  it('falls back to calendar when no BBT or LH signal but cycle history is known', () => {
    const r = fuseOvulationSignal({
      bbt: [],
      cycleStartIso: '2026-04-01',
      meanCycleLength: 28,
    })
    expect(r.source).toBe('calendar')
    expect(r.ovulationDate).toBe('2026-04-15')
    expect(r.confidence).toBe('low')
  })

  it('respects a non-default luteal length when computing the calendar fallback', () => {
    const r = fuseOvulationSignal({
      bbt: [],
      cycleStartIso: '2026-04-01',
      meanCycleLength: 32,
      lutealLength: 12,
    })
    // 2026-04-01 + 20 days = 2026-04-21
    expect(r.ovulationDate).toBe('2026-04-21')
  })

  it('does not hallucinate ovulation when only negative LH tests are present', () => {
    const r = fuseOvulationSignal({
      bbt: [],
      lhTests: [
        { date: '2026-04-10', result: 'negative' },
        { date: '2026-04-11', result: 'negative' },
      ],
    })
    expect(r.source).toBe('none')
    expect(r.ovulationDate).toBeNull()
  })
})

describe('detectAnovulatoryCycle', () => {
  function flatSeries(value: number, count: number, startDate = '2026-04-01'): BbtReading[] {
    const start = Date.parse(startDate + 'T00:00:00Z')
    return Array.from({ length: count }, (_, i) => ({
      date: new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      value,
      kind: 'deviation' as const,
      source: 'oura' as const,
    }))
  }

  it('returns false when cover line is null (cannot decide)', () => {
    const readings = flatSeries(0.0, 28)
    expect(detectAnovulatoryCycle('2026-04-01', '2026-04-28', readings, null)).toBe(false)
  })

  it('returns false when fewer than 5 readings inside the window (under-logged, not anovulatory)', () => {
    const readings = flatSeries(0.0, 4)
    expect(detectAnovulatoryCycle('2026-04-01', '2026-04-28', readings, 0.0)).toBe(false)
  })

  it('returns true when temp stays at or below the cover line for the whole cycle', () => {
    // 28 days, all flat at 0.0 deviation, cover line at 0.0 -> no rise.
    const readings = flatSeries(0.0, 28)
    expect(detectAnovulatoryCycle('2026-04-01', '2026-04-28', readings, 0.0)).toBe(true)
  })

  it('returns false when a sustained 3-day shift above the line is present', () => {
    // Flat at 0.0 for 14 days, then rises to 0.2 for 14 days. Shift well
    // above the +0.10 anovulatory threshold.
    const start = Date.parse('2026-04-01T00:00:00Z')
    const readings: BbtReading[] = []
    for (let i = 0; i < 14; i++) {
      readings.push({
        date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
        value: 0.0,
        kind: 'deviation',
        source: 'oura',
      })
    }
    for (let i = 14; i < 28; i++) {
      readings.push({
        date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
        value: 0.2,
        kind: 'deviation',
        source: 'oura',
      })
    }
    expect(detectAnovulatoryCycle('2026-04-01', '2026-04-28', readings, 0.0)).toBe(false)
  })

  it('returns true when only a single brief blip (1 day) above the line exists', () => {
    // 28 days flat at 0.0 except day 14 which spikes to 0.5. A single-day
    // bump is NOT a sustained shift; cycle is still anovulatory.
    const start = Date.parse('2026-04-01T00:00:00Z')
    const readings: BbtReading[] = Array.from({ length: 28 }, (_, i) => ({
      date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      value: i === 14 ? 0.5 : 0.0,
      kind: 'deviation',
      source: 'oura',
    }))
    expect(detectAnovulatoryCycle('2026-04-01', '2026-04-28', readings, 0.0)).toBe(true)
  })

  it('honors the absolute kind: anovulatory when all temps stay below an absolute cover line', () => {
    const start = Date.parse('2026-04-01T00:00:00Z')
    const readings: BbtReading[] = Array.from({ length: 28 }, (_, i) => ({
      date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      value: 36.4,
      kind: 'absolute',
      source: 'manual',
    }))
    expect(detectAnovulatoryCycle('2026-04-01', '2026-04-28', readings, 36.5)).toBe(true)
  })

  it('returns false when periodEnd is before periodStart (invalid window)', () => {
    const readings = flatSeries(0.0, 28)
    expect(detectAnovulatoryCycle('2026-04-28', '2026-04-01', readings, 0.0)).toBe(false)
  })

  it('ignores readings outside the cycle window', () => {
    // Strong sustained rise BEFORE the cycle window starts; cycle window
    // itself is flat. Anovulatory.
    const start = Date.parse('2026-03-01T00:00:00Z')
    const earlierShift: BbtReading[] = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      value: 0.5,
      kind: 'deviation',
      source: 'oura',
    }))
    const cycleFlat = flatSeries(0.0, 28, '2026-04-01')
    expect(
      detectAnovulatoryCycle('2026-04-01', '2026-04-28', [...earlierShift, ...cycleFlat], 0.0),
    ).toBe(true)
  })
})
