/**
 * Tests for menstrual-migraine correlation classifier.
 *
 * Covers:
 *   - IHS A1.1.1 window classification (days -2 through +3)
 *   - Boundary conditions at -3, -2, 0, +3, +4
 *   - Fallback to denormalized cycle_phase when cycles are absent
 *   - Insufficient-data gate (< MIN_ATTACKS_FOR_STATS classifiable)
 *   - Odds ratio math against the 6/28 null
 *   - Binomial p-value is more extreme when the sample is tightly clustered
 *   - Pattern flag only raises at or above the 60 percent threshold
 */

import { describe, it, expect } from 'vitest'
import {
  classifyAttack,
  computeMenstrualMigraineStats,
  buildPhaseHeatmap,
  computeOddsRatio,
  oneSidedBinomial,
  dayOffset,
  findNearestPeriodStart,
  MENSTRUAL_PATTERN_THRESHOLD,
  MIN_ATTACKS_FOR_STATS,
  NULL_WINDOW_PROBABILITY,
  PERIMENSTRUAL_WINDOW_START,
  PERIMENSTRUAL_WINDOW_END,
  type ClassifyOptions,
} from '../intelligence/menstrual-migraine'
import type { HeadacheAttack } from '../api/headache'
import type { CycleWindow } from '../intelligence/anovulatory-detection'

function mkAttack(
  id: string,
  startedAt: string,
  cyclePhase: string | null = null
): Pick<HeadacheAttack, 'id' | 'started_at' | 'cycle_phase'> {
  return { id, started_at: `${startedAt}T08:00:00Z`, cycle_phase: cyclePhase }
}

function mkCycle(
  start: string,
  end: string | null = null
): CycleWindow {
  return { cycleStart: start, cycleEnd: end, days: [] }
}

// ── Pure helpers ────────────────────────────────────────────────────────

describe('dayOffset', () => {
  it('returns 0 when dates match', () => {
    expect(dayOffset('2026-03-10', '2026-03-10')).toBe(0)
  })

  it('returns positive when attack is after period start', () => {
    expect(dayOffset('2026-03-13', '2026-03-10')).toBe(3)
  })

  it('returns negative when attack is before period start', () => {
    expect(dayOffset('2026-03-08', '2026-03-10')).toBe(-2)
  })

  it('handles month boundaries correctly', () => {
    expect(dayOffset('2026-04-02', '2026-03-31')).toBe(2)
    expect(dayOffset('2026-03-30', '2026-04-02')).toBe(-3)
  })
})

describe('findNearestPeriodStart', () => {
  const cycles = [
    mkCycle('2026-01-05'),
    mkCycle('2026-02-01'),
    mkCycle('2026-03-01'),
    mkCycle('2026-03-30'),
  ]

  it('picks the closest period start within 14 days', () => {
    expect(findNearestPeriodStart('2026-02-28', cycles)).toBe('2026-03-01')
    expect(findNearestPeriodStart('2026-03-05', cycles)).toBe('2026-03-01')
  })

  it('returns null when no period start is within 14 days', () => {
    // Mid-way between cycles with no cycle within 14 days on either side
    const sparse = [mkCycle('2025-01-01'), mkCycle('2026-06-01')]
    expect(findNearestPeriodStart('2025-09-01', sparse)).toBe(null)
    // Single cycle with attack far out of range
    expect(findNearestPeriodStart('2024-07-01', [mkCycle('2026-03-01')])).toBe(null)
  })

  it('returns the 14-day-away cycle when attack is on the boundary', () => {
    // 14 days from 2026-03-01 is 2026-02-15
    expect(findNearestPeriodStart('2026-02-15', [mkCycle('2026-03-01')])).toBe('2026-03-01')
    // 15 days is out of range
    expect(findNearestPeriodStart('2026-02-14', [mkCycle('2026-03-01')])).toBe(null)
  })

  it('ties break toward the earlier period start', () => {
    const twoCycles = [mkCycle('2026-03-01'), mkCycle('2026-03-15')]
    // 2026-03-08 is 7 days from each
    expect(findNearestPeriodStart('2026-03-08', twoCycles)).toBe('2026-03-01')
  })
})

// ── classifyAttack ──────────────────────────────────────────────────────

describe('classifyAttack with cycle history', () => {
  const cycles: CycleWindow[] = [
    mkCycle('2026-01-05', '2026-02-02'),
    mkCycle('2026-02-03', '2026-03-02'),
    mkCycle('2026-03-03', '2026-03-30'),
    mkCycle('2026-03-31', '2026-04-28'),
  ]
  const options: ClassifyOptions = { cycles }

  it('classifies day -2 as menstrual (window lower bound)', () => {
    const res = classifyAttack(mkAttack('a1', '2026-03-01'), options)
    expect(res.classification).toBe('menstrual')
    expect(res.cycleDayRelative).toBe(PERIMENSTRUAL_WINDOW_START)
  })

  it('classifies day +3 as menstrual (window upper bound)', () => {
    const res = classifyAttack(mkAttack('a2', '2026-03-06'), options)
    expect(res.classification).toBe('menstrual')
    expect(res.cycleDayRelative).toBe(PERIMENSTRUAL_WINDOW_END)
  })

  it('classifies day 0 (period start) as menstrual', () => {
    const res = classifyAttack(mkAttack('a3', '2026-03-03'), options)
    expect(res.classification).toBe('menstrual')
    expect(res.cycleDayRelative).toBe(0)
  })

  it('classifies day -3 as non-menstrual (outside window)', () => {
    const res = classifyAttack(mkAttack('a4', '2026-02-28'), options)
    expect(res.classification).toBe('non-menstrual')
    expect(res.cycleDayRelative).toBe(-3)
  })

  it('classifies day +4 as non-menstrual (outside window)', () => {
    const res = classifyAttack(mkAttack('a5', '2026-03-07'), options)
    expect(res.classification).toBe('non-menstrual')
    expect(res.cycleDayRelative).toBe(4)
  })

  it('classifies mid-luteal attack as non-menstrual', () => {
    const res = classifyAttack(mkAttack('a6', '2026-03-20'), options)
    expect(res.classification).toBe('non-menstrual')
  })
})

describe('classifyAttack fallback to cycle_phase', () => {
  it('uses menstrual phase as menstrual classification when no cycles given', () => {
    const res = classifyAttack(mkAttack('b1', '2026-03-05', 'menstrual'), {})
    expect(res.classification).toBe('menstrual')
    expect(res.nearestPeriodStart).toBe(null)
  })

  it('classifies non-menstrual phases as non-menstrual without cycles', () => {
    expect(classifyAttack(mkAttack('b2', '2026-03-10', 'follicular')).classification).toBe(
      'non-menstrual'
    )
    expect(classifyAttack(mkAttack('b3', '2026-03-15', 'ovulatory')).classification).toBe(
      'non-menstrual'
    )
    expect(classifyAttack(mkAttack('b4', '2026-03-20', 'luteal')).classification).toBe(
      'non-menstrual'
    )
  })

  it('returns unknown when there is no context at all', () => {
    const res = classifyAttack(mkAttack('b5', '2026-03-10', null), {})
    expect(res.classification).toBe('unknown')
    expect(res.reason).toMatch(/No cycle phase/)
  })

  it('prefers cycle history over the denormalized phase when both exist', () => {
    // Attack is labeled luteal but actually falls 2 days before a known
    // period start. Cycle history wins.
    const cycles = [mkCycle('2026-03-03', '2026-03-30')]
    const res = classifyAttack(mkAttack('b6', '2026-03-01', 'luteal'), { cycles })
    expect(res.classification).toBe('menstrual')
  })
})

// ── computeMenstrualMigraineStats ──────────────────────────────────────

describe('computeMenstrualMigraineStats', () => {
  const cycles: CycleWindow[] = [
    mkCycle('2026-01-05', '2026-02-02'),
    mkCycle('2026-02-03', '2026-03-02'),
    mkCycle('2026-03-03', '2026-03-30'),
    mkCycle('2026-03-31', '2026-04-28'),
  ]

  it('gates stats when there are fewer than MIN_ATTACKS_FOR_STATS classifiable attacks', () => {
    const attacks = [mkAttack('x1', '2026-03-01'), mkAttack('x2', '2026-03-05')]
    const stats = computeMenstrualMigraineStats(attacks, { cycles })
    expect(stats.sufficientData).toBe(false)
    expect(stats.patternFlag).toBe(false)
    expect(stats.p).toBe(null)
    expect(stats.oddsRatio).toBe(null)
  })

  it('flags the pattern when >=60% of classifiable attacks land in the window', () => {
    // 5 menstrual + 2 non-menstrual = 5/7 = 71%
    const attacks = [
      mkAttack('m1', '2026-01-04'), // -1 from 01-05
      mkAttack('m2', '2026-02-04'), //  +1 from 02-03
      mkAttack('m3', '2026-03-04'), //  +1 from 03-03
      mkAttack('m4', '2026-03-30'), //  -1 from 03-31
      mkAttack('m5', '2026-03-06'), //  +3 from 03-03
      mkAttack('n1', '2026-02-15'), // mid-cycle
      mkAttack('n2', '2026-03-15'), // mid-cycle
    ]
    const stats = computeMenstrualMigraineStats(attacks, { cycles })
    expect(stats.sufficientData).toBe(true)
    expect(stats.menstrualAttacks).toBe(5)
    expect(stats.nonMenstrualAttacks).toBe(2)
    expect(stats.pct).toBeCloseTo(5 / 7, 4)
    expect(stats.pct).toBeGreaterThanOrEqual(MENSTRUAL_PATTERN_THRESHOLD)
    expect(stats.patternFlag).toBe(true)
    expect(stats.oddsRatio).not.toBe(null)
    expect(stats.oddsRatio).toBeGreaterThan(1)
    expect(stats.p).not.toBe(null)
    expect(stats.p).toBeLessThan(0.05)
  })

  it('does not flag when the menstrual share is below the threshold', () => {
    // 1 menstrual + 4 non-menstrual = 20% (close to the null rate)
    const attacks = [
      mkAttack('m1', '2026-03-04'),
      mkAttack('n1', '2026-02-12'),
      mkAttack('n2', '2026-02-17'),
      mkAttack('n3', '2026-03-12'),
      mkAttack('n4', '2026-03-20'),
    ]
    const stats = computeMenstrualMigraineStats(attacks, { cycles })
    expect(stats.sufficientData).toBe(true)
    expect(stats.pct).toBeCloseTo(0.2, 2)
    expect(stats.patternFlag).toBe(false)
  })

  it('propagates unknown attacks into the totals but excludes them from pct', () => {
    const attacks = [
      mkAttack('m1', '2026-03-04'), // menstrual
      mkAttack('m2', '2026-02-04'), // menstrual
      mkAttack('m3', '2026-01-04'), // menstrual
      mkAttack('u1', '2022-01-01', null), // no cycle context, unknown
      mkAttack('n1', '2026-03-20'), // non-menstrual
    ]
    const stats = computeMenstrualMigraineStats(attacks, { cycles })
    expect(stats.totalAttacks).toBe(5)
    expect(stats.unknownAttacks).toBe(1)
    expect(stats.menstrualAttacks).toBe(3)
    expect(stats.nonMenstrualAttacks).toBe(1)
    expect(stats.pct).toBeCloseTo(3 / 4, 4)
  })

  it('still produces meaningful stats using the cycle_phase fallback when no cycles are supplied', () => {
    const attacks = [
      mkAttack('p1', '2026-03-04', 'menstrual'),
      mkAttack('p2', '2026-02-03', 'menstrual'),
      mkAttack('p3', '2026-01-06', 'menstrual'),
      mkAttack('p4', '2026-03-15', 'luteal'),
    ]
    const stats = computeMenstrualMigraineStats(attacks)
    expect(stats.sufficientData).toBe(true)
    expect(stats.menstrualAttacks).toBe(3)
    expect(stats.pct).toBeCloseTo(0.75, 2)
    expect(stats.patternFlag).toBe(true)
  })

  it('reports the IHS window description', () => {
    const stats = computeMenstrualMigraineStats([])
    expect(stats.windowDescription).toMatch(/IHS A1\.1\.1/)
    expect(stats.windowDescription).toMatch(/2 days before period/)
    expect(stats.windowDescription).toMatch(/day 3 of flow/)
  })
})

// ── Statistical primitives ─────────────────────────────────────────────

describe('computeOddsRatio', () => {
  it('returns 0 for pct = 0', () => {
    expect(computeOddsRatio(0)).toBe(0)
  })

  it('returns null for pct = 1 (undefined ratio)', () => {
    expect(computeOddsRatio(1)).toBe(null)
  })

  it('returns 1.0 when pct matches the null rate', () => {
    const or = computeOddsRatio(NULL_WINDOW_PROBABILITY)
    expect(or).not.toBe(null)
    expect(or as number).toBeCloseTo(1, 1)
  })

  it('returns > 1.0 for clustering above the null rate', () => {
    const or = computeOddsRatio(0.7)
    expect(or as number).toBeGreaterThan(1)
  })

  it('returns < 1.0 for clustering below the null rate', () => {
    const or = computeOddsRatio(0.1)
    expect(or as number).toBeLessThan(1)
  })
})

describe('oneSidedBinomial', () => {
  it('returns 1 when observed successes is 0', () => {
    expect(oneSidedBinomial(0, 10, 0.214)).toBe(1)
  })

  it('returns 1 when trials is 0', () => {
    expect(oneSidedBinomial(0, 0, 0.214)).toBe(1)
  })

  it('is < 0.05 when observed successes are well above the null rate', () => {
    // 8 out of 10 vs null p = 0.214 is extremely unlikely.
    const p = oneSidedBinomial(8, 10, 0.214)
    expect(p).toBeLessThan(0.001)
  })

  it('approaches 0.5 when observed matches the expected count', () => {
    // Expected 2.14 out of 10. 2 successes is close to the median.
    const p = oneSidedBinomial(2, 10, 0.214)
    expect(p).toBeGreaterThan(0.3)
    expect(p).toBeLessThan(0.9)
  })

  it('returns a probability in [0, 1]', () => {
    for (let k = 0; k <= 10; k++) {
      const p = oneSidedBinomial(k, 10, 0.214)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
  })
})

// ── buildPhaseHeatmap ──────────────────────────────────────────────────

describe('buildPhaseHeatmap', () => {
  it('counts attacks per phase bucket', () => {
    const attacks = [
      { cycle_phase: 'menstrual' },
      { cycle_phase: 'menstrual' },
      { cycle_phase: 'follicular' },
      { cycle_phase: 'ovulatory' },
      { cycle_phase: 'luteal' },
      { cycle_phase: null },
      { cycle_phase: 'wat' }, // unrecognized
    ]
    const heatmap = buildPhaseHeatmap(attacks)
    expect(heatmap.menstrual).toBe(2)
    expect(heatmap.follicular).toBe(1)
    expect(heatmap.ovulatory).toBe(1)
    expect(heatmap.luteal).toBe(1)
    expect(heatmap.unknown).toBe(2)
  })

  it('returns all zeros for empty input', () => {
    const heatmap = buildPhaseHeatmap([])
    expect(heatmap).toEqual({
      menstrual: 0,
      follicular: 0,
      ovulatory: 0,
      luteal: 0,
      unknown: 0,
    })
  })
})
