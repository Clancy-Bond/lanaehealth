import { describe, it, expect } from 'vitest'
import { rankAndShape } from '@/lib/v2/triggers'

/**
 * Unit tests for the Bearable-pattern trigger ranker. The DB read
 * itself is covered by integration tests; here we lock down the
 * pure shaping function.
 */

const baseRow = {
  id: 'r1',
  factor_a: 'caffeine',
  factor_b: 'fatigue',
  correlation_type: 'pearson',
  coefficient: 0.4,
  effect_size: null,
  confidence_level: 'moderate' as const,
  sample_size: 14,
  computed_at: '2026-04-22T12:00:00Z',
}

describe('rankAndShape', () => {
  it('returns empty when given no rows', () => {
    expect(rankAndShape([])).toEqual([])
  })

  it('keeps strong tier ahead of moderate even with smaller effect', () => {
    const rows = [
      { ...baseRow, id: 'a', confidence_level: 'moderate' as const, coefficient: 0.6 },
      { ...baseRow, id: 'b', confidence_level: 'strong' as const, coefficient: 0.3, factor_a: 'screen_time' },
    ]
    const out = rankAndShape(rows)
    expect(out[0].id).toBe('b')
    expect(out[0].factor).toBe('screen time')
  })

  it('dedupes by (factor_a, factor_b) pair', () => {
    const rows = [
      { ...baseRow, id: 'a', confidence_level: 'strong' as const, coefficient: 0.5 },
      { ...baseRow, id: 'b', confidence_level: 'moderate' as const, coefficient: 0.4 },
    ]
    const out = rankAndShape(rows)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
  })

  it('humanizes factor names by replacing underscores with spaces', () => {
    const out = rankAndShape([{ ...baseRow, factor_a: 'social_media' }])
    expect(out[0].factor).toBe('social media')
  })

  it('renders sleep_quality with the inverted impact phrase', () => {
    const out = rankAndShape([
      { ...baseRow, factor_a: 'late_caffeine', factor_b: 'sleep_quality', coefficient: -0.5 },
    ])
    expect(out[0].impact).toBe('sleep quality runs lower')
  })
})
