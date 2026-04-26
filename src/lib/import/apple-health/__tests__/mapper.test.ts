/**
 * Unit tests for the Apple Health -> table mapper.
 *
 * The mapper is pure, so we feed it DailySummary fixtures and
 * assert the row shapes / merge decisions. No Supabase mocking
 * needed — the API route is the integration boundary, not this
 * file.
 */
import { describe, it, expect } from 'vitest'
import {
  classify,
  isMenstruatingFlow,
  toCycleRow,
  toNcImportedRow,
  toNutritionRow,
  toBiometricRow,
  decideBiometricMerge,
} from '@/lib/import/apple-health/mapper'
import type { DailySummary } from '@/lib/importers/apple-health'

function fixture(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    date: '2026-04-22',
    basalTemp: null,
    menstrualFlow: null,
    cervicalMucus: null,
    ovulationTest: null,
    sexualActivity: false,
    heartRateAvg: null,
    heartRateMin: null,
    heartRateMax: null,
    restingHR: null,
    hrv: null,
    bloodOxygen: null,
    respiratoryRate: null,
    bpSystolic: null,
    bpDiastolic: null,
    bloodGlucose: null,
    vo2Max: null,
    bodyTemp: null,
    weight: null,
    bmi: null,
    bodyFat: null,
    height: null,
    steps: null,
    walkingDistance: null,
    flightsClimbed: null,
    activeEnergy: null,
    exerciseMinutes: null,
    sleepHours: null,
    calories: null,
    protein: null,
    fat: null,
    carbs: null,
    fiber: null,
    sugar: null,
    sodium: null,
    iron: null,
    calcium: null,
    vitaminD: null,
    vitaminC: null,
    caffeine: null,
    water: null,
    ...overrides,
  }
}

describe('isMenstruatingFlow', () => {
  it('treats light, medium, heavy as menstruating', () => {
    expect(isMenstruatingFlow('light')).toBe(true)
    expect(isMenstruatingFlow('medium')).toBe(true)
    expect(isMenstruatingFlow('heavy')).toBe(true)
  })
  it('treats none, unspecified, and null as not menstruating', () => {
    expect(isMenstruatingFlow('none')).toBe(false)
    expect(isMenstruatingFlow('unspecified')).toBe(false)
    expect(isMenstruatingFlow(null)).toBe(false)
  })
})

describe('classify', () => {
  it('returns all-false for an empty summary', () => {
    expect(classify(fixture())).toEqual({ cycle: false, nutrition: false, biometric: false })
  })

  it('flags cycle when basalTemp present', () => {
    expect(classify(fixture({ basalTemp: 36.5 })).cycle).toBe(true)
  })

  it('flags cycle when menstrualFlow present', () => {
    expect(classify(fixture({ menstrualFlow: 'medium' })).cycle).toBe(true)
  })

  it('flags nutrition when calories or any macro present', () => {
    expect(classify(fixture({ calories: 1800 })).nutrition).toBe(true)
    expect(classify(fixture({ protein: 90 })).nutrition).toBe(true)
  })

  it('flags biometric for HR, sleep, weight, BP, or activity fields', () => {
    expect(classify(fixture({ heartRateAvg: 72 })).biometric).toBe(true)
    expect(classify(fixture({ sleepHours: 7.2 })).biometric).toBe(true)
    expect(classify(fixture({ weight: 62.5 })).biometric).toBe(true)
    expect(classify(fixture({ bpSystolic: 118 })).biometric).toBe(true)
    expect(classify(fixture({ steps: 8400 })).biometric).toBe(true)
  })
})

describe('toCycleRow', () => {
  it('marks menstruation true when flow is light/medium/heavy', () => {
    const row = toCycleRow('user-1', fixture({ menstrualFlow: 'medium' }))
    expect(row).toMatchObject({
      date: '2026-04-22',
      menstruation: true,
      flow_level: 'medium',
    })
    // cycle_entries is legacy single-tenant: no user_id column.
    expect((row as unknown as Record<string, unknown>).user_id).toBeUndefined()
  })

  it('marks menstruation false when flow is "none"', () => {
    const row = toCycleRow('user-1', fixture({ menstrualFlow: 'none' }))
    expect(row.menstruation).toBe(false)
    expect(row.flow_level).toBe('none')
  })
})

describe('toNcImportedRow', () => {
  it('always tags data_flags as apple_health_export', () => {
    const row = toNcImportedRow('u', fixture({ basalTemp: 36.7, menstrualFlow: 'light' }), 'now')
    expect(row.data_flags).toBe('apple_health_export')
    expect(row.temperature).toBe(36.7)
    expect(row.menstruation).toBe('menstruation')
    expect(row.imported_at).toBe('now')
  })

  it('sets menstruation to null when flow is none', () => {
    const row = toNcImportedRow('u', fixture({ menstrualFlow: 'none' }), 'now')
    expect(row.menstruation).toBeNull()
  })
})

describe('toNutritionRow', () => {
  it('tags macros.source so the API route can scope re-import deletes', () => {
    const row = toNutritionRow(
      'u',
      'log-1',
      fixture({ calories: 1850, protein: 90, fat: 70, carbs: 200 }),
      ['caffeine'],
      'now',
    )
    expect(row.meal_type).toBe('snack')
    expect(row.calories).toBe(1850)
    expect(row.macros).toMatchObject({
      source: 'apple_health_export',
      protein: 90,
      fat: 70,
      carbs: 200,
    })
    expect(row.flagged_triggers).toEqual(['caffeine'])
    expect(row.food_items).toMatch(/Daily total: 1850 cal/)
  })
})

describe('toBiometricRow', () => {
  it('approximates sleep_score from sleepHours and computes body_temp_deviation', () => {
    const row = toBiometricRow(
      'u',
      fixture({ sleepHours: 7.2, bodyTemp: 36.9, hrv: 48, restingHR: 60 }),
      'now',
    )
    expect(row.sleep_duration).toBe(Math.round(7.2 * 3600))
    expect(row.sleep_score).toBe(Math.min(100, Math.round(7.2 * 13)))
    expect(row.body_temp_deviation).toBeCloseTo(0.3, 2)
    expect(row.hrv_avg).toBe(48)
    expect(row.resting_hr).toBe(60)
    expect(row.raw_json.source).toBe('apple_health_export')
  })

  it('caps the synthetic sleep_score at 100', () => {
    const row = toBiometricRow('u', fixture({ sleepHours: 12 }), 'now')
    expect(row.sleep_score).toBe(100)
  })
})

describe('decideBiometricMerge', () => {
  const next = toBiometricRow('u', fixture({ steps: 8000, weight: 62 }), 'now')

  it('returns insert when no existing row', () => {
    expect(decideBiometricMerge(next, null).kind).toBe('insert')
  })

  it('returns replace when existing row was apple_health', () => {
    const decision = decideBiometricMerge(next, { raw_json: { source: 'apple_health_export' } })
    expect(decision.kind).toBe('replace')
  })

  it('returns merge that preserves Oura fields when existing row was Oura', () => {
    const ouraRaw = { source: 'oura', activity: { score: 80 } }
    const decision = decideBiometricMerge(next, { raw_json: ouraRaw })
    expect(decision.kind).toBe('merge')
    if (decision.kind === 'merge') {
      expect(decision.mergedRawJson.source).toBe('oura')
      expect((decision.mergedRawJson.activity as { score: number }).score).toBe(80)
      expect(decision.mergedRawJson.apple_health).toBeDefined()
    }
  })
})
