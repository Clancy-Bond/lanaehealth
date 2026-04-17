/**
 * Tests for anovulatory cycle detection.
 *
 * Covers edge cases called out in the competitive spec:
 *   - low temperature data (<10 days) returns insufficient_data
 *   - cycles with a clear biphasic shift are classified ovulatory
 *   - cycles where the user is on hormonal birth control are never flagged
 *   - idempotent row shape for correlation_results
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateCycleAnovulatory,
  detectBiphasicShift,
  detectLhSurge,
  buildCyclesFromNc,
  evaluateNcCycles,
  toCorrelationRow,
  MIN_TEMP_DAYS,
  type CycleWindow,
} from '../intelligence/anovulatory-detection'
import type { NcImported } from '../types'

function mkDay(
  date: string,
  temperature: number | null,
  lh: string | null = null
): CycleWindow['days'][number] {
  return { date, temperature, lh_test: lh }
}

function mkNcRow(
  date: string,
  overrides: Partial<NcImported> = {}
): NcImported {
  return {
    id: date,
    date,
    temperature: null,
    menstruation: null,
    flow_quantity: null,
    cervical_mucus_consistency: null,
    cervical_mucus_quantity: null,
    mood_flags: null,
    lh_test: null,
    cycle_day: null,
    cycle_number: null,
    fertility_color: null,
    ovulation_status: null,
    data_flags: null,
    imported_at: `${date}T00:00:00Z`,
    ...overrides,
  }
}

describe('detectBiphasicShift', () => {
  it('returns true when a sustained rise of >=0.2C appears after a baseline', () => {
    const temps = [
      36.3, 36.25, 36.28, 36.31, 36.27, 36.29, // baseline ~36.28
      36.55, 36.6, 36.58, // sustained above 36.48
    ]
    expect(detectBiphasicShift(temps)).toBe(true)
  })

  it('returns false when the rise is too small or not sustained', () => {
    const temps = [
      36.3, 36.25, 36.28, 36.31, 36.27, 36.29,
      36.35, 36.4, 36.38, // barely above, never crosses +0.2
    ]
    expect(detectBiphasicShift(temps)).toBe(false)
  })

  it('returns false with fewer than 9 readings', () => {
    expect(detectBiphasicShift([36.3, 36.4, 36.5])).toBe(false)
  })
})

describe('detectLhSurge', () => {
  it('returns true when any result contains "positive"', () => {
    expect(detectLhSurge([null, null, 'Positive'])).toBe(true)
  })

  it('returns true when any result contains "peak"', () => {
    expect(detectLhSurge(['low', 'peak'])).toBe(true)
  })

  it('returns false when all results are negative or missing', () => {
    expect(detectLhSurge([null, 'negative', ''])).toBe(false)
  })
})

describe('evaluateCycleAnovulatory', () => {
  it('returns insufficient_data when temperature days < MIN_TEMP_DAYS', () => {
    const cycle: CycleWindow = {
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-28',
      days: [
        mkDay('2026-03-01', 36.3),
        mkDay('2026-03-02', 36.4),
        mkDay('2026-03-03', null),
        mkDay('2026-03-04', 36.5),
      ],
    }
    const result = evaluateCycleAnovulatory(cycle)
    expect(result.status).toBe('insufficient_data')
    expect(result.signals.tempDaysAvailable).toBeLessThan(MIN_TEMP_DAYS)
    expect(result.reason).toContain('temperature')
  })

  it('classifies a cycle with a clear biphasic shift as likely_ovulatory', () => {
    const baseline = 36.28
    const days: CycleWindow['days'] = []
    // 6 days of baseline temps
    for (let i = 0; i < 6; i++) {
      days.push(mkDay(`2026-03-0${i + 1}`, baseline + (i % 2 === 0 ? -0.02 : 0.02)))
    }
    // 10 days after shift, all above baseline + 0.2
    for (let i = 0; i < 10; i++) {
      const day = (7 + i).toString().padStart(2, '0')
      days.push(mkDay(`2026-03-${day}`, 36.6))
    }
    const cycle: CycleWindow = {
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-28',
      days,
    }
    const result = evaluateCycleAnovulatory(cycle)
    expect(result.status).toBe('likely_ovulatory')
    expect(result.signals.biphasicShiftDetected).toBe(true)
  })

  it('classifies LH surge only as likely_ovulatory', () => {
    const days: CycleWindow['days'] = []
    for (let i = 0; i < 15; i++) {
      const day = (i + 1).toString().padStart(2, '0')
      days.push(mkDay(`2026-03-${day}`, 36.3 + (i % 3) * 0.01, i === 12 ? 'positive' : null))
    }
    const cycle: CycleWindow = {
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-28',
      days,
    }
    const result = evaluateCycleAnovulatory(cycle)
    expect(result.status).toBe('likely_ovulatory')
    expect(result.signals.lhSurgeDetected).toBe(true)
  })

  it('flags cycles with no biphasic shift and no LH surge as likely_anovulatory', () => {
    const days: CycleWindow['days'] = []
    for (let i = 0; i < 15; i++) {
      const day = (i + 1).toString().padStart(2, '0')
      days.push(mkDay(`2026-03-${day}`, 36.3))
    }
    const cycle: CycleWindow = {
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-28',
      days,
    }
    const result = evaluateCycleAnovulatory(cycle)
    expect(result.status).toBe('likely_anovulatory')
    expect(result.reason).toContain('sustained temperature shift')
    // Copy must be reassuring, not diagnostic
    expect(result.reason.toLowerCase()).not.toMatch(/infertil|diagnos|abnormal|disorder/)
  })

  it('never flags a cycle when hormonal birth control is active', () => {
    const days: CycleWindow['days'] = []
    for (let i = 0; i < 15; i++) {
      const day = (i + 1).toString().padStart(2, '0')
      days.push(mkDay(`2026-03-${day}`, 36.3))
    }
    const cycle: CycleWindow = {
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-28',
      days,
      hormonalBirthControl: true,
    }
    const result = evaluateCycleAnovulatory(cycle)
    expect(result.status).toBe('insufficient_data')
    expect(result.signals.hormonalBirthControl).toBe(true)
    expect(result.reason.toLowerCase()).toContain('hormonal birth control')
  })
})

describe('buildCyclesFromNc', () => {
  it('splits rows into cycles by menstruation markers', () => {
    const rows: NcImported[] = [
      mkNcRow('2026-01-01', { menstruation: 'menstruation' }),
      mkNcRow('2026-01-02', { menstruation: 'menstruation' }),
      mkNcRow('2026-01-20', { menstruation: null }),
      mkNcRow('2026-01-29', { menstruation: 'menstruation' }),
      mkNcRow('2026-01-30', { menstruation: 'menstruation' }),
      mkNcRow('2026-02-25', { menstruation: 'menstruation' }),
    ]
    const cycles = buildCyclesFromNc(rows)
    // 3 period starts: Jan 1, Jan 29, Feb 25
    expect(cycles.length).toBe(3)
    expect(cycles[0].cycleStart).toBe('2026-01-01')
    expect(cycles[1].cycleStart).toBe('2026-01-29')
    expect(cycles[2].cycleStart).toBe('2026-02-25')
    // Last cycle is open-ended
    expect(cycles[2].cycleEnd).toBeNull()
    // First cycle ends the day before the second starts
    expect(cycles[0].cycleEnd).toBe('2026-01-28')
  })

  it('returns empty array when there is no menstruation data', () => {
    const rows: NcImported[] = [mkNcRow('2026-01-01', { temperature: 36.3 })]
    expect(buildCyclesFromNc(rows)).toEqual([])
  })
})

describe('evaluateNcCycles', () => {
  it('skips open cycles (no next period start)', () => {
    const rows: NcImported[] = [mkNcRow('2026-01-01', { menstruation: 'menstruation' })]
    const results = evaluateNcCycles(rows)
    expect(results).toEqual([])
  })

  it('evaluates each complete cycle', () => {
    const rows: NcImported[] = []
    // Cycle 1: 28 days with low temps everywhere and no LH surge (anovulatory shape
    // but may be insufficient data unless we populate temps on most days)
    rows.push(mkNcRow('2026-01-01', { menstruation: 'menstruation', temperature: 36.3 }))
    for (let d = 2; d <= 28; d++) {
      const date = `2026-01-${d.toString().padStart(2, '0')}`
      rows.push(mkNcRow(date, { temperature: 36.3 }))
    }
    // Cycle 2 start to close cycle 1
    rows.push(mkNcRow('2026-01-29', { menstruation: 'menstruation' }))
    rows.push(mkNcRow('2026-02-25', { menstruation: 'menstruation' }))

    const results = evaluateNcCycles(rows)
    // First complete cycle should be evaluated, second is open so skipped
    expect(results.length).toBe(1)
    expect(results[0].cycleStart).toBe('2026-01-01')
    expect(results[0].status).toBe('likely_anovulatory')
  })
})

describe('toCorrelationRow', () => {
  it('returns null for non-anovulatory evaluations', () => {
    const row = toCorrelationRow({
      cycleStart: '2026-03-01',
      cycleEnd: '2026-03-28',
      status: 'likely_ovulatory',
      confidence: 0.9,
      reason: 'ok',
      signals: {
        tempDaysAvailable: 20,
        tempDaysRequired: MIN_TEMP_DAYS,
        biphasicShiftDetected: true,
        lhSurgeDetected: true,
        hormonalBirthControl: false,
      },
    })
    expect(row).toBeNull()
  })

  it('produces a row with factor_a/factor_b shape suitable for idempotent upsert', () => {
    const fixedNow = new Date('2026-04-16T12:00:00Z')
    const row = toCorrelationRow(
      {
        cycleStart: '2026-03-01',
        cycleEnd: '2026-03-28',
        status: 'likely_anovulatory',
        confidence: 0.75,
        reason: 'We did not see a sustained temperature shift or a positive LH test this cycle.',
        signals: {
          tempDaysAvailable: 20,
          tempDaysRequired: MIN_TEMP_DAYS,
          biphasicShiftDetected: false,
          lhSurgeDetected: false,
          hormonalBirthControl: false,
        },
      },
      fixedNow
    )
    expect(row).not.toBeNull()
    expect(row!.factor_a).toBe('anovulatory_cycle')
    expect(row!.factor_b).toBe('2026-03-01')
    expect(row!.correlation_type).toBe('event_triggered')
    expect(row!.confidence_level).toBe('strong')
    expect(row!.sample_size).toBe(20)
    expect(row!.computed_at).toBe(fixedNow.toISOString())
  })
})
