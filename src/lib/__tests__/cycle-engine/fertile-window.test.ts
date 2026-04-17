/**
 * Tests for fertile-window.ts. References: Scherwitzl 2015
 * (PMID 25592280), Favaro 2019 (PMID 31738859), FDA DEN170052.
 */
import { describe, it, expect } from 'vitest'
import {
  computeFertileWindow,
  computeLutealLength,
  predictPeriodStart,
  FERTILE_WINDOW_PRE_OVULATION_DAYS,
  FERTILE_WINDOW_POST_OVULATION_DAYS,
  SHORT_LUTEAL_THRESHOLD_DAYS,
  DEFAULT_LUTEAL_LENGTH_DAYS,
  MIN_PERIOD_UNCERTAINTY_DAYS,
  type CycleHistoryStats,
} from '../../intelligence/cycle-engine/fertile-window'

describe('computeFertileWindow', () => {
  it('spans ovulation day - 5 through ovulation day + 1 (six total days)', () => {
    const window = computeFertileWindow('2026-03-15')
    expect(window.start).toBe('2026-03-10')
    expect(window.end).toBe('2026-03-16')
  })

  it('uses the published constants (5 before, 1 after)', () => {
    expect(FERTILE_WINDOW_PRE_OVULATION_DAYS).toBe(5)
    expect(FERTILE_WINDOW_POST_OVULATION_DAYS).toBe(1)
  })

  it('handles month boundaries', () => {
    const window = computeFertileWindow('2026-03-03')
    expect(window.start).toBe('2026-02-26')
    expect(window.end).toBe('2026-03-04')
  })
})

describe('predictPeriodStart', () => {
  const richHistory: CycleHistoryStats = {
    meanCycleLength: 29,
    sdCycleLength: 3,
    meanLutealLength: 13,
    sdLutealLength: 1.2,
    confirmedOvulatoryCycles: 10,
  }

  it('uses ovulation + mean luteal when ovulation is known and luteal stats exist', () => {
    const result = predictPeriodStart('2026-03-01', '2026-03-15', richHistory)
    expect(result.basis).toBe('ovulation_plus_luteal')
    expect(result.predictedStart).toBe('2026-03-28')
    // SD 1.2 + shrinkage 0 (10 confirmed cycles) ~ 1 day
    expect(result.uncertaintyDays).toBe(1)
  })

  it('falls back to cycle-mean prediction when ovulation is unknown', () => {
    const result = predictPeriodStart('2026-03-01', null, richHistory)
    expect(result.basis).toBe('cycle_mean')
    expect(result.predictedStart).toBe('2026-03-30')
    expect(result.uncertaintyDays).toBeGreaterThanOrEqual(MIN_PERIOD_UNCERTAINTY_DAYS)
  })

  it('applies Bayesian shrinkage for users with <3 confirmed cycles', () => {
    const earlyHistory: CycleHistoryStats = {
      ...richHistory,
      confirmedOvulatoryCycles: 1,
    }
    const early = predictPeriodStart('2026-03-01', '2026-03-15', earlyHistory)
    const mature = predictPeriodStart('2026-03-01', '2026-03-15', richHistory)
    expect(early.uncertaintyDays).toBeGreaterThan(mature.uncertaintyDays)
  })

  it('never emits 0-day uncertainty', () => {
    const tight: CycleHistoryStats = {
      meanCycleLength: 28,
      sdCycleLength: 0,
      meanLutealLength: 14,
      sdLutealLength: 0,
      confirmedOvulatoryCycles: 100,
    }
    const result = predictPeriodStart('2026-03-01', '2026-03-15', tight)
    expect(result.uncertaintyDays).toBeGreaterThanOrEqual(MIN_PERIOD_UNCERTAINTY_DAYS)
  })

  it('falls back to 28-day calendar with wide uncertainty when no history exists', () => {
    const empty: CycleHistoryStats = {
      meanCycleLength: 0,
      sdCycleLength: 0,
      meanLutealLength: 0,
      sdLutealLength: 0,
      confirmedOvulatoryCycles: 0,
    }
    const result = predictPeriodStart('2026-03-01', null, empty)
    expect(result.basis).toBe('calendar_fallback')
    expect(result.uncertaintyDays).toBe(7)
  })
})

describe('computeLutealLength', () => {
  it('returns days between ovulation and next period start', () => {
    expect(computeLutealLength('2026-03-15', '2026-03-28')).toBe(13)
  })

  it('returns null when either date is missing', () => {
    expect(computeLutealLength(null, '2026-03-28')).toBeNull()
    expect(computeLutealLength('2026-03-15', null)).toBeNull()
  })

  it('flags sub-threshold luteal length as short', () => {
    const length = computeLutealLength('2026-03-20', '2026-03-28')
    expect(length).toBe(8)
    expect(length! < SHORT_LUTEAL_THRESHOLD_DAYS).toBe(true)
  })
})

describe('constants', () => {
  it('publishes the classic clinical default luteal length (14 days)', () => {
    expect(DEFAULT_LUTEAL_LENGTH_DAYS).toBe(14)
  })

  it('sets short-luteal threshold at 10 days per clinical consensus', () => {
    expect(SHORT_LUTEAL_THRESHOLD_DAYS).toBe(10)
  })
})
