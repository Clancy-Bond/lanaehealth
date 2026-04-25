/**
 * Shared shapes for the data-correction subsystem.
 *
 * Why a separate module: both record-correction.ts and
 * correction-history.ts use the same Correction shape, and the
 * /api/v2/corrections route also needs it for response typing. Keeping
 * the canonical shape here avoids type drift.
 */

/** Discriminator value written to medical_narrative.kind. */
export const CORRECTION_KIND = 'user_correction' as const

/** Source-table whitelist. The UI may correct values from these tables. */
export type CorrectableTable =
  | 'cycle_entries'
  | 'nc_imported'
  | 'oura_daily'
  | 'food_entries'
  | 'symptoms'
  | 'pain_points'
  | 'daily_logs'
  | 'lab_results'

export const CORRECTABLE_TABLES: CorrectableTable[] = [
  'cycle_entries',
  'nc_imported',
  'oura_daily',
  'food_entries',
  'symptoms',
  'pain_points',
  'daily_logs',
  'lab_results',
]

/**
 * Where the correction originated. Helps the AI weight intent (a
 * direct user edit on /v2/cycle is more authoritative than a
 * derived/inferred patch from another surface).
 */
export type CorrectionSource =
  | 'v2_cycle'
  | 'v2_log'
  | 'v2_sleep'
  | 'v2_calories'
  | 'v2_other'

/** The metadata payload stored under medical_narrative.metadata. */
export interface CorrectionMetadata {
  tableName: CorrectableTable
  rowId: string
  fieldName: string
  originalValue: string | number | boolean | null
  correctedValue: string | number | boolean | null
  reason: string
  source: CorrectionSource
}

/** A correction row read back from medical_narrative. */
export interface Correction {
  id: string
  createdAt: string
  metadata: CorrectionMetadata
  narrative: string
}
