/**
 * Tests for Positional Vitals Intelligence
 */

import { describe, it, expect } from 'vitest'
import { classifyOrthostatic, classifyBP, classifyRestingHR, detectMultiVitalOutlier } from '../../api/vitals-classification'

describe('Vitals Classification', () => {
  describe('Orthostatic HR Delta', () => {
    it('should classify 30+ bpm as POTS threshold', () => {
      const result = classifyOrthostatic(32)
      expect(result.meetsPOTS).toBe(true)
      expect(result.label).toContain('POTS')
    })

    it('should classify 40+ bpm as significant', () => {
      const result = classifyOrthostatic(45)
      expect(result.meetsPOTS).toBe(true)
      expect(result.label).toContain('Significant')
    })

    it('should classify <10 bpm as normal', () => {
      const result = classifyOrthostatic(8)
      expect(result.meetsPOTS).toBe(false)
      expect(result.label).toContain('Normal')
    })

    it('should classify 20-29 bpm as elevated', () => {
      const result = classifyOrthostatic(25)
      expect(result.meetsPOTS).toBe(false)
      expect(result.label).toContain('Elevated')
    })
  })

  describe('Blood Pressure Classification (AHA)', () => {
    it('should classify 115/75 as normal', () => {
      const result = classifyBP(115, 75)
      expect(result.category).toBe('normal')
    })

    it('should classify 125/78 as elevated', () => {
      const result = classifyBP(125, 78)
      expect(result.category).toBe('elevated')
    })

    it('should classify 135/85 as stage 1 hypertension', () => {
      const result = classifyBP(135, 85)
      expect(result.category).toBe('stage1')
    })

    it('should classify 155/95 as stage 2 hypertension', () => {
      const result = classifyBP(155, 95)
      expect(result.category).toBe('stage2')
    })

    it('should classify 185/125 as hypertensive crisis', () => {
      const result = classifyBP(185, 125)
      expect(result.category).toBe('crisis')
    })
  })

  describe('Resting Heart Rate', () => {
    it('should classify 48 bpm as bradycardia', () => {
      const result = classifyRestingHR(48)
      expect(result.zone).toBe('bradycardia')
    })

    it('should classify 55 bpm as athletic', () => {
      const result = classifyRestingHR(55)
      expect(result.zone).toBe('athletic')
    })

    it('should classify 72 bpm as normal', () => {
      const result = classifyRestingHR(72)
      expect(result.zone).toBe('normal')
    })

    it('should classify 110 bpm as elevated', () => {
      const result = classifyRestingHR(110)
      expect(result.zone).toBe('elevated')
    })

    it('should classify 125 bpm as tachycardia', () => {
      const result = classifyRestingHR(125)
      expect(result.zone).toBe('tachycardia')
    })
  })

  describe('Multi-Vital Outlier Detection', () => {
    it('should detect outlier when 2+ metrics deviate', () => {
      const result = detectMultiVitalOutlier(
        { hr: 75, hrv: 30, temp: 37.5 },
        {
          hr: { mean: 50, std: 5 },  // 75 is 5 std devs above
          hrv: { mean: 65, std: 10 }, // 30 is 3.5 std devs below
          temp: { mean: 36.5, std: 0.3 }, // 37.5 is 3.3 std devs above
        },
      )
      expect(result.isOutlier).toBe(true)
      expect(result.deviatingMetrics.length).toBeGreaterThanOrEqual(2)
      expect(result.severity).toBe('significant')
    })

    it('should NOT flag normal variation', () => {
      const result = detectMultiVitalOutlier(
        { hr: 52, hrv: 62, temp: 36.6 },
        {
          hr: { mean: 50, std: 5 },
          hrv: { mean: 65, std: 10 },
          temp: { mean: 36.5, std: 0.3 },
        },
      )
      expect(result.isOutlier).toBe(false)
      expect(result.deviatingMetrics.length).toBe(0)
    })
  })
})
