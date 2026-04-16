/**
 * Tier 2 Parser Tests
 *
 * Verify that each dedicated parser correctly extracts canonical records
 * from representative export formats.
 */

import { describe, it, expect } from 'vitest'
import {
  parseFloJson,
  parseClueJson,
  parseBearableCsv,
  parseSleepCycleCsv,
  parseStrongCsv,
  parseMacroFactorCsv,
} from '../../import/parsers/tier2-specialized'

describe('Tier 2 Specialized Parsers', () => {
  describe('parseFloJson', () => {
    it('extracts period days and symptoms from Flo JSON', () => {
      const flo = JSON.stringify({
        periods: [
          { startDate: '2026-03-01', endDate: '2026-03-05', flowLevel: 'heavy' },
        ],
        symptoms: [
          { date: '2026-03-02', types: ['cramps', 'fatigue'] },
        ],
      })

      const result = parseFloJson(flo)

      expect(result.records.length).toBeGreaterThanOrEqual(5)
      expect(result.records.filter(r => r.type === 'cycle_entry')).toHaveLength(5)
      expect(result.records.filter(r => r.type === 'symptom')).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
    })

    it('handles invalid JSON gracefully', () => {
      const result = parseFloJson('not json')
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.records).toHaveLength(0)
    })
  })

  describe('parseClueJson', () => {
    it('extracts flow + tags from Clue daily data', () => {
      const clue = JSON.stringify({
        days: [
          { day: '2026-03-10', flow: 'medium', tags: ['cramps', 'bloating'] },
          { day: '2026-03-11', flow: 'light', tags: ['headache'] },
        ],
      })

      const result = parseClueJson(clue)

      expect(result.records.filter(r => r.type === 'cycle_entry')).toHaveLength(2)
      expect(result.records.filter(r => r.type === 'symptom')).toHaveLength(3)
    })
  })

  describe('parseBearableCsv', () => {
    it('maps Bearable categories to canonical types', () => {
      const csv = `Date,Time,Category,Label,Rating,Notes
2026-03-15,08:00,Symptom,Fatigue,7,afternoon crash
2026-03-15,10:30,Mood,Happy,4,
2026-03-15,12:00,Medication,Ibuprofen,,200mg
2026-03-15,22:00,Sleep,,3,`

      const result = parseBearableCsv(csv)

      const symptoms = result.records.filter(r => r.type === 'symptom')
      const moods = result.records.filter(r => r.type === 'mood_entry')
      const meds = result.records.filter(r => r.type === 'medication')
      const sleep = result.records.filter(r => r.type === 'sleep_entry')

      expect(symptoms.length).toBe(1)
      expect(moods.length).toBe(1)
      expect(meds.length).toBe(1)
      expect(sleep.length).toBe(1)
    })

    it('returns error when required columns missing', () => {
      const csv = `RandomColumn\nvalue1`
      const result = parseBearableCsv(csv)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('parseSleepCycleCsv', () => {
    it('extracts sleep entries with duration from start and end', () => {
      const csv = `Start,End,Sleep Quality,Heart rate
2026-03-20 23:00:00,2026-03-21 07:00:00,85,52
2026-03-21 22:30:00,2026-03-22 06:30:00,70,55`

      const result = parseSleepCycleCsv(csv)

      expect(result.records.filter(r => r.type === 'sleep_entry')).toHaveLength(2)
      // First night is 8 hours = 480 minutes
      const firstEntry = result.records[0].data as { durationMinutes: number }
      expect(firstEntry.durationMinutes).toBe(480)
    })
  })

  describe('parseStrongCsv', () => {
    it('aggregates multiple sets into one activity entry per workout', () => {
      const csv = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,RPE
2026-03-22,Upper Body,3600,Bench Press,1,100,10,8
2026-03-22,Upper Body,3600,Bench Press,2,100,8,9
2026-03-22,Upper Body,3600,Bench Press,3,90,10,7
2026-03-22,Upper Body,3600,Rows,1,80,10,7`

      const result = parseStrongCsv(csv)

      expect(result.records.filter(r => r.type === 'activity_entry')).toHaveLength(1)
      const entry = result.records[0].data as { activityType: string; durationMinutes: number; notes: string }
      expect(entry.activityType).toBe('strength_training')
      expect(entry.durationMinutes).toBe(60)
      expect(entry.notes).toContain('Bench Press')
      expect(entry.notes).toContain('Rows')
    })
  })

  describe('parseMacroFactorCsv', () => {
    it('extracts food entries with full macros', () => {
      const csv = `Date,Meal,Food,Calories,Protein (g),Carbs (g),Fat (g),Fiber (g)
2026-03-25,Breakfast,Eggs,300,20,2,22,0
2026-03-25,Lunch,Salad,450,30,35,18,8
2026-03-25,Dinner,Salmon,500,35,10,35,2`

      const result = parseMacroFactorCsv(csv)

      expect(result.records.filter(r => r.type === 'food_entry')).toHaveLength(3)
      const lunch = result.records[1].data as { calories: number; protein: number; mealType: string }
      expect(lunch.calories).toBe(450)
      expect(lunch.protein).toBe(30)
      expect(lunch.mealType).toBe('lunch')
    })
  })
})
