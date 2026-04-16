/**
 * Universal Import Engine -- Type Definitions
 *
 * All import parsers normalize data to these canonical types.
 * The pipeline: detect format -> parse -> normalize -> deduplicate -> store
 */

// ── Detected Format ────────────────────────────────────────────────

export type DetectedFormat =
  | 'fhir-bundle'        // FHIR R4 JSON Bundle
  | 'fhir-resource'      // Single FHIR R4 resource
  | 'ccda-xml'           // C-CDA / CCD XML document
  | 'apple-health-xml'   // Apple Health export.xml
  | 'csv-mynetdiary'     // MyNetDiary CSV export
  | 'csv-natural-cycles' // Natural Cycles CSV export
  | 'csv-cronometer'     // Cronometer CSV export
  | 'csv-mfp'            // MyFitnessPal CSV export
  | 'csv-bearable'       // Bearable CSV export
  | 'csv-daylio'         // Daylio CSV export
  | 'csv-generic'        // Unknown CSV -- will use intelligent column mapping
  | 'json-flo'           // Flo period tracker JSON export
  | 'json-clue'          // Clue JSON export
  | 'json-generic'       // Unknown JSON -- will use schema detection
  | 'xml-generic'        // Unknown XML
  | 'pdf-medical'        // PDF document (medical record, lab report, etc.)
  | 'image-medical'      // Photo/screenshot of medical document
  | 'text-plain'         // Plain text (portal copy-paste, clinical notes)
  | 'fit-garmin'         // Garmin .FIT file
  | 'tcx-workout'        // TCX workout file
  | 'gpx-route'          // GPX route file
  | 'unknown'            // Could not determine -- will try Claude AI

export interface FormatDetectionResult {
  format: DetectedFormat
  confidence: number       // 0-1
  mimeType: string
  fileExtension: string
  sizeBytes: number
  hints: string[]          // Human-readable hints about what was detected
}

// ── Canonical Record Types ─────────────────────────────────────────
// All parsers produce arrays of these. Each represents one piece of health data.

export type CanonicalRecordType =
  | 'lab_result'
  | 'vital_sign'
  | 'medication'
  | 'condition'
  | 'symptom'
  | 'appointment'
  | 'procedure'
  | 'allergy'
  | 'immunization'
  | 'food_entry'
  | 'cycle_entry'
  | 'mood_entry'
  | 'sleep_entry'
  | 'activity_entry'
  | 'body_measurement'
  | 'clinical_note'
  | 'timeline_event'

export interface CanonicalRecord {
  type: CanonicalRecordType
  date: string                   // ISO date YYYY-MM-DD
  datetime: string | null        // ISO datetime if available
  source: ImportSource
  confidence: number             // 0-1 extraction confidence
  data: CanonicalRecordData
  rawText: string | null         // Original text if from OCR/AI extraction
  dedupeKey: string              // For deduplication: type + date + key fields hash
}

export interface ImportSource {
  format: DetectedFormat
  fileName: string | null
  appName: string | null         // "MyNetDiary", "Natural Cycles", "Epic MyChart", etc.
  importedAt: string             // ISO datetime
  parserVersion: string          // For tracking which parser version extracted this
}

// ── Specific Record Data Types ─────────────────────────────────────

export interface LabResultData {
  testName: string
  value: number | null
  valueText: string | null       // For non-numeric results like "Positive"
  unit: string | null
  referenceRangeLow: number | null
  referenceRangeHigh: number | null
  flag: 'normal' | 'low' | 'high' | 'critical' | null
  category: string | null        // CBC, Chemistry, Hormones, etc.
  orderedBy: string | null
  loincCode: string | null       // LOINC code if available from FHIR/C-CDA
}

export interface VitalSignData {
  vitalType: 'blood_pressure' | 'heart_rate' | 'temperature' | 'respiratory_rate'
    | 'spo2' | 'weight' | 'height' | 'bmi' | 'blood_glucose'
  value: number
  value2: number | null          // For BP: diastolic
  unit: string
  position: 'supine' | 'seated' | 'standing' | null
  context: string | null         // "fasting", "post-meal", "resting", etc.
}

export interface MedicationData {
  name: string
  dose: string | null
  unit: string | null
  frequency: string | null
  route: string | null
  prescriber: string | null
  startDate: string | null
  endDate: string | null
  status: 'active' | 'completed' | 'stopped' | 'unknown'
  reason: string | null
  rxcui: string | null           // RxNorm code if available
}

export interface ConditionData {
  name: string
  status: 'active' | 'resolved' | 'inactive' | 'unknown'
  onsetDate: string | null
  resolvedDate: string | null
  severity: string | null
  icdCode: string | null
  snomedCode: string | null
}

export interface SymptomData {
  name: string
  severity: number | null         // 0-10
  bodyRegion: string | null
  duration: string | null
  notes: string | null
}

export interface AppointmentData {
  doctorName: string | null
  specialty: string | null
  clinic: string | null
  reason: string | null
  notes: string | null
  followUpDate: string | null
}

export interface ProcedureData {
  name: string
  status: 'completed' | 'planned' | 'in_progress'
  performer: string | null
  location: string | null
  notes: string | null
  cptCode: string | null
}

export interface AllergyData {
  substance: string
  reaction: string | null
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening' | null
  status: 'active' | 'inactive' | 'resolved'
}

export interface ImmunizationData {
  vaccine: string
  status: 'completed' | 'not-done'
  site: string | null
  route: string | null
  lotNumber: string | null
  manufacturer: string | null
}

export interface FoodEntryData {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foods: string                   // Food description or item name
  calories: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  sugar: number | null
  sodium: number | null
  iron: number | null
  vitaminC: number | null
  triggers: string[]              // Detected food triggers
}

export interface CycleEntryData {
  cycleDay: number | null
  flow: 'none' | 'spotting' | 'light' | 'medium' | 'heavy' | null
  temperature: number | null
  cervicalMucus: string | null
  lhTest: string | null
  ovulationStatus: string | null
  fertilityColor: string | null
  notes: string | null
}

export interface MoodEntryData {
  score: number                   // 1-5
  emotions: string[]
  notes: string | null
}

export interface SleepEntryData {
  totalMinutes: number | null
  sleepScore: number | null
  deepMinutes: number | null
  remMinutes: number | null
  lightMinutes: number | null
  awakeMinutes: number | null
  efficiency: number | null       // Percentage
  hrAvg: number | null
  hrvAvg: number | null
  breathRate: number | null
  tempDeviation: number | null
}

export interface ActivityEntryData {
  activityType: string
  durationMinutes: number | null
  calories: number | null
  distance: number | null         // meters
  avgHeartRate: number | null
  steps: number | null
  intensity: 'gentle' | 'moderate' | 'vigorous' | null
}

export interface BodyMeasurementData {
  measureType: 'weight' | 'body_fat' | 'muscle_mass' | 'water_pct'
    | 'bone_mass' | 'visceral_fat' | 'waist' | 'hip' | 'chest'
  value: number
  unit: string
}

export interface ClinicalNoteData {
  title: string | null
  content: string
  author: string | null
  noteType: string | null         // "progress note", "discharge summary", etc.
}

export interface TimelineEventData {
  eventType: string
  title: string
  description: string | null
  significance: 'normal' | 'important' | 'critical'
}

// Union of all record data types
export type CanonicalRecordData =
  | LabResultData
  | VitalSignData
  | MedicationData
  | ConditionData
  | SymptomData
  | AppointmentData
  | ProcedureData
  | AllergyData
  | ImmunizationData
  | FoodEntryData
  | CycleEntryData
  | MoodEntryData
  | SleepEntryData
  | ActivityEntryData
  | BodyMeasurementData
  | ClinicalNoteData
  | TimelineEventData

// ── Parser Interface ───────────────────────────────────────────────

export interface ParseResult {
  records: CanonicalRecord[]
  warnings: string[]              // Non-fatal issues during parsing
  errors: string[]                // Fatal issues (some records may still be returned)
  metadata: {
    totalExtracted: number
    byType: Record<string, number>
    dateRange: { earliest: string; latest: string } | null
    sourceName: string | null
  }
}

export interface Parser {
  /** Formats this parser can handle */
  supportedFormats: DetectedFormat[]
  /** Parse raw content into canonical records */
  parse(content: string | Buffer, format: DetectedFormat, fileName?: string): Promise<ParseResult>
}

// ── Import Session ─────────────────────────────────────────────────

export type ImportPhase = 'detecting' | 'parsing' | 'reviewing' | 'saving' | 'complete' | 'error'

export interface ImportSession {
  id: string
  phase: ImportPhase
  format: FormatDetectionResult | null
  records: CanonicalRecord[]
  duplicateCount: number
  newCount: number
  warnings: string[]
  errors: string[]
  createdAt: string
}
