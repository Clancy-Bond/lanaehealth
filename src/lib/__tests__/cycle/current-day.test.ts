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

import { describe, it, expect, vi, afterEach } from 'vitest'

// Supabase is touched at module import time even though the pure
// computeCycleDayFromRows helper we test never calls it. Mock the module so
// the import does not require real env vars.
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({}),
  supabase: {},
}))

import {
  computeCycleDayFromRows,
  UNUSUALLY_LONG_CYCLE_DAY_THRESHOLD,
} from '@/lib/cycle/current-day'

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
    expect(result.isUnusuallyLong).toBe(true)
    expect(result.daysSinceLastPeriod).toBe(49)
  })

  it('fixture B: cycles=[], nc=[] -> day = null, phase = null', () => {
    const result = computeCycleDayFromRows('2026-04-16', [], [])

    expect(result.day).toBeNull()
    expect(result.phase).toBeNull()
    expect(result.lastPeriodStart).toBeNull()
    expect(result.isUnusuallyLong).toBe(false)
    expect(result.daysSinceLastPeriod).toBeNull()
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

  it('long-cycle flag: day <= 35 is not unusually long', () => {
    // Day 35 is the ACOG upper bound of "typical" cycles; the threshold
    // fires only when we exceed it. Pin both sides of the boundary.
    const atThreshold = computeCycleDayFromRows(
      '2026-04-01',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )
    expect(atThreshold.day).toBe(35)
    expect(atThreshold.isUnusuallyLong).toBe(false)
  })

  it('long-cycle flag: day > 35 is unusually long', () => {
    const justOver = computeCycleDayFromRows(
      '2026-04-02',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )
    expect(justOver.day).toBe(36)
    expect(justOver.isUnusuallyLong).toBe(true)
    expect(justOver.daysSinceLastPeriod).toBe(35)
  })

  it('long-cycle flag: confirmed-only path still reports CD 52 on 2026-04-18', () => {
    // If the only menstrual signal available is a 2026-02-26 MENSTRUATION
    // entry (no NC flow_quantity rows after it), the helper must still
    // report CD 52 and flag the cycle as unusually long so the UI can
    // surface a heads-up instead of a bare "CD 52" chip. Value is
    // returned truthfully, never silently capped.
    const result = computeCycleDayFromRows(
      '2026-04-18',
      [],
      [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
    )
    expect(result.day).toBe(52)
    expect(result.isUnusuallyLong).toBe(true)
    expect(result.daysSinceLastPeriod).toBe(51)
    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBeGreaterThan(UNUSUALLY_LONG_CYCLE_DAY_THRESHOLD)
  })

  it('nc flow_quantity counts as a menstrual signal (matches 2026-04-18 prod data)', () => {
    // Regression anchor for the Apr 18 "51 days" bug. Lanae's actual
    // confirmed period (cycle #47) ended 2026-03-01 with MENSTRUATION
    // strings. Natural Cycles then populated flow_quantity for the
    // cycle #48 start (Mar 22) and the cycle #49 start (Apr 18) without
    // setting menstruation = 'MENSTRUATION'. The prior helper ignored
    // those rows and reported 51 days since the period. The fix: treat
    // flow_quantity as the same kind of menstrual signal.
    const result = computeCycleDayFromRows(
      '2026-04-18',
      [],
      [
        // cycle #47: confirmed MENSTRUATION run Feb 26 - Mar 1
        { date: '2026-02-26', menstruation: 'MENSTRUATION', flow_quantity: 'HEAVY' },
        { date: '2026-02-27', menstruation: 'MENSTRUATION', flow_quantity: 'HEAVY' },
        { date: '2026-02-28', menstruation: 'MENSTRUATION', flow_quantity: 'MEDIUM' },
        { date: '2026-03-01', menstruation: 'MENSTRUATION', flow_quantity: 'MEDIUM' },
        // cycle #48: flow_quantity only (NC record, no MENSTRUATION string)
        { date: '2026-03-22', menstruation: null, flow_quantity: 'MEDIUM' },
        { date: '2026-03-23', menstruation: null, flow_quantity: 'HEAVY' },
        { date: '2026-03-24', menstruation: null, flow_quantity: 'MEDIUM' },
        { date: '2026-03-25', menstruation: null, flow_quantity: 'MEDIUM' },
        { date: '2026-03-26', menstruation: null, flow_quantity: 'LIGHT' },
        // cycle #49: flow_quantity only, starts today
        { date: '2026-04-18', menstruation: null, flow_quantity: 'MEDIUM' },
      ],
    )
    expect(result.lastPeriodStart).toBe('2026-04-18')
    expect(result.day).toBe(1)
    expect(result.isUnusuallyLong).toBe(false)
    expect(result.phase).toBe('menstrual')
  })

  it('nc flow_quantity ignored when paired with explicit SPOTTING', () => {
    // Defensive: do not let an NC row where the user explicitly marked
    // the day as SPOTTING masquerade as a menstrual day, even if NC's
    // own flow_quantity field is populated.
    const result = computeCycleDayFromRows(
      '2026-04-18',
      [],
      [
        { date: '2026-02-26', menstruation: 'MENSTRUATION', flow_quantity: 'HEAVY' },
        { date: '2026-04-10', menstruation: 'SPOTTING', flow_quantity: 'LIGHT' },
      ],
    )
    expect(result.lastPeriodStart).toBe('2026-02-26')
    expect(result.day).toBe(52)
  })

  describe('UTC date math (Phase 1 audit, Bug 1)', () => {
    // Regression for the local-vs-UTC drift in computeCycleDayFromRows.
    // Previously, the function used `new Date(targetIso).getTime()` to
    // diff target against lastPeriodStart. Some V8 builds parse a bare
    // YYYY-MM-DD as LOCAL midnight, others as UTC midnight, so the cycle
    // day flipped by 1 depending on the server's timezone. The fix pins
    // every parse to T00:00:00Z so the same date input always yields the
    // same cycle day.
    const ORIGINAL_TZ = process.env.TZ

    afterEach(() => {
      if (ORIGINAL_TZ === undefined) delete process.env.TZ
      else process.env.TZ = ORIGINAL_TZ
    })

    it('produces the same cycle day in America/Los_Angeles as in UTC', () => {
      const args = (): [string, [], Array<{ date: string; menstruation: string | null; flow_quantity?: string | null }>] => [
        '2026-04-23',
        [],
        [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
      ]

      process.env.TZ = 'UTC'
      const inUtc = computeCycleDayFromRows(...args())

      process.env.TZ = 'America/Los_Angeles'
      const inLa = computeCycleDayFromRows(...args())

      expect(inUtc.day).toBe(inLa.day)
      expect(inUtc.daysSinceLastPeriod).toBe(inLa.daysSinceLastPeriod)
      expect(inUtc.lastPeriodStart).toBe(inLa.lastPeriodStart)
    })

    it('produces the same cycle day in Pacific/Auckland as in UTC', () => {
      // Auckland is UTC+12/13 (the opposite drift direction from LA).
      // Locking to UTC must protect both sides of the equator.
      const args = (): [string, [], Array<{ date: string; menstruation: string | null; flow_quantity?: string | null }>] => [
        '2026-04-23',
        [],
        [{ date: '2026-02-26', menstruation: 'MENSTRUATION' }],
      ]

      process.env.TZ = 'UTC'
      const inUtc = computeCycleDayFromRows(...args())

      process.env.TZ = 'Pacific/Auckland'
      const inAkl = computeCycleDayFromRows(...args())

      expect(inUtc.day).toBe(inAkl.day)
      expect(inUtc.daysSinceLastPeriod).toBe(inAkl.daysSinceLastPeriod)
    })

    it('back-walk gap calculation is also TZ-stable across consecutive runs', () => {
      // Confirms the loop on lines 164-174 (run-detection) parses both
      // sides of the diff as UTC. A LOCAL-vs-UTC mix would flip the
      // gap-<=2 check at the day boundary in some zones.
      const fixture = (): [string, [], Array<{ date: string; menstruation: string | null; flow_quantity?: string | null }>] => [
        '2026-04-23',
        [],
        [
          { date: '2026-02-26', menstruation: 'MENSTRUATION' },
          { date: '2026-02-27', menstruation: 'MENSTRUATION' },
          { date: '2026-02-28', menstruation: 'MENSTRUATION' },
          { date: '2026-03-01', menstruation: 'MENSTRUATION' },
        ],
      ]

      process.env.TZ = 'UTC'
      const inUtc = computeCycleDayFromRows(...fixture())

      process.env.TZ = 'America/Los_Angeles'
      const inLa = computeCycleDayFromRows(...fixture())

      expect(inLa.lastPeriodStart).toBe(inUtc.lastPeriodStart)
      expect(inLa.lastPeriodStart).toBe('2026-02-26')
      expect(inLa.day).toBe(inUtc.day)
    })
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
