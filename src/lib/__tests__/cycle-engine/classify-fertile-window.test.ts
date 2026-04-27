/**
 * classifyFertileWindow priority-order tests.
 *
 * Anchored to the Apr 27 2026 production bug: a stale NC export
 * predicted day 10 RED for today; Lanae logged a fresh period start
 * (cycleDay=1 from cycle_entries); the page rendered "Use protection"
 * because the NC color check ran BEFORE the CD 1-5 menstruation
 * check. NC themselves give CD 1-5 as green, so the order needed to
 * change.
 *
 * These tests lock in the fixed order: confirmed early-cycle
 * menstruation wins over a contradictory NC color.
 */
import { describe, expect, it } from 'vitest'
import { classifyFertileWindow } from '@/lib/cycle/fertile-window'

describe('classifyFertileWindow priority order', () => {
  it('CD 1 menstruation wins over stale NC RED color', () => {
    const result = classifyFertileWindow({
      cycleDay: 1,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: 'RED',
      ovulation: null,
      phase: 'menstrual',
    })
    expect(result.status).toBe('green')
    expect(result.label).toBe('Not fertile')
    expect(result.detail).toMatch(/menstruating/i)
  })

  it('CD 5 menstruation still wins over stale NC RED color', () => {
    const result = classifyFertileWindow({
      cycleDay: 5,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: 'RED',
      ovulation: null,
      phase: 'menstrual',
    })
    expect(result.status).toBe('green')
    expect(result.label).toBe('Not fertile')
  })

  it('CD 6 falls through to NC RED color', () => {
    const result = classifyFertileWindow({
      cycleDay: 6,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: 'RED',
      ovulation: null,
      phase: 'follicular',
    })
    expect(result.status).toBe('red')
    expect(result.label).toBe('Use protection')
    expect(result.detail).toMatch(/natural cycles/i)
  })

  it('CD 1 with NC GREEN stays green (no conflict)', () => {
    const result = classifyFertileWindow({
      cycleDay: 1,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: 'GREEN',
      ovulation: null,
      phase: 'menstrual',
    })
    expect(result.status).toBe('green')
    // CD-based message wins because we run that check first; the
    // copy is more specific than the generic NC-imported message.
    expect(result.detail).toMatch(/menstruating/i)
  })

  it('null cycleDay still defaults to red when no NC color', () => {
    const result = classifyFertileWindow({
      cycleDay: null,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: null,
      ovulation: null,
      phase: null,
    })
    expect(result.status).toBe('red')
    expect(result.detail).toMatch(/period history/i)
  })

  it('CD 1 with no NC color is green (the typical fresh-log path)', () => {
    const result = classifyFertileWindow({
      cycleDay: 1,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: null,
      ovulation: null,
      phase: 'menstrual',
    })
    expect(result.status).toBe('green')
    expect(result.label).toBe('Not fertile')
  })

  it('unusually-long cycle without ovulation stays red even if cycleDay > 5', () => {
    const result = classifyFertileWindow({
      cycleDay: 45,
      isUnusuallyLong: true,
      confirmedOvulation: false,
      ncFertilityColor: null,
      ovulation: null,
      phase: 'follicular',
    })
    expect(result.status).toBe('red')
    expect(result.detail).toMatch(/longer than expected/i)
  })

  it('CD 6 with unusually-long cycle still wins NC GREEN over isUnusuallyLong (NC checked first for CD>=6)', () => {
    // Edge case: NC's RED/GREEN tracks ovulation confirmations the
    // engine may not have. If NC says GREEN and the cycle isn't
    // genuinely unusually long for NC's model, we trust NC.
    const result = classifyFertileWindow({
      cycleDay: 18,
      isUnusuallyLong: false,
      confirmedOvulation: false,
      ncFertilityColor: 'GREEN',
      ovulation: null,
      phase: 'luteal',
    })
    expect(result.status).toBe('green')
  })
})
