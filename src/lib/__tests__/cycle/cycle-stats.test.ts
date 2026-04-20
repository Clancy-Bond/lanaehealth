import { describe, expect, it } from 'vitest'
import {
  computeCycleStats,
  groupIntoPeriods,
  mergeMenstrualDays,
} from '@/lib/cycle/cycle-stats'

describe('cycle-stats', () => {
  describe('groupIntoPeriods', () => {
    it('joins consecutive menstrual days into one period', () => {
      const runs = groupIntoPeriods(['2026-04-01', '2026-04-02', '2026-04-03'])
      expect(runs).toEqual([{ start: '2026-04-01', end: '2026-04-03' }])
    })

    it('starts a new period when the gap exceeds 2 days', () => {
      const runs = groupIntoPeriods(['2026-04-01', '2026-04-02', '2026-04-06', '2026-04-07'])
      expect(runs).toEqual([
        { start: '2026-04-01', end: '2026-04-02' },
        { start: '2026-04-06', end: '2026-04-07' },
      ])
    })

    it('bridges a single missing day as one period', () => {
      const runs = groupIntoPeriods(['2026-04-01', '2026-04-03'])
      expect(runs).toEqual([{ start: '2026-04-01', end: '2026-04-03' }])
    })

    it('returns empty for no input', () => {
      expect(groupIntoPeriods([])).toEqual([])
    })
  })

  describe('mergeMenstrualDays', () => {
    it('dedupes across cycle_entries and nc_imported', () => {
      const days = mergeMenstrualDays({
        cycleEntries: [
          { date: '2026-04-01', menstruation: true },
          { date: '2026-04-02', menstruation: true },
        ],
        ncImported: [
          { date: '2026-04-02', menstruation: 'MENSTRUATION', flow_quantity: null },
          { date: '2026-04-10', menstruation: null, flow_quantity: 'MEDIUM' },
        ],
      })
      expect(days).toEqual(['2026-04-01', '2026-04-02', '2026-04-10'])
    })

    it('excludes SPOTTING and menstruation=false rows', () => {
      const days = mergeMenstrualDays({
        cycleEntries: [{ date: '2026-04-01', menstruation: false }],
        ncImported: [
          { date: '2026-04-02', menstruation: 'SPOTTING', flow_quantity: 'LIGHT' },
          { date: '2026-04-05', menstruation: null, flow_quantity: null },
        ],
      })
      expect(days).toEqual([])
    })
  })

  describe('computeCycleStats', () => {
    it('returns insufficient when no data', () => {
      const stats = computeCycleStats({ cycleEntries: [], ncImported: [] })
      expect(stats.sampleSize).toBe(0)
      expect(stats.regularity).toBe('insufficient')
      expect(stats.currentCycle).toBeNull()
      expect(stats.meanCycleLength).toBeNull()
    })

    it('surfaces current cycle with null length when only one period exists', () => {
      const stats = computeCycleStats({
        cycleEntries: [
          { date: '2026-04-01', menstruation: true },
          { date: '2026-04-02', menstruation: true },
          { date: '2026-04-03', menstruation: true },
        ],
        ncImported: [],
      })
      expect(stats.currentCycle?.startDate).toBe('2026-04-01')
      expect(stats.currentCycle?.lengthDays).toBeNull()
      expect(stats.currentCycle?.periodDays).toBe(3)
      expect(stats.sampleSize).toBe(0)
    })

    it('computes mean and SD from completed cycles', () => {
      // Four cycles: starts Jan 1 (28d), Jan 29 (30d), Feb 28 (28d), Mar 28 -> current (no length)
      const stats = computeCycleStats({
        cycleEntries: [
          { date: '2026-01-01', menstruation: true },
          { date: '2026-01-02', menstruation: true },
          { date: '2026-01-29', menstruation: true },
          { date: '2026-01-30', menstruation: true },
          { date: '2026-02-28', menstruation: true },
          { date: '2026-03-01', menstruation: true },
          { date: '2026-03-28', menstruation: true },
          { date: '2026-03-29', menstruation: true },
        ],
        ncImported: [],
      })
      expect(stats.sampleSize).toBe(3)
      expect(stats.meanCycleLength).toBeCloseTo(28.7, 0)
      expect(stats.shortestCycle).toBe(28)
      expect(stats.longestCycle).toBe(30)
      expect(stats.currentCycle?.startDate).toBe('2026-03-28')
      expect(stats.currentCycle?.lengthDays).toBeNull()
    })

    it('classifies very irregular cycles', () => {
      const stats = computeCycleStats({
        cycleEntries: [
          { date: '2026-01-01', menstruation: true },
          { date: '2026-01-21', menstruation: true }, // 20 day cycle - short!
          { date: '2026-03-03', menstruation: true }, // 41 day cycle
          { date: '2026-03-30', menstruation: true }, // 27 day cycle
          { date: '2026-04-30', menstruation: true }, // 31 day cycle (current)
        ],
        ncImported: [],
      })
      expect(stats.regularity).toBe('irregular')
      expect(stats.sampleSize).toBeGreaterThanOrEqual(3)
    })
  })
})
