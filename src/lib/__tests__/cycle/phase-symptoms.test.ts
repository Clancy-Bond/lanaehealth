import { describe, expect, it } from 'vitest'
import { aggregatePhaseSymptoms } from '@/lib/cycle/phase-symptoms'

describe('aggregatePhaseSymptoms', () => {
  it('returns empty counts when no periods are known', () => {
    const counts = aggregatePhaseSymptoms(
      [{ date: '2026-04-01', overall_pain: 5 }],
      [],
    )
    expect(counts.daysByPhase.menstrual).toBe(0)
    expect(counts.averages.menstrual.overall_pain).toBeNull()
  })

  it('classifies days within a cycle by phase', () => {
    // Period starts 2026-04-01
    // CD1-5 -> menstrual; CD6-13 -> follicular; CD14-16 -> ovulatory; CD17+ -> luteal
    const rows = [
      { date: '2026-04-01', overall_pain: 6 }, // CD1 menstrual
      { date: '2026-04-03', overall_pain: 4 }, // CD3 menstrual
      { date: '2026-04-08', overall_pain: 2 }, // CD8 follicular
      { date: '2026-04-15', overall_pain: 3 }, // CD15 ovulatory
      { date: '2026-04-20', overall_pain: 5 }, // CD20 luteal
      { date: '2026-04-28', overall_pain: 7 }, // CD28 luteal
    ]
    const counts = aggregatePhaseSymptoms(rows, ['2026-04-01'])

    expect(counts.daysByPhase.menstrual).toBe(2)
    expect(counts.daysByPhase.follicular).toBe(1)
    expect(counts.daysByPhase.ovulatory).toBe(1)
    expect(counts.daysByPhase.luteal).toBe(2)

    expect(counts.averages.menstrual.overall_pain).toBe(5)
    expect(counts.averages.follicular.overall_pain).toBe(2)
    expect(counts.averages.luteal.overall_pain).toBe(6)
  })

  it('ignores days before the first known period', () => {
    const rows = [
      { date: '2025-12-01', overall_pain: 8 }, // before first period; should be dropped
      { date: '2026-04-02', overall_pain: 4 }, // CD2 menstrual
    ]
    const counts = aggregatePhaseSymptoms(rows, ['2026-04-01'])
    expect(counts.daysByPhase.menstrual).toBe(1)
    expect(counts.averages.menstrual.overall_pain).toBe(4)
  })

  it('buckets pain counts for heatmap shading', () => {
    const rows = [
      { date: '2026-04-01', overall_pain: 1 }, // good
      { date: '2026-04-02', overall_pain: 5 }, // moderate
      { date: '2026-04-03', overall_pain: 7 }, // rough
    ]
    const counts = aggregatePhaseSymptoms(rows, ['2026-04-01'])
    expect(counts.painBuckets.menstrual.good).toBe(1)
    expect(counts.painBuckets.menstrual.moderate).toBe(1)
    expect(counts.painBuckets.menstrual.rough).toBe(1)
    expect(counts.painBuckets.menstrual.severe).toBe(0)
  })
})
