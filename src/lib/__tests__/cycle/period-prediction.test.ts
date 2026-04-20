import { describe, expect, it } from 'vitest'
import { computeCycleStats } from '@/lib/cycle/cycle-stats'
import {
  predictFertileWindow,
  predictNextPeriod,
} from '@/lib/cycle/period-prediction'

function buildStats(startDates: readonly string[]) {
  const cycleEntries = startDates.flatMap((d) => [
    { date: d, menstruation: true as boolean | null },
    {
      date: addDays(d, 1),
      menstruation: true as boolean | null,
    },
    {
      date: addDays(d, 2),
      menstruation: true as boolean | null,
    },
  ])
  return computeCycleStats({ cycleEntries, ncImported: [] })
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('predictNextPeriod', () => {
  it('returns unknown when no stats exist', () => {
    const stats = computeCycleStats({ cycleEntries: [], ncImported: [] })
    const p = predictNextPeriod({ today: '2026-04-19', stats })
    expect(p.status).toBe('unknown')
    expect(p.predictedDate).toBeNull()
  })

  it('widens range when SD is missing (only 1 completed cycle)', () => {
    const stats = buildStats(['2026-03-01', '2026-03-29'])
    const p = predictNextPeriod({ today: '2026-04-19', stats })
    expect(p.status === 'projected' || p.status === 'overdue').toBe(true)
    expect(p.rangeStart).not.toBeNull()
    expect(p.rangeEnd).not.toBeNull()
    expect(p.confidence).toBe('low')
  })

  it('flags overdue when today is well past the range', () => {
    // 3 cycles at ~28 days each, last period was 50 days ago
    const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
    // next predicted around 2026-04-24 (+/- small); today is 2026-05-20 -> very overdue
    const p = predictNextPeriod({ today: '2026-05-20', stats })
    expect(p.status).toBe('overdue')
    expect(p.daysOverdue).toBeGreaterThan(0)
  })

  it('reports projected status when today is within range', () => {
    const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
    const p = predictNextPeriod({ today: '2026-04-20', stats })
    expect(p.status).toBe('projected')
    expect(p.daysUntil).toBeTypeOf('number')
  })
})

describe('predictFertileWindow', () => {
  it('marks in_window around mid-cycle', () => {
    const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
    // Cycle started 2026-03-26, mean ~28d -> ovulation around day 14 = 2026-04-08
    // Fertile window roughly 2026-04-03 .. 2026-04-08
    const p = predictFertileWindow({ today: '2026-04-05', stats })
    expect(p.status).toBe('in_window')
    expect(p.rangeStart).not.toBeNull()
    expect(p.rangeEnd).not.toBeNull()
  })

  it('marks post_ovulation well into luteal', () => {
    const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
    const p = predictFertileWindow({ today: '2026-04-15', stats })
    expect(p.status).toBe('post_ovulation')
  })

  it('returns unknown when no cycle data', () => {
    const stats = computeCycleStats({ cycleEntries: [], ncImported: [] })
    const p = predictFertileWindow({ today: '2026-04-19', stats })
    expect(p.status).toBe('unknown')
  })

  it('never flags in_window while still on a menstrual day', () => {
    // Very irregular cycles create wide SD. Without clamping, the SD
    // buffer rolls the window start into the patient's period itself,
    // which we consider clinically misleading. Clamp to period end + 1.
    const stats = computeCycleStats({
      cycleEntries: [
        { date: '2026-01-01', menstruation: true },
        { date: '2026-01-02', menstruation: true },
        { date: '2026-01-03', menstruation: true },
        // Very short then very long then somewhere in between
        { date: '2026-01-14', menstruation: true }, // 13 day cycle
        { date: '2026-01-15', menstruation: true },
        { date: '2026-02-20', menstruation: true }, // 37 day cycle
        { date: '2026-02-21', menstruation: true },
        { date: '2026-02-22', menstruation: true },
        { date: '2026-02-23', menstruation: true },
        { date: '2026-04-18', menstruation: true }, // 57 day cycle, current
        { date: '2026-04-19', menstruation: true },
      ],
      ncImported: [],
    })
    // Today is CD 2 of the newest cycle - menstrual, should NOT be fertile window.
    const p = predictFertileWindow({ today: '2026-04-19', stats })
    expect(p.status).not.toBe('in_window')
  })
})
