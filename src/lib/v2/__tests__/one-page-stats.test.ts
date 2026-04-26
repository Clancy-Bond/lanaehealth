import { describe, it, expect } from 'vitest'
import { meanOf } from '@/lib/v2/one-page-stats'

describe('meanOf', () => {
  it('returns null for empty input', () => {
    expect(meanOf([])).toBeNull()
  })

  it('rounds to one decimal so the printed cell stays compact', () => {
    expect(meanOf([1, 2, 3, 4])).toBeCloseTo(2.5, 6)
    expect(meanOf([4, 5, 6])).toBeCloseTo(5, 6)
    expect(meanOf([1, 2])).toBeCloseTo(1.5, 6)
  })

  it('handles a single value cleanly', () => {
    expect(meanOf([7])).toBe(7)
  })
})
