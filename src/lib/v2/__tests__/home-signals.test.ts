import { describe, expect, it } from 'vitest'
import {
  bandForScore,
  deltaFromMedian,
  humanTimeAgo,
  median,
} from '@/lib/v2/home-signals'

describe('home-signals', () => {
  describe('bandForScore', () => {
    it('returns optimal at and above 85', () => {
      expect(bandForScore(85)).toBe('optimal')
      expect(bandForScore(99)).toBe('optimal')
      expect(bandForScore(100)).toBe('optimal')
    })

    it('returns good at the 70-84 range', () => {
      expect(bandForScore(84)).toBe('good')
      expect(bandForScore(77)).toBe('good')
      expect(bandForScore(70)).toBe('good')
    })

    it('returns fair at the 60-69 range', () => {
      expect(bandForScore(69)).toBe('fair')
      expect(bandForScore(65)).toBe('fair')
      expect(bandForScore(60)).toBe('fair')
    })

    it('returns payAttention below 60', () => {
      expect(bandForScore(59)).toBe('payAttention')
      expect(bandForScore(0)).toBe('payAttention')
      expect(bandForScore(-5)).toBe('payAttention')
    })

    it('returns payAttention for null, undefined, and NaN', () => {
      expect(bandForScore(null)).toBe('payAttention')
      expect(bandForScore(undefined)).toBe('payAttention')
      expect(bandForScore(NaN)).toBe('payAttention')
      expect(bandForScore(Infinity)).toBe('payAttention')
    })
  })

  describe('deltaFromMedian', () => {
    it('returns null for fewer than 3 samples', () => {
      expect(deltaFromMedian([])).toBeNull()
      expect(deltaFromMedian([10])).toBeNull()
      expect(deltaFromMedian([10, 20])).toBeNull()
    })

    it('treats null/undefined/NaN entries as missing for the count', () => {
      expect(deltaFromMedian([10, null, undefined, NaN])).toBeNull()
      expect(deltaFromMedian([10, 20, null])).toBeNull()
    })

    it('returns positive when latest exceeds the median of the rest', () => {
      // rest = [50, 60, 70], median = 60, latest = 80, delta = 20
      expect(deltaFromMedian([50, 60, 70, 80])).toBe(20)
    })

    it('returns negative when latest is below the median of the rest', () => {
      // rest = [70, 80, 90], median = 80, latest = 60, delta = -20
      expect(deltaFromMedian([70, 80, 90, 60])).toBe(-20)
    })

    it('returns 0 when all values are identical', () => {
      expect(deltaFromMedian([55, 55, 55, 55])).toBe(0)
    })

    it('ignores nulls when computing the rest sample', () => {
      // The filter strips nulls so latest is the last *clean* value.
      // Clean = [50, 60, 70, 80]; rest = [50, 60, 70]; median = 60; delta = 20
      expect(deltaFromMedian([50, 60, null, 70, null, 80])).toBe(20)
    })
  })

  describe('humanTimeAgo', () => {
    const today = '2026-04-21'

    it('returns "today" when the date matches the reference', () => {
      expect(humanTimeAgo('2026-04-21', today)).toBe('today')
    })

    it('returns "yesterday" when the date is one day prior', () => {
      expect(humanTimeAgo('2026-04-20', today)).toBe('yesterday')
    })

    it('returns "N days ago" for days 2-14', () => {
      expect(humanTimeAgo('2026-04-19', today)).toBe('2 days ago')
      expect(humanTimeAgo('2026-04-07', today)).toBe('14 days ago')
    })

    it('returns a short date string for days older than 14', () => {
      const result = humanTimeAgo('2026-04-06', today)
      // Format depends on locale + tz; the contract is "month name + day,
      // not the relative-string." Allow Apr 5 or Apr 6 to absorb the
      // tz drift between UTC midnight and the runner's local tz.
      expect(result).toMatch(/Apr\s+(5|6)/)
      expect(result).not.toMatch(/days ago/)
    })

    it('returns "upcoming" for future dates', () => {
      expect(humanTimeAgo('2026-04-22', today)).toBe('upcoming')
      expect(humanTimeAgo('2026-05-01', today)).toBe('upcoming')
    })

    it('returns "no data" for null, undefined, and empty string', () => {
      expect(humanTimeAgo(null, today)).toBe('no data')
      expect(humanTimeAgo(undefined, today)).toBe('no data')
      expect(humanTimeAgo('', today)).toBe('no data')
    })

    it('returns "no data" for an unparseable ISO string', () => {
      expect(humanTimeAgo('not-a-date', today)).toBe('no data')
    })
  })

  describe('median', () => {
    it('returns null for an empty array', () => {
      expect(median([])).toBeNull()
    })

    it('returns the value itself for a single-element array', () => {
      expect(median([42])).toBe(42)
    })

    it('returns the middle value for an odd-count array', () => {
      expect(median([3, 1, 2])).toBe(2) // sorted: [1, 2, 3]
      expect(median([5, 5, 5])).toBe(5)
    })

    it('returns the average of the middle two for an even-count array', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5)
      expect(median([10, 20, 30, 40])).toBe(25)
    })

    it('ignores null, undefined, and NaN entries', () => {
      expect(median([1, null, 3, undefined, 5, NaN])).toBe(3)
      expect(median([null, undefined, NaN])).toBeNull()
    })
  })
})
