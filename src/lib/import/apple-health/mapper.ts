/**
 * Apple Health -> LanaeHealth table mapper
 *
 * Pure functions only. No Supabase calls. The API route is in charge
 * of writes; this module just turns a DailySummary into the row
 * shapes the various tables expect, and exposes a single
 * conflict-resolution decision so we can keep the rules in one
 * place.
 *
 * Supported destinations:
 *   - cycle_entries / nc_imported (cycle data)
 *   - daily_logs + food_entries (nutrition totals)
 *   - oura_daily (biometrics + sleep + activity, merged with Oura
 *     data when an Oura row already exists for the same day)
 *
 * Conflict policy: we prefer Oura-sourced fields over Apple Health
 * for HRV / resting HR / sleep duration when both exist for the
 * same day, because Oura's measurements are more precise. Apple
 * Health enriches the row with everything Oura doesn't track
 * (weight, BP, blood glucose, dietary intake, workouts) and is
 * stored under raw_json.apple_health on the merged row.
 */
import type { DailySummary } from '@/lib/importers/apple-health'

export interface CycleRow {
  user_id: string
  date: string
  menstruation: boolean
  flow_level: string | null
  lh_test_result: string | null
  cervical_mucus_consistency: string | null
}

export interface NcImportedRow {
  user_id: string
  date: string
  temperature: number | null
  menstruation: 'menstruation' | null
  flow_quantity: string | null
  cervical_mucus_consistency: string | null
  lh_test: string | null
  imported_at: string
  data_flags: string
}

export interface NutritionRow {
  user_id: string
  log_id: string
  meal_type: 'snack'
  food_items: string
  calories: number
  macros: Record<string, unknown>
  flagged_triggers: string[]
  logged_at: string
}

export interface BiometricRow {
  user_id: string
  date: string
  hrv_avg: number | null
  resting_hr: number | null
  sleep_score: number | null
  sleep_duration: number | null
  body_temp_deviation: number | null
  raw_json: Record<string, unknown>
  synced_at: string
}

/** Result of looking at a DailySummary and deciding which destinations apply. */
export interface MappedTargets {
  cycle: boolean
  nutrition: boolean
  biometric: boolean
}

export function classify(summary: DailySummary): MappedTargets {
  return {
    cycle: !!(
      summary.basalTemp ||
      summary.menstrualFlow ||
      summary.cervicalMucus ||
      summary.ovulationTest
    ),
    nutrition: !!(
      summary.calories ||
      summary.protein ||
      summary.fat ||
      summary.carbs
    ),
    biometric: !!(
      summary.heartRateAvg ||
      summary.hrv ||
      summary.restingHR ||
      summary.steps ||
      summary.sleepHours ||
      summary.weight ||
      summary.activeEnergy ||
      summary.bloodOxygen ||
      summary.bpSystolic ||
      summary.bpDiastolic
    ),
  }
}

export function isMenstruatingFlow(flow: string | null): boolean {
  if (!flow) return false
  return flow !== 'none' && flow !== 'unspecified'
}

export function toCycleRow(userId: string, summary: DailySummary): CycleRow {
  return {
    user_id: userId,
    date: summary.date,
    menstruation: isMenstruatingFlow(summary.menstrualFlow),
    flow_level: summary.menstrualFlow,
    lh_test_result: summary.ovulationTest,
    cervical_mucus_consistency: summary.cervicalMucus,
  }
}

export function toNcImportedRow(
  userId: string,
  summary: DailySummary,
  importedAt: string,
): NcImportedRow {
  return {
    user_id: userId,
    date: summary.date,
    temperature: summary.basalTemp,
    menstruation: isMenstruatingFlow(summary.menstrualFlow) ? 'menstruation' : null,
    flow_quantity: summary.menstrualFlow,
    cervical_mucus_consistency: summary.cervicalMucus,
    lh_test: summary.ovulationTest,
    imported_at: importedAt,
    data_flags: 'apple_health_export',
  }
}

export function toNutritionRow(
  userId: string,
  logId: string,
  summary: DailySummary,
  triggers: string[],
  loggedAt: string,
): NutritionRow {
  return {
    user_id: userId,
    log_id: logId,
    meal_type: 'snack',
    food_items: `Daily total: ${Math.round(summary.calories || 0)} cal`,
    calories: Math.round(summary.calories || 0),
    macros: {
      // Source tag the API route uses to scope re-import deletes.
      source: 'apple_health_export',
      protein: summary.protein,
      carbs: summary.carbs,
      fat: summary.fat,
      fiber: summary.fiber,
      sugar: summary.sugar,
      sodium: summary.sodium,
      iron: summary.iron,
      calcium: summary.calcium,
      vitamin_d: summary.vitaminD,
      vitamin_c: summary.vitaminC,
      caffeine: summary.caffeine,
      water: summary.water,
    },
    flagged_triggers: triggers,
    logged_at: loggedAt,
  }
}

export function toBiometricRow(
  userId: string,
  summary: DailySummary,
  syncedAt: string,
): BiometricRow {
  // Sleep score is approximated from raw sleep duration when Apple
  // Health is the only source. 13 = (100 / ~7.7h target).
  const sleepScore = summary.sleepHours
    ? Math.min(100, Math.round(summary.sleepHours * 13))
    : null

  return {
    user_id: userId,
    date: summary.date,
    hrv_avg: summary.hrv,
    resting_hr: summary.restingHR,
    sleep_score: sleepScore,
    sleep_duration: summary.sleepHours ? Math.round(summary.sleepHours * 3600) : null,
    body_temp_deviation: summary.bodyTemp ? +(summary.bodyTemp - 36.6).toFixed(2) : null,
    raw_json: {
      source: 'apple_health_export',
      heart_rate_avg: summary.heartRateAvg,
      heart_rate_min: summary.heartRateMin,
      heart_rate_max: summary.heartRateMax,
      blood_oxygen: summary.bloodOxygen,
      respiratory_rate: summary.respiratoryRate,
      bp_systolic: summary.bpSystolic,
      bp_diastolic: summary.bpDiastolic,
      blood_glucose: summary.bloodGlucose,
      vo2_max: summary.vo2Max,
      weight_kg: summary.weight,
      bmi: summary.bmi,
      body_fat_pct: summary.bodyFat,
      steps: summary.steps,
      walking_distance: summary.walkingDistance,
      flights_climbed: summary.flightsClimbed,
      active_energy: summary.activeEnergy,
      exercise_minutes: summary.exerciseMinutes,
      sleep_hours: summary.sleepHours,
      body_temp: summary.bodyTemp,
      basal_temp: summary.basalTemp,
      sexual_activity: summary.sexualActivity,
    },
    synced_at: syncedAt,
  }
}

/**
 * Decides what to do with a biometric row when an oura_daily row
 * already exists for the same (user, date). We never overwrite Oura
 * data with Apple Health data; instead we either:
 *   - Replace the existing row (when it was an Apple Health row)
 *   - Merge the Apple-Health-only fields into raw_json under the
 *     `apple_health` key (when it was an Oura row)
 *   - Insert fresh (when no row exists yet)
 *
 * The API route hands us the existing row.raw_json (or null when
 * there is no row) and we tell it which path to take.
 */
export type BiometricMergeAction =
  | { kind: 'insert' }
  | { kind: 'replace' }
  | { kind: 'merge'; mergedRawJson: Record<string, unknown> }

export function decideBiometricMerge(
  next: BiometricRow,
  existing: { raw_json: Record<string, unknown> | null } | null,
): BiometricMergeAction {
  if (!existing) return { kind: 'insert' }
  const src = existing.raw_json?.['source']
  if (src === 'apple_health_export' || src === 'apple_health') {
    return { kind: 'replace' }
  }
  return {
    kind: 'merge',
    mergedRawJson: {
      ...(existing.raw_json ?? {}),
      apple_health: next.raw_json,
    },
  }
}
