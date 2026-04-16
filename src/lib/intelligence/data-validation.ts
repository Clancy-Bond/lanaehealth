// ---------------------------------------------------------------------------
// Data Validation Layer
// Validates incoming health data for range violations, anomalies, and
// physiologically impossible values. Runs BEFORE any persona analysis.
// ---------------------------------------------------------------------------

import type { ValidationFlag } from './types'

// ===========================================================================
// ValidationResult
// ===========================================================================

export interface ValidationResult {
  valid: boolean
  flag?: ValidationFlag
}

// ===========================================================================
// Range definitions
// ===========================================================================

interface RangeDef {
  min: number
  max: number
  impossible_min?: number
}

const RANGES = {
  heart_rate: { min: 30, max: 220, impossible_min: 0 },
  hrv: { min: 5, max: 300, impossible_min: 0 },
  body_temp_f: { min: 95, max: 104, impossible_min: 80 },
  spo2: { min: 80, max: 100, impossible_min: 0 },
  pain: { min: 0, max: 10 },
  fatigue: { min: 0, max: 10 },
  sleep_hours: { min: 0, max: 24 },
  readiness: { min: 0, max: 100 },
} as const satisfies Record<string, RangeDef>

// ===========================================================================
// Internal helper
// ===========================================================================

function validateRange(
  value: number,
  field: string,
  range: RangeDef,
  sourceTable: string,
  sourceDate: string,
): ValidationResult {
  // Check impossible values first (more severe)
  if (range.impossible_min !== undefined && value <= range.impossible_min) {
    return {
      valid: false,
      flag: {
        source_table: sourceTable,
        source_date: sourceDate,
        flag_type: 'impossible_value',
        field_name: field,
        original_value: value,
        expected_range: `${range.min}-${range.max}`,
        severity: 'error',
      },
    }
  }

  // Check out-of-range
  if (value < range.min || value > range.max) {
    return {
      valid: false,
      flag: {
        source_table: sourceTable,
        source_date: sourceDate,
        flag_type: 'out_of_range',
        field_name: field,
        original_value: value,
        expected_range: `${range.min}-${range.max}`,
        severity: 'warning',
      },
    }
  }

  return { valid: true }
}

// ===========================================================================
// Exported validators
// ===========================================================================

export function validateHeartRate(
  value: number,
  sourceTable = 'oura_daily',
  sourceDate = '',
): ValidationResult {
  return validateRange(value, 'heart_rate', RANGES.heart_rate, sourceTable, sourceDate)
}

export function validateHRV(
  value: number,
  sourceTable = 'oura_daily',
  sourceDate = '',
): ValidationResult {
  return validateRange(value, 'hrv', RANGES.hrv, sourceTable, sourceDate)
}

export function validateTemperature(
  value: number,
  sourceTable = 'oura_daily',
  sourceDate = '',
): ValidationResult {
  return validateRange(value, 'body_temp_f', RANGES.body_temp_f, sourceTable, sourceDate)
}

export function validatePainScore(
  value: number,
  sourceTable = 'daily_logs',
  sourceDate = '',
): ValidationResult {
  return validateRange(value, 'pain', RANGES.pain, sourceTable, sourceDate)
}

export function validateSpO2(
  value: number,
  sourceTable = 'oura_daily',
  sourceDate = '',
): ValidationResult {
  return validateRange(value, 'spo2', RANGES.spo2, sourceTable, sourceDate)
}

// ===========================================================================
// Sudden jump detection
// ===========================================================================

export function detectSuddenJump(
  values: number[],
  threshold = 3,
): { isJump: boolean; standardDeviations?: number } {
  if (values.length < 3) {
    return { isJump: false }
  }

  const history = values.slice(0, -1)
  const latest = values[values.length - 1]

  const mean = history.reduce((sum, v) => sum + v, 0) / history.length

  const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) {
    return { isJump: latest !== mean, standardDeviations: latest !== mean ? Infinity : 0 }
  }

  const deviations = Math.abs(latest - mean) / stdDev
  const rounded = Math.round(deviations * 100) / 100

  return { isJump: deviations > threshold, standardDeviations: rounded }
}

// ===========================================================================
// Data completeness
// ===========================================================================

export function computeCompleteness(daysWithData: number, totalDays: number): number {
  if (totalDays <= 0) return 0
  return Math.round((daysWithData / totalDays) * 100)
}
