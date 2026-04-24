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

  describe('signal-fusion unification (Wave 4)', () => {
    it('uses signal-fusion ovulation date as the source of truth when BBT confirms', () => {
      // Calendar would put ovulation around CD 14 (~2026-04-08); signal
      // says CD 16 (2026-04-10). Window's right edge MUST be the fused date.
      const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
      const p = predictFertileWindow({
        today: '2026-04-09',
        stats,
        ovulation: {
          ovulationDate: '2026-04-10',
          confidence: 'high',
          source: 'bbt',
          bbtShiftDetected: true,
          lhPositiveDetected: false,
          rationale: 'test',
        },
      })
      expect(p.rangeEnd).toBe('2026-04-10')
      expect(p.confidence).toBe('high')
      expect(p.caveat).toMatch(/BBT shift|Natural Cycles|pinned/i)
    })

    it('uses NC-confirmed ovulation date when fusion source is bbt+lh / high', () => {
      const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
      const p = predictFertileWindow({
        today: '2026-04-09',
        stats,
        ovulation: {
          ovulationDate: '2026-04-12',
          confidence: 'high',
          source: 'bbt+lh',
          bbtShiftDetected: false,
          lhPositiveDetected: true,
          rationale: 'NC OVU_CONFIRMED',
        },
      })
      expect(p.rangeEnd).toBe('2026-04-12')
      expect(p.confidence).toBe('high')
    })

    it('falls back to calendar when signal-fusion has no ovulation', () => {
      const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
      const p = predictFertileWindow({
        today: '2026-04-05',
        stats,
        ovulation: {
          ovulationDate: null,
          confidence: 'low',
          source: 'none',
          bbtShiftDetected: false,
          lhPositiveDetected: false,
          rationale: 'no signals',
        },
      })
      // No fusion -> calendar path. Result is the same as before Wave 4.
      expect(p.status).toBe('in_window')
      expect(p.rangeStart).not.toBeNull()
    })

    it('does not pin to fused date when fusion is LH-only / low confidence', () => {
      // LH-only is a tentative signal per NC's published rules; a single
      // positive LH alone is never enough to confirm. Window stays in
      // calendar mode in this case.
      const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
      const lhOnly = predictFertileWindow({
        today: '2026-04-09',
        stats,
        ovulation: {
          ovulationDate: '2026-04-13',
          confidence: 'low',
          source: 'lh',
          bbtShiftDetected: false,
          lhPositiveDetected: true,
          rationale: 'LH only, low confidence',
        },
      })
      // Calendar fallback -> rangeEnd is calendar predicted ovulation
      // (~2026-04-08), NOT the LH-only date 2026-04-13.
      expect(lhOnly.rangeEnd).not.toBe('2026-04-13')
    })

    it('treats post-ovulation correctly when window end is in the past', () => {
      const stats = buildStats(['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'])
      const p = predictFertileWindow({
        today: '2026-04-20',
        stats,
        ovulation: {
          ovulationDate: '2026-04-10',
          confidence: 'high',
          source: 'bbt',
          bbtShiftDetected: true,
          lhPositiveDetected: false,
          rationale: 'confirmed shift',
        },
      })
      expect(p.status).toBe('post_ovulation')
      expect(p.rangeEnd).toBe('2026-04-10')
    })
  })
})
