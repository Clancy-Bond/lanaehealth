/**
 * Regression tests for the shared cycle-day helper (W2.1).
 *
 * The helper is the ONE source of truth for current cycle day. Three
 * previously divergent call sites (home page, log prefill, intelligence
 * route) now delegate here, so these tests guard the contract that made
 * them agree.
 *
 * Fixture contract from docs/qa/session-2-matrix.md W2.1:
 *   - A: nc MENSTRUATION only -> day computed against that date
 *   - B: no menstruation anywhere -> day = null, phase = null
 *   - C: both sources present -> union + dedupe so back-walk does not
 *     spuriously extend the period
 */

import { describe, it, expect, vi } from 'vitest'

// Supabase is touched at module import time even though the pure
// computeCycleDayFromRows helper we test never calls it. Mock the module so
// the import does not require real env vars.
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({}),
  supabase: {},
}))

import { computeCycleDayFromRows } from '@/lib/cycle/current-day'

describe('computeCycleDayFromRows (shared helper, W2.1)', () => {
  it('fixture A: cycles=[], nc=[2026-02-26 MENSTRUATION] -> day 50 on 2026-04-16', () => {
    const result = computeCycleDayFromRows(
      '2026-04-16',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )

    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBe(50)
    expect(result.phase).toBe('luteal')
  })

  it('fixture B: cycles=[], nc=[] -> day = null, phase = null', () => {
    const result = computeCycleDayFromRows('2026-04-16', [], [])

    expect(result.day).toBeNull()
    expect(result.phase).toBeNull()
    expect(result.lastPeriodStart).toBeNull()
  })

  it('fixture C: both sources present -- verify union + dedupe', () => {
    // Same date reported by cycle_entries (boolean true) AND nc_imported
    // (MENSTRUATION string). The union must collapse to a single entry so
    // the back-walk does not read it as a two-day period.
    const result = computeCycleDayFromRows(
      '2026-04-16',
      [{ date: '2026-02-26', menstruation: true }],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )

    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBe(50)
  })

  it('fixture D: consecutive menstrual days back-walk to first day', () => {
    // 4-day period Feb 26-Mar 1. Helper must land on Feb 26, not Mar 1.
    const result = computeCycleDayFromRows(
      '2026-04-16',
      [],
      [
        { date: '2026-02-26', menstruation: 'MENSTRUATION' },
        { date: '2026-02-27', menstruation: 'MENSTRUATION' },
        { date: '2026-02-28', menstruation: 'MENSTRUATION' },
        { date: '2026-03-01', menstruation: 'MENSTRUATION' },
      ],
    )

    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBe(50)
  })

  it('fixture E: SPOTTING is excluded, only MENSTRUATION counts', () => {
    const result = computeCycleDayFromRows(
      '2026-04-16',
      [],
      [
        { date: '2026-04-10', menstruation: 'SPOTTING' },
        { date: '2026-02-26', menstruation: 'MENSTRUATION' },
      ],
    )

    // SPOTTING on Apr 10 must not pull lastPeriodStart forward.
    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBe(50)
  })

  it('fixture F: gap > 2 days separates distinct periods, pick most recent start', () => {
    const result = computeCycleDayFromRows(
      '2026-04-16',
      [],
      [
        // Older period (Jan 30 - Feb 4)
        { date: '2026-01-30', menstruation: 'MENSTRUATION' },
        { date: '2026-01-31', menstruation: 'MENSTRUATION' },
        { date: '2026-02-01', menstruation: 'MENSTRUATION' },
        { date: '2026-02-02', menstruation: 'MENSTRUATION' },
        { date: '2026-02-03', menstruation: 'MENSTRUATION' },
        { date: '2026-02-04', menstruation: 'MENSTRUATION' },
        // Most recent period (Feb 26 - Mar 1)
        { date: '2026-02-26', menstruation: 'MENSTRUATION' },
        { date: '2026-02-27', menstruation: 'MENSTRUATION' },
        { date: '2026-02-28', menstruation: 'MENSTRUATION' },
        { date: '2026-03-01', menstruation: 'MENSTRUATION' },
      ],
    )

    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBe(50)
  })

  it('phase banding: day 3 -> menstrual, day 10 -> follicular, day 15 -> ovulatory', () => {
    const menstrual = computeCycleDayFromRows(
      '2026-02-28',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )
    expect(menstrual.day).toBe(3)
    expect(menstrual.phase).toBe('menstrual')

    const follicular = computeCycleDayFromRows(
      '2026-03-07',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )
    expect(follicular.day).toBe(10)
    expect(follicular.phase).toBe('follicular')

    const ovulatory = computeCycleDayFromRows(
      '2026-03-12',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )
    expect(ovulatory.day).toBe(15)
    expect(ovulatory.phase).toBe('ovulatory')
  })
})
