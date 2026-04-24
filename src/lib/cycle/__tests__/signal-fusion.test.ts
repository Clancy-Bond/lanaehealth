import { describe, it, expect } from 'vitest'
import { fuseOvulationSignal, detectBbtShift } from '@/lib/cycle/signal-fusion'
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
