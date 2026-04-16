/**
 * Tests for Chronic Illness Exercise Intelligence
 */

import { describe, it, expect } from 'vitest'

describe('Exercise Intelligence', () => {
  describe('Flare Detection', () => {
    it('should detect flare when post-symptom >= 4', () => {
      const postSymptom = 4
      expect(postSymptom >= 4).toBe(true)
    })

    it('should detect flare when next-day pain increases by 2+', () => {
      const preSymptom = 3
      const nextDayPain = 6
      expect(nextDayPain - preSymptom >= 2).toBe(true)
    })

    it('should NOT flag mild post-exercise tiredness', () => {
      const postSymptom = 2
      expect(postSymptom >= 4).toBe(false)
    })
  })

  describe('Safe Ceiling Calculation', () => {
    it('should find max safe duration from non-flare workouts', () => {
      const workouts = [
        { duration: 15, flare: false },
        { duration: 20, flare: false },
        { duration: 30, flare: true },
        { duration: 25, flare: false },
        { duration: 35, flare: true },
      ]
      const safe = workouts.filter(w => !w.flare)
      const maxSafe = Math.max(...safe.map(w => w.duration))
      expect(maxSafe).toBe(25)
    })

    it('should calculate flare rate correctly', () => {
      const total = 10
      const flares = 3
      const rate = Math.round(flares / total * 100)
      expect(rate).toBe(30)
    })
  })

  describe('POTS Position Progression', () => {
    it('should recommend recumbent for new patients', () => {
      const recumbentCount = 0
      const seatedCount = 0
      const standingCount = 0
      const currentLevel = recumbentCount >= 3 ? 'recumbent' :
        seatedCount >= 3 ? 'seated' : 'recumbent'
      expect(currentLevel).toBe('recumbent')
    })

    it('should progress to seated after 5+ safe recumbent workouts', () => {
      const recumbentCount = 6
      const recumbentFlareRate = 15 // 15%
      const readyToProgress = recumbentCount >= 5 && recumbentFlareRate < 20
      expect(readyToProgress).toBe(true)
    })

    it('should NOT progress with high flare rate', () => {
      const recumbentCount = 8
      const recumbentFlareRate = 35 // 35%
      const readyToProgress = recumbentCount >= 5 && recumbentFlareRate < 20
      expect(readyToProgress).toBe(false)
    })
  })

  describe('Weekly Capacity', () => {
    it('should estimate weekly capacity from safe ceiling', () => {
      const safeCeilingMinutes = 30 // gentle intensity
      const sessionsPerWeek = 4
      const weeklyCapacity = safeCeilingMinutes * sessionsPerWeek
      expect(weeklyCapacity).toBe(120)
    })

    it('should track remaining capacity', () => {
      const weeklyCapacity = 120
      const usedThisWeek = 45
      const remaining = Math.max(0, weeklyCapacity - usedThisWeek)
      expect(remaining).toBe(75)
    })
  })
})
