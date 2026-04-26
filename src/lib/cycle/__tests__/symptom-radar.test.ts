/**
 * Unit tests for the Symptom Radar (Feature D, NC wave 3).
 */
import { describe, it, expect } from 'vitest'
import {
  detectSymptomCyclePatterns,
  type CycleData,
  type SymptomLog,
} from '@/lib/cycle/symptom-radar'

/** Helper: build a chain of N consecutive 28-day cycles starting at startISO. */
function consecutiveCycles(startISO: string, n: number, lengthDays = 28): CycleData[] {
  const out: CycleData[] = []
  let cursor = Date.parse(startISO + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    out.push({
      startDate: new Date(cursor).toISOString().slice(0, 10),
      lengthDays,
    })
    cursor += lengthDays * 24 * 60 * 60 * 1000
  }
  return out
}

/** Helper: shift a date by N days (negative ok). */
function addDays(iso: string, n: number): string {
  const ms = Date.parse(iso + 'T00:00:00Z') + n * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

describe('detectSymptomCyclePatterns', () => {
  it('returns an empty array when no symptom logs are supplied', () => {
    const cycles = consecutiveCycles('2026-01-01', 3)
    expect(detectSymptomCyclePatterns({ symptomLogs: [], cycles })).toEqual([])
  })

  it('returns an empty array when no cycles are supplied', () => {
    const logs: SymptomLog[] = [{ date: '2026-01-15', symptom: 'headache' }]
    expect(detectSymptomCyclePatterns({ symptomLogs: logs, cycles: [] })).toEqual([])
  })

  it('returns no patterns when the strongest cluster fails the dominance bar', () => {
    // 4 logs scattered across all four phases: ratio 0.25 < 0.7.
    const cycles = consecutiveCycles('2026-01-01', 1, 28)
    const logs: SymptomLog[] = [
      { date: '2026-01-03', symptom: 'fatigue' }, // CD3 menstrual
      { date: '2026-01-08', symptom: 'fatigue' }, // CD8 follicular
      { date: '2026-01-15', symptom: 'fatigue' }, // CD15 ovulatory
      { date: '2026-01-22', symptom: 'fatigue' }, // CD22 luteal
    ]
    expect(detectSymptomCyclePatterns({ symptomLogs: logs, cycles })).toEqual([])
  })

  it('returns no patterns when fewer than 3 instances total', () => {
    const cycles = consecutiveCycles('2026-01-01', 3, 28)
    // Two luteal logs across 3 cycles, perfect dominance but below
    // the minimum-instances floor.
    const logs: SymptomLog[] = [
      { date: '2026-01-22', symptom: 'cramps' }, // CD22 luteal
      { date: '2026-02-19', symptom: 'cramps' }, // CD22 luteal of cycle 2
    ]
    expect(detectSymptomCyclePatterns({ symptomLogs: logs, cycles })).toEqual([])
  })

  it('detects a clear luteal-phase pattern when 3 of 3 logs cluster', () => {
    // Three cycles, headaches on CD18 of each (mid-luteal under 28-day model).
    const cycles = consecutiveCycles('2026-01-01', 3, 28)
    const logs: SymptomLog[] = [
      { date: '2026-01-18', symptom: 'headache' }, // CD18 luteal
      { date: '2026-02-15', symptom: 'headache' }, // CD18 luteal of cycle 2
      { date: '2026-03-15', symptom: 'headache' }, // CD18 luteal of cycle 3
    ]
    const patterns = detectSymptomCyclePatterns({ symptomLogs: logs, cycles })
    expect(patterns).toHaveLength(1)
    expect(patterns[0].symptom).toBe('headache')
    expect(patterns[0].observed_in_phase).toBe('luteal')
    expect(patterns[0].confidence).toBe(1)
    expect(patterns[0].instances).toBe(3)
    expect(patterns[0].suggestion).toContain('luteal')
  })

  it('rejects a weak pattern that has 2 of 4 in one phase (50%)', () => {
    const cycles = consecutiveCycles('2026-01-01', 2, 28)
    const logs: SymptomLog[] = [
      { date: '2026-01-22', symptom: 'bloating' }, // CD22 luteal
      { date: '2026-01-23', symptom: 'bloating' }, // CD23 luteal
      { date: '2026-01-08', symptom: 'bloating' }, // CD8 follicular
      { date: '2026-01-15', symptom: 'bloating' }, // CD15 ovulatory
    ]
    expect(detectSymptomCyclePatterns({ symptomLogs: logs, cycles })).toEqual([])
  })

  it('detects multiple distinct patterns and sorts by confidence desc', () => {
    const cycles = consecutiveCycles('2026-01-01', 3, 28)
    const logs: SymptomLog[] = [
      // Headaches: 3/3 luteal -> confidence 1.0
      { date: '2026-01-18', symptom: 'headache' },
      { date: '2026-02-15', symptom: 'headache' },
      { date: '2026-03-15', symptom: 'headache' },
      // Cramps: 4/5 menstrual -> confidence 0.8
      { date: '2026-01-01', symptom: 'cramps' },
      { date: '2026-01-02', symptom: 'cramps' },
      { date: '2026-01-29', symptom: 'cramps' },
      { date: '2026-02-26', symptom: 'cramps' },
      { date: '2026-01-15', symptom: 'cramps' }, // ovulatory outlier
    ]
    const patterns = detectSymptomCyclePatterns({ symptomLogs: logs, cycles })
    expect(patterns).toHaveLength(2)
    expect(patterns[0].symptom).toBe('headache')
    expect(patterns[0].confidence).toBe(1)
    expect(patterns[1].symptom).toBe('cramps')
    expect(patterns[1].observed_in_phase).toBe('menstrual')
    expect(patterns[1].confidence).toBeCloseTo(0.8, 2)
  })

  it('case-insensitively merges variants of the same symptom name', () => {
    const cycles = consecutiveCycles('2026-01-01', 3, 28)
    const logs: SymptomLog[] = [
      { date: '2026-01-18', symptom: 'Headache' },
      { date: '2026-02-15', symptom: 'HEADACHE' },
      { date: '2026-03-15', symptom: '  headache  ' },
    ]
    const patterns = detectSymptomCyclePatterns({ symptomLogs: logs, cycles })
    expect(patterns).toHaveLength(1)
    expect(patterns[0].instances).toBe(3)
    expect(patterns[0].symptom).toBe('headache')
  })

  it('drops logs that fall outside any cycle window', () => {
    const cycles = consecutiveCycles('2026-02-01', 1, 28)
    const logs: SymptomLog[] = [
      // Predates the cycle window (no extrapolation backward).
      { date: '2026-01-10', symptom: 'fatigue' },
      { date: '2026-01-12', symptom: 'fatigue' },
      // Far past the last cycle's lengthDays window.
      { date: '2026-04-01', symptom: 'fatigue' },
    ]
    expect(detectSymptomCyclePatterns({ symptomLogs: logs, cycles })).toEqual([])
  })

  it('honors a custom dominanceThreshold + minInstances override', () => {
    const cycles = consecutiveCycles('2026-01-01', 1, 28)
    // 3 luteal + 2 follicular = 60% dominance. Default 0.7 rejects;
    // a 0.5 threshold accepts.
    const logs: SymptomLog[] = [
      { date: '2026-01-18', symptom: 'mood swings' },
      { date: '2026-01-20', symptom: 'mood swings' },
      { date: '2026-01-22', symptom: 'mood swings' },
      { date: '2026-01-08', symptom: 'mood swings' },
      { date: '2026-01-10', symptom: 'mood swings' },
    ]
    const strict = detectSymptomCyclePatterns({ symptomLogs: logs, cycles })
    expect(strict).toEqual([])
    const lenient = detectSymptomCyclePatterns({
      symptomLogs: logs,
      cycles,
      dominanceThreshold: 0.5,
      minInstances: 5,
    })
    expect(lenient).toHaveLength(1)
    expect(lenient[0].observed_in_phase).toBe('luteal')
    expect(lenient[0].confidence).toBeCloseTo(0.6, 2)
  })

  it('respects per-cycle phase scaling for non-28-day cyclers', () => {
    // 32-day cyclers have a longer follicular phase. CD17 of a 32-day
    // cycle is ovulatory under phaseFromDay's scaled boundaries; under
    // a textbook 28-day model it would be luteal. We supply 32-day
    // cycles so CD17 logs should land in the ovulatory bucket.
    const cycles = consecutiveCycles('2026-01-01', 3, 32)
    const logs: SymptomLog[] = [
      { date: addDays('2026-01-01', 16), symptom: 'ovulation pain' }, // CD17 cycle 1
      { date: addDays('2026-02-02', 16), symptom: 'ovulation pain' }, // CD17 cycle 2
      { date: addDays('2026-03-06', 16), symptom: 'ovulation pain' }, // CD17 cycle 3
    ]
    const patterns = detectSymptomCyclePatterns({ symptomLogs: logs, cycles })
    expect(patterns).toHaveLength(1)
    expect(patterns[0].observed_in_phase).toBe('ovulatory')
  })
})
