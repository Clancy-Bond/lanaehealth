/**
 * Universal Import Engine
 *
 * Entry point for the import pipeline. Detects format, parses content,
 * returns canonical records for user review before saving.
 *
 * Usage:
 *   import { runImportPipeline } from '@/lib/import'
 *   const result = await runImportPipeline({ content: fileBuffer, fileName: 'labs.pdf' })
 *   // result.detection tells you what format was detected
 *   // result.parseResult.records contains canonical records for review
 */

export { detectFormat } from './format-detector'
export { runImportPipeline, runBatchImport } from './parser-router'
export { deduplicateRecords, createDedupeKey, filterExistingRecords } from './deduplicator'
export { normalizeRecords, quickValidate } from './normalizer'
export type {
  DetectedFormat,
  FormatDetectionResult,
  CanonicalRecord,
  CanonicalRecordType,
  CanonicalRecordData,
  ParseResult,
  ImportSession,
  ImportPhase,
  ImportSource,
  // Specific data types
  LabResultData,
  VitalSignData,
  MedicationData,
  ConditionData,
  SymptomData,
  AppointmentData,
  ProcedureData,
  AllergyData,
  ImmunizationData,
  FoodEntryData,
  CycleEntryData,
  MoodEntryData,
  SleepEntryData,
  ActivityEntryData,
  BodyMeasurementData,
  ClinicalNoteData,
  TimelineEventData,
} from './types'
