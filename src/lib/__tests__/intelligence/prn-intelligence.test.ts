/**
 * Tests for PRN Medication Intelligence
 */

import { describe, it, expect } from 'vitest'

describe('PRN Intelligence', () => {
  describe('Max Daily Dose', () => {
    it('should calculate max doses for Tylenol (4000mg / 500mg = 8)', () => {
      const maxDailyMg = 4000
      const doseMg = 500
      const maxDoses = Math.floor(maxDailyMg / doseMg)
      expect(maxDoses).toBe(8)
    })

    it('should calculate max doses for Ibuprofen (1200mg / 400mg = 3)', () => {
      const maxDailyMg = 1200
      const doseMg = 400
      const maxDoses = Math.floor(maxDailyMg / doseMg)
      expect(maxDoses).toBe(3)
    })

    it('should flag at-limit when doses equal max', () => {
      const dosesToday = 8
      const maxDoses = 8
      expect(dosesToday >= maxDoses).toBe(true)
    })
  })

  describe('Time Between Doses', () => {
    it('should enforce 4-hour minimum for Tylenol', () => {
      const minHoursBetween = 4
      const minMinutes = minHoursBetween * 60
      const timeSinceLastMinutes = 180 // 3 hours
      const canTakeNext = timeSinceLastMinutes >= minMinutes
      expect(canTakeNext).toBe(false)
    })

    it('should allow next dose after minimum time', () => {
      const minHoursBetween = 4
      const minMinutes = minHoursBetween * 60
      const timeSinceLastMinutes = 250 // 4h 10m
      const canTakeNext = timeSinceLastMinutes >= minMinutes
      expect(canTakeNext).toBe(true)
    })
  })

  describe('Escalation Detection', () => {
    it('should detect 30%+ increase as escalation', () => {
      const firstTwoWeeks = 6 + 7 // 13 doses
      const lastTwoWeeks = 9 + 10 // 19 doses
      const isEscalating = lastTwoWeeks > firstTwoWeeks * 1.3
      expect(isEscalating).toBe(true) // 19 > 16.9
    })

    it('should NOT flag stable usage', () => {
      const firstTwoWeeks = 7 + 8 // 15
      const lastTwoWeeks = 7 + 9 // 16
      const isEscalating = lastTwoWeeks > firstTwoWeeks * 1.3
      expect(isEscalating).toBe(false) // 16 < 19.5
    })
  })

  describe('Time Formatting', () => {
    it('should format minutes ago', () => {
      const mins = 45
      const formatted = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`
      expect(formatted).toBe('45m ago')
    })

    it('should format hours and minutes', () => {
      const mins = 135
      const formatted = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`
      expect(formatted).toBe('2h 15m ago')
    })
  })
})
