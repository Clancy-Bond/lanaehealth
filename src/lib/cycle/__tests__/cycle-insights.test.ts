import { describe, it, expect } from 'vitest'
import {
  computeCycleInsights,
  computeCycleInsightsFromStats,
  POPULATION_REFERENCES,
  type CycleInsight,
} from '@/lib/cycle/cycle-insights'
import type { Cycle, CycleStats } from '@/lib/cycle/cycle-stats'

function cycle(start: string, lengthDays: number | null, periodDays: number): Cycle {
  return {
    startDate: start,
    periodEndDate: start,
    lengthDays,
    periodDays,
  }
}

function find(insights: CycleInsight[], metric: CycleInsight['metric']): CycleInsight {
  const m = insights.find((i) => i.metric === metric)
  if (!m) throw new Error(`metric ${metric} not in insights`)
  return m
}

describe('computeCycleInsights', () => {
  it('returns one insight per known metric, even without data', () => {
    const insights = computeCycleInsights({ cycles: [] })
    expect(insights.map((i) => i.metric).sort()).toEqual(
      [
        'cycle_length',
        'follicular_length',
        'fertile_window_length',
        'luteal_length',
        'period_duration',
      ].sort(),
    )
  })

  it('cycle_length matches population mean when user is similar', () => {
    const cycles = [
      cycle('2026-01-01', 28, 5),
      cycle('2026-01-29', 29, 5),
      cycle('2026-02-27', 28, 5),
      cycle('2026-03-27', 30, 5),
    ]
    const insights = computeCycleInsights({ cycles })
    const cl = find(insights, 'cycle_length')
    expect(cl.userValue?.mean).toBeGreaterThan(28)
    expect(cl.userValue?.mean).toBeLessThan(30)
    expect(cl.comparison).toBe('similar')
    expect(cl.populationValue.mean).toBe(POPULATION_REFERENCES.cycle_length.mean)
  })

  it('flags cycle_length as longer when much above population mean', () => {
    const cycles = [
      cycle('2026-01-01', 40, 5),
      cycle('2026-02-15', 41, 5),
      cycle('2026-04-01', 40, 5),
      cycle('2026-05-15', 39, 5),
    ]
    const insights = computeCycleInsights({ cycles })
    expect(find(insights, 'cycle_length').comparison).toBe('longer')
  })

  it('flags cycle_length as shorter when well below population mean', () => {
    const cycles = [
      cycle('2026-01-01', 22, 4),
      cycle('2026-01-23', 22, 4),
      cycle('2026-02-14', 21, 4),
      cycle('2026-03-07', 22, 4),
    ]
    const insights = computeCycleInsights({ cycles })
    expect(find(insights, 'cycle_length').comparison).toBe('shorter')
  })

  it('confidence is low for fewer than 3 cycles', () => {
    const cycles = [cycle('2026-01-01', 28, 5)]
    const insights = computeCycleInsights({ cycles })
    expect(find(insights, 'cycle_length').confidence).toBe('low')
    expect(find(insights, 'cycle_length').comparisonText).toContain('Based on 1 cycle')
  })

  it('confidence is high with 6+ stable cycles', () => {
    const cycles = Array.from({ length: 6 }, (_, i) => cycle(`2026-0${(i % 9) + 1}-01`, 28, 5))
    const insights = computeCycleInsights({ cycles })
    expect(find(insights, 'cycle_length').confidence).toBe('high')
  })

  it('luteal_length unknown when not provided', () => {
    const insights = computeCycleInsights({ cycles: [cycle('2026-01-01', 28, 5)] })
    const luteal = find(insights, 'luteal_length')
    expect(luteal.comparison).toBe('unknown')
    expect(luteal.userValue).toBeNull()
    expect(luteal.comparisonText).toMatch(/confirmed ovulation/)
  })

  it('luteal_length flags longer than population', () => {
    const insights = computeCycleInsights({
      cycles: [],
      lutealLengths: [15, 16, 15, 14, 16, 15],
    })
    const luteal = find(insights, 'luteal_length')
    expect(luteal.userValue?.mean).toBeGreaterThan(13)
    expect(luteal.comparison).toBe('longer')
    expect(luteal.comparisonText).toMatch(/longer side/)
  })

  it('period_duration uses Bull et al. reference', () => {
    const insights = computeCycleInsights({ cycles: [cycle('2026-01-01', 28, 5)] })
    const pd = find(insights, 'period_duration')
    expect(pd.populationValue.source).toMatch(/Bull/)
    expect(pd.populationValue.mean).toBe(4.5)
  })

  it('fertile_window is always similar with 6-day mean', () => {
    const insights = computeCycleInsights({ cycles: [] })
    const fw = find(insights, 'fertile_window_length')
    expect(fw.populationValue.mean).toBe(6)
    expect(fw.comparison).toBe('similar')
    expect(fw.comparisonText).toMatch(/5 days before/)
  })

  it('computeCycleInsightsFromStats wraps over CycleStats', () => {
    const stats: CycleStats = {
      completedCycles: [
        cycle('2026-01-01', 28, 5),
        cycle('2026-01-29', 29, 5),
        cycle('2026-02-27', 28, 5),
      ],
      currentCycle: null,
      meanCycleLength: 28.3,
      sdCycleLength: 0.6,
      shortestCycle: 28,
      longestCycle: 29,
      meanPeriodLength: 5,
      sdPeriodLength: 0,
      regularity: 'regular',
      sampleSize: 3,
    }
    const insights = computeCycleInsightsFromStats(stats)
    expect(find(insights, 'cycle_length').userValue?.sampleSize).toBe(3)
  })

  it('always cites Bull or Lenton or Wilcox in source', () => {
    const insights = computeCycleInsights({ cycles: [] })
    for (const i of insights) {
      expect(i.populationValue.source).toMatch(/(Bull|Lenton|Wilcox)/)
    }
  })

  it('comparisonText contains a sampleNote for low-confidence rows', () => {
    const insights = computeCycleInsights({ cycles: [cycle('2026-01-01', 32, 5)] })
    const cl = find(insights, 'cycle_length')
    expect(cl.comparisonText).toMatch(/Based on 1 cycle/)
  })
})
