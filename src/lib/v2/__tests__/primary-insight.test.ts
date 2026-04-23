import { describe, expect, it } from 'vitest'
import { getPrimaryInsight } from '@/lib/v2/primary-insight'
import type { OuraDaily } from '@/lib/types'
import type { CycleContext } from '@/lib/cycle/load-cycle-context'
import type { DayTotals } from '@/lib/calories/home-data'

const TODAY = '2026-04-21'

function ouraDay(date: string, overrides: Partial<OuraDaily> = {}): OuraDaily {
  return {
    id: `oura-${date}`,
    date,
    sleep_score: null,
    sleep_duration: null,
    deep_sleep_min: null,
    rem_sleep_min: null,
    hrv_avg: null,
    hrv_max: null,
    resting_hr: null,
    body_temp_deviation: null,
    spo2_avg: null,
    stress_score: null,
    readiness_score: null,
    respiratory_rate: null,
    raw_json: {},
    synced_at: `${date}T08:00:00Z`,
    ...overrides,
  }
}

function makeCycle(overrides: Partial<CycleContext['current']> = {}): CycleContext {
  return {
    today: TODAY,
    current: {
      day: 12,
      phase: 'follicular',
      lastPeriodStart: '2026-04-10',
      isUnusuallyLong: false,
      daysSinceLastPeriod: 11,
      ...overrides,
    },
    // Stats / predictions / bbt are unused by getPrimaryInsight; cast keeps the
    // test focused on the input fields the function actually reads.
    stats: {} as CycleContext['stats'],
    periodPrediction: {} as CycleContext['periodPrediction'],
    fertilePrediction: {} as CycleContext['fertilePrediction'],
    bbtLog: {} as CycleContext['bbtLog'],
    confirmedOvulation: false,
  }
}

function emptyCalories(): DayTotals {
  return { date: TODAY, calories: 0, protein: 0, carbs: 0, fat: 0, entryCount: 0 }
}

describe('getPrimaryInsight', () => {
  describe('priority 1: sleep score when latest reading is today', () => {
    it('returns the optimal-band sentence when sleep score >= 85 and date matches today', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [ouraDay(TODAY, { sleep_score: 88, sleep_duration: 8 * 3600 })],
        cycle: makeCycle(),
        calories: emptyCalories(),
      })
      expect(out.eyebrow).toBe("Today's signal")
      expect(out.sentence).toMatch(/optimal range/)
      expect(out.source).toMatch(/Oura sleep score of 88/)
      expect(out.source).toMatch(/8h 0m/)
    })

    it('uses the fair-band copy when sleep score is in the 60-69 range', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [ouraDay(TODAY, { sleep_score: 64, sleep_duration: 6 * 3600 })],
        cycle: null,
        calories: null,
      })
      expect(out.sentence).toMatch(/fair recovery/)
    })

    it('falls through when latest Oura row is from a previous day', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [ouraDay('2026-04-20', { sleep_score: 90, sleep_duration: 7 * 3600 })],
        cycle: makeCycle({ phase: 'follicular' }),
        calories: emptyCalories(),
      })
      // Sleep branch is gated on isLatestToday; we should fall through to cycle.
      expect(out.eyebrow).toBe('Follicular phase')
    })
  })

  describe('priority 2: cycle-phase fallback when no Oura today', () => {
    it('uses follicular copy when no Oura data and phase is follicular', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [],
        cycle: makeCycle({ phase: 'follicular', day: 8 }),
        calories: null,
      })
      expect(out.eyebrow).toBe('Follicular phase')
      expect(out.sentence).toMatch(/Energy usually rises/)
      expect(out.source).toMatch(/cycle day 8/)
    })

    it('flags an unusually long cycle distinctly from normal phase copy', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [],
        cycle: makeCycle({ isUnusuallyLong: true, day: 60, phase: 'luteal' }),
        calories: null,
      })
      expect(out.eyebrow).toBe('Cycle check-in')
      expect(out.sentence).toMatch(/running longer than usual/)
    })

    it('returns reasonable fallback copy when phase is unrecognized', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [],
        // Force an unrecognized phase value to exercise the fallback branch.
        cycle: makeCycle({ phase: 'unknown' as unknown as CycleContext['current']['phase'], day: 5 }),
        calories: null,
      })
      // Should not render "undefined" anywhere.
      expect(out.sentence).not.toMatch(/undefined/i)
      expect(out.sentence.length).toBeGreaterThan(0)
      expect(out.source).toMatch(/cycle day 5/)
      // Eyebrow is uppercased phase name; should still be a non-empty string.
      expect(out.eyebrow.length).toBeGreaterThan(0)
    })

    it('returns the menstrual copy when phase=menstrual', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [],
        cycle: makeCycle({ phase: 'menstrual', day: 2 }),
        calories: null,
      })
      expect(out.eyebrow).toBe('Menstrual phase')
      expect(out.sentence).toMatch(/Rest is productive/)
    })
  })

  describe('priority 4: empty-day fallback', () => {
    it('returns the quiet-day prompt when calories present but no entries logged', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [],
        cycle: null,
        calories: emptyCalories(),
      })
      expect(out.eyebrow).toBe('Today')
      expect(out.sentence).toMatch(/quiet day of data/)
      expect(out.source).toBe('Based on zero entries logged today.')
    })

    it('returns the limited-data fallback when calories AND ouraTrend AND cycle are all null', () => {
      const out = getPrimaryInsight({
        today: TODAY,
        ouraTrend: [],
        cycle: null,
        calories: null,
      })
      expect(out.eyebrow).toBe('Today')
      expect(out.sentence).toMatch(/Logging a few check-ins/)
      expect(out.source).toMatch(/limited data/)
    })
  })

  describe('shape contract', () => {
    it('always returns the {eyebrow, sentence, source} triple as non-empty strings', () => {
      const inputs: Array<Parameters<typeof getPrimaryInsight>[0]> = [
        { today: TODAY, ouraTrend: [], cycle: null, calories: null },
        {
          today: TODAY,
          ouraTrend: [ouraDay(TODAY, { sleep_score: 75, sleep_duration: 7 * 3600 })],
          cycle: makeCycle(),
          calories: emptyCalories(),
        },
        { today: TODAY, ouraTrend: [], cycle: makeCycle({ phase: 'luteal', day: 22 }), calories: null },
        { today: TODAY, ouraTrend: [], cycle: null, calories: emptyCalories() },
      ]
      for (const input of inputs) {
        const out = getPrimaryInsight(input)
        expect(typeof out.eyebrow).toBe('string')
        expect(typeof out.sentence).toBe('string')
        expect(typeof out.source).toBe('string')
        expect(out.eyebrow.length).toBeGreaterThan(0)
        expect(out.sentence.length).toBeGreaterThan(0)
        expect(out.source.length).toBeGreaterThan(0)
      }
    })
  })
})
