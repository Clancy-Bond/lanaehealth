// LanaeHealth - TypeScript type definitions for all database tables

// ── Enums ────────────────────────────────────────────────────────────

export type PainType =
  | 'aching' | 'agonising' | 'burning' | 'constant' | 'cramping'
  | 'crippling' | 'debilitating' | 'dragging' | 'erratic' | 'excruciating'
  | 'nauseating' | 'numb' | 'piercing' | 'pounding' | 'pressure'
  | 'pulsating' | 'radiating' | 'relentless' | 'sharp' | 'shooting'
  | 'sore' | 'spasm' | 'stabbing' | 'tender' | 'throbbing' | 'unbearable'
export type Severity = 'mild' | 'moderate' | 'severe'
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'
export type FlowLevel = 'none' | 'spotting' | 'light' | 'medium' | 'heavy'
export type SymptomCategory = 'digestive' | 'menstrual' | 'mental' | 'physical' | 'urinary'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type LabFlag = 'normal' | 'low' | 'high' | 'critical'
export type ImagingModality = 'CT' | 'XR' | 'MRI' | 'US' | 'EKG'
export type TimelineEventType = 'diagnosis' | 'symptom_onset' | 'test' | 'medication_change' | 'appointment' | 'imaging' | 'hospitalization'
export type EventSignificance = 'normal' | 'important' | 'critical'
// Energy mode scales the /log page density to the user's capacity that day.
// See src/lib/intelligence/energy-inference.ts for inference, and
// docs/plans/2026-04-16-non-shaming-voice-rule.md for voice constraints.
export type EnergyMode = 'minimal' | 'gentle' | 'full'

// ── Core Data Tables ─────────────────────────────────────────────────

// daily_logs: hub table, one row per day
export interface DailyLog {
  id: string
  date: string // ISO date string YYYY-MM-DD
  overall_pain: number | null // 0-10
  fatigue: number | null // 0-10
  bloating: number | null // 0-10
  stress: number | null // 0-10
  sleep_quality: number | null // 0-10
  cycle_phase: CyclePhase | null
  notes: string | null
  daily_impact: string | null
  what_helped: string | null
  triggers: string | null
  // Migration 020 (2026-04-17): Finch-inspired energy-adaptive goal scaling
  // and rest-day action. See docs/competitive/finch/implementation-notes.md.
  // rest_day=true means the user explicitly logged a rest day (a positive
  // log, not a null log). Adherence / completeness metrics MUST exclude
  // rest_day=true rows from denominators per the non-shaming-voice rule.
  energy_mode?: EnergyMode | null
  rest_day?: boolean | null
  created_at: string
  updated_at: string
}

// pain_points: body map pins, many per log
export interface PainPoint {
  id: string
  log_id: string
  x: number
  y: number
  body_region: string
  intensity: number // 1-10
  pain_type: PainType | null
  duration_minutes: number | null
  logged_at: string
}

// symptoms: categorized symptom entries, many per log
export interface Symptom {
  id: string
  log_id: string
  category: SymptomCategory
  symptom: string
  severity: Severity | null
  logged_at: string
}

// cycle_entries: period and cycle tracking
export type ClotSize = 'small' | 'medium' | 'large' | 'very_large'

export interface CycleEntry {
  id: string
  date: string
  flow_level: FlowLevel | null
  menstruation: boolean
  ovulation_signs: string | null
  lh_test_result: string | null
  cervical_mucus_consistency: string | null
  cervical_mucus_quantity: string | null
  // Endometriosis mode (migration 011) - only surfaced when user has endo in conditions
  bowel_symptoms: string[] | null
  bladder_symptoms: string[] | null
  dyspareunia: boolean | null
  dyspareunia_intensity: number | null
  clots_present: boolean | null
  clot_size: ClotSize | null
  clot_count: number | null
  endo_notes: string | null
  created_at: string
}

// food_entries: meals and trigger flagging
export interface FoodEntry {
  id: string
  log_id: string
  meal_type: MealType | null
  food_items: string | null
  calories: number | null
  macros: Record<string, number>
  flagged_triggers: string[]
  logged_at: string
}

// oura_daily: auto-synced biometrics from Oura Ring
export interface OuraDaily {
  id: string
  date: string
  sleep_score: number | null
  sleep_duration: number | null // seconds
  deep_sleep_min: number | null
  rem_sleep_min: number | null
  hrv_avg: number | null
  hrv_max: number | null
  resting_hr: number | null
  body_temp_deviation: number | null // degrees C from baseline
  spo2_avg: number | null
  stress_score: number | null
  readiness_score: number | null
  respiratory_rate: number | null
  raw_json: Record<string, unknown>
  synced_at: string
}

// lab_results: structured bloodwork values
export interface LabResult {
  id: string
  date: string
  category: string
  test_name: string
  value: number | null
  unit: string | null
  reference_range_low: number | null
  reference_range_high: number | null
  flag: LabFlag | null
  source_document_id: string | null
  created_at: string
}

// appointments: doctor visits
export interface Appointment {
  id: string
  date: string
  doctor_name: string | null
  specialty: string | null
  clinic: string | null
  reason: string | null
  notes: string | null
  action_items: string | null
  follow_up_date: string | null
  created_at: string
}

// documents: uploaded files
export interface Document {
  id: string
  appointment_id: string | null
  file_name: string
  file_path: string
  file_type: string | null
  uploaded_at: string
  parsed: boolean
  parsed_data: Record<string, unknown>
}

// imaging_studies: radiology metadata
export interface ImagingStudy {
  id: string
  study_date: string
  modality: ImagingModality
  body_part: string
  indication: string | null
  findings_summary: string | null
  raw_data_path: string | null
  report_text: string | null
  created_at: string
}

// medical_timeline: key medical events
export interface MedicalTimelineEvent {
  id: string
  event_date: string
  event_type: TimelineEventType
  title: string
  description: string | null
  significance: EventSignificance
  linked_data: Record<string, unknown> | null
  created_at: string
}

// nc_imported: Natural Cycles historical data
export interface NcImported {
  id: string
  date: string
  temperature: number | null
  menstruation: string | null
  flow_quantity: string | null
  cervical_mucus_consistency: string | null
  cervical_mucus_quantity: string | null
  mood_flags: string | null
  lh_test: string | null
  cycle_day: number | null
  cycle_number: number | null
  fertility_color: string | null
  ovulation_status: string | null
  data_flags: string | null
  imported_at: string
}

// oura_tokens: OAuth token storage
export interface OuraToken {
  id: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  scopes: string | null
  created_at: string
  updated_at: string
}

// ── Helper Types (form inputs without id/timestamps) ─────────────────

export type DailyLogInput = Partial<Omit<DailyLog, 'id' | 'created_at' | 'updated_at'>> & { date: string }
export type PainPointInput = Omit<PainPoint, 'id' | 'logged_at'>
export type SymptomInput = Omit<Symptom, 'id' | 'logged_at'>
export type CycleEntryInput = Omit<CycleEntry, 'id' | 'created_at'>
export type FoodEntryInput = Omit<FoodEntry, 'id' | 'logged_at'>

// ── AI Medical Diagnostic Pipeline Types ─────────────────────────────

export type TermType = 'symptom' | 'condition' | 'lab' | 'drug' | 'gene'
export type RunType = 'full' | 'diagnostic' | 'biomarker' | 'pathway' | 'food' | 'flare'
export type RunStatus = 'pending' | 'running' | 'complete' | 'failed'
export type InsightCategory = 'diagnostic' | 'medication' | 'biomarker' | 'pathway' | 'research' | 'trial' | 'food' | 'flare'
export type ClinicalSignificance = 'low' | 'moderate' | 'high' | 'critical'
export type InsightTab = InsightCategory

// medical_identifiers table: maps terms to standard medical IDs
export interface MedicalIdentifier {
  id: string
  term: string
  term_type: TermType
  umls_cui: string | null
  hpo_id: string | null
  mondo_id: string | null
  icd11_code: string | null
  rxcui: string | null
  loinc_code: string | null
  ncbi_gene_id: string | null
  uniprot_id: string | null
  efo_id: string | null
  resolved_at: string
}

// api_cache table
export interface ApiCacheEntry {
  id: string
  api_name: string
  cache_key: string
  response_json: Record<string, unknown>
  cached_at: string
  expires_at: string
}

// analysis_runs table
export interface AnalysisRun {
  id: string
  run_type: RunType
  status: RunStatus
  input_hash: string
  started_at: string
  completed_at: string | null
  error_message: string | null
  metadata: Record<string, unknown>
}

// analysis_findings table
export interface AnalysisFinding {
  id: string
  run_id: string
  category: InsightCategory
  title: string
  summary: string
  evidence_json: Record<string, unknown>
  confidence: number // 0.0-1.0
  clinical_significance: ClinicalSignificance
  created_at: string
}

// gene_disease_network table
export interface GeneDiseaseLink {
  id: string
  gene_symbol: string
  ncbi_gene_id: string | null
  disease_term: string
  mondo_id: string | null
  association_score: number | null
  source: 'disgenet' | 'opentargets' | 'ctd' | 'endometdb' | 'string'
  pathways: string[] // KEGG/Reactome IDs
  evidence_json: Record<string, unknown>
  cached_at: string
}

// food_nutrient_cache table
export interface FoodNutrientEntry {
  id: string
  food_term: string
  fdc_id: string | null
  nutrients: {
    iron_mg?: number
    vitamin_c_mg?: number
    calcium_mg?: number
    fiber_g?: number
    calories?: number
    [key: string]: number | undefined
  }
  nova_score: number | null
  cached_at: string
}

// Pipeline input: extends report data with medical context
export interface PipelineInput {
  dailyLogs: DailyLog[]
  symptoms: (Symptom & { log_id: string })[]
  painPoints: (PainPoint & { log_id: string })[]
  ouraData: OuraDaily[]
  cycleEntries: CycleEntry[]
  labResults: LabResult[]
  appointments: Appointment[]
  foodEntries: (FoodEntry & { date: string })[]
  healthProfile: Record<string, unknown>
  medicalIdentifiers: MedicalIdentifier[]
}

// Pipeline result: findings grouped by category
export interface PipelineResult {
  runId: string
  status: RunStatus
  findings: AnalysisFinding[]
  findingsByCategory: Record<InsightCategory, AnalysisFinding[]>
  metadata: {
    apiCallCount: number
    cacheHitRate: number
    processingTimeMs: number
    errors: string[]
  }
}

// ── UI-specific types for the Insights page ──────────────────────────

export interface DiagnosticConnection {
  conditionName: string
  infermedicaProbability: number | null
  hpoMatchScore: number | null
  monarchScore: number | null
  supportingSymptoms: { symptom: string; umlsCui: string | null }[]
  geneAssociations: { gene: string; score: number; source: string }[]
  evidenceSources: string[]
}

export interface MedicationSafety {
  drugName: string
  rxcui: string | null
  interactions: { otherDrug: string; severity: string; description: string }[]
  adverseEvents: { reaction: string; count: number }[]
  targets: { targetName: string; mechanism: string }[]
}

export interface BiomarkerInsight {
  testName: string
  loincCode: string | null
  values: { date: string; value: number; flag: LabFlag | null }[]
  trend: 'improving' | 'worsening' | 'stable' | 'fluctuating'
  clinicalInterpretation: string
  connectedConditions: { condition: string; relationship: string }[]
}

export interface PathwayNode {
  id: string
  label: string
  type: 'gene' | 'protein' | 'pathway' | 'condition' | 'biomarker' | 'symptom'
  data: Record<string, unknown>
}

export interface PathwayEdge {
  source: string
  target: string
  relationship: string
  score: number | null
  source_api: string
}

export interface ResearchPaper {
  pmid: string
  title: string
  authors: string[]
  journal: string
  year: number
  abstractSnippet: string
  relevanceScore: number
  keyFinding: string
  url: string
}

export interface ClinicalTrial {
  nctId: string
  title: string
  status: string
  conditions: string[]
  eligibilitySummary: string
  locations: { facility: string; city: string; state: string; country: string }[]
  isNearHawaii: boolean
  url: string
}

export interface FoodCorrelation {
  foodItem: string
  nutrients: FoodNutrientEntry['nutrients']
  novaScore: number | null
  ironImpact: 'enhancer' | 'inhibitor' | 'neutral'
  symptomCorrelation: { symptom: string; correlationScore: number; lagDays: number }[]
  frequency: number // times logged
}

export interface FlarePrediction {
  date: string
  probability: number // 0-1
  precursorSignals: {
    metric: string
    currentValue: number
    baselineValue: number
    deviationPercent: number
  }[]
  cyclePhase: CyclePhase | null
  riskLevel: 'low' | 'moderate' | 'high'
}

// ── Context Engine Types ─────────────────────────────────────────────

export interface ContextSummary {
  id: string
  topic: string
  content: string
  generated_at: string
  data_range_start: string
  data_range_end: string
  token_count: number
  version: number
}

export interface SessionHandoff {
  id: string
  session_type: string
  what_accomplished: string
  what_discovered: string
  what_left_undone: string
  next_session_needs: string
  user_messages_verbatim: string[]
  created_at: string
}

export interface PermanentCore {
  patient: {
    name: string
    age: number
    sex: string
    blood_type: string
    height_cm: number
    weight_kg: number
    location: string
  }
  confirmed_diagnoses: string[]
  suspected_conditions: string[]
  current_medications: string[]
  supplements: string[]
  allergies: string[]
  family_history: string[]
  active_problems: Array<{
    problem: string
    status: string
    onset: string
    latest_data: string
  }>
  key_events: Array<{
    date: string
    event: string
    significance: string
  }>
  data_availability: {
    oura_days: number
    nc_days: number
    food_entries: number
    lab_results: number
    imaging_studies: number
  }
}

export interface CompactedHistory {
  primary_request: string
  key_concepts: string
  files_and_data: string
  errors_and_fixes: string
  approaches_tried: string
  user_messages_verbatim: string[]
  pending_tasks: string
  current_state: string
  next_steps: string
}

// ── Bearable-Killer: New Types ──────────────────────────────────────

// Mood tracking
export type MoodScore = 1 | 2 | 3 | 4 | 5
export type EmotionTag =
  | 'happy' | 'calm' | 'anxious' | 'irritable' | 'sad'
  | 'energetic' | 'grateful' | 'hopeful' | 'frustrated'
  | 'overwhelmed' | 'peaceful' | 'numb' | 'foggy'
  | 'restless' | 'content' | 'tearful' | 'motivated'

export interface MoodEntry {
  id: string
  log_id: string
  mood_score: MoodScore
  emotions: EmotionTag[]
  logged_at: string
}

export type MoodEntryInput = Omit<MoodEntry, 'id' | 'logged_at'>

// Custom trackable factors
export type TrackableInputType = 'toggle' | 'scale_5' | 'scale_10' | 'number' | 'text'
export type TrackableCategory = 'symptom' | 'factor' | 'activity' | 'supplement' | 'other'

export interface CustomTrackable {
  id: string
  name: string
  category: TrackableCategory
  input_type: TrackableInputType
  icon: string | null
  display_order: number
  is_active: boolean
  created_at: string
}

export type CustomTrackableInput = Omit<CustomTrackable, 'id' | 'created_at'>

export interface CustomTrackableEntry {
  id: string
  log_id: string
  trackable_id: string
  value: number | null
  text_value: string | null
  toggled: boolean | null
  logged_at: string
}

export type CustomTrackableEntryInput = Omit<CustomTrackableEntry, 'id' | 'logged_at'>

// Sleep detail tracking
export interface SleepWakeEpisode {
  time: string
  duration_min: number
}

export interface SleepNap {
  start: string
  duration_min: number
}

export type SleepQualityFactor =
  | 'nightmares' | 'restless' | 'snoring' | 'hot' | 'cold'
  | 'noise' | 'pain' | 'anxiety' | 'bathroom' | 'partner'

export interface SleepDetail {
  id: string
  log_id: string
  bedtime: string | null
  wake_time: string | null
  sleep_latency_min: number | null
  wake_episodes: SleepWakeEpisode[]
  sleep_quality_factors: SleepQualityFactor[]
  naps: SleepNap[]
  created_at: string
}

export type SleepDetailInput = Omit<SleepDetail, 'id' | 'created_at'>

// Gratitude and positive logging
export type GratitudeType = 'gratitude' | 'win' | 'positive'

export interface GratitudeEntry {
  id: string
  log_id: string
  content: string
  entry_type: GratitudeType
  logged_at: string
}

export type GratitudeEntryInput = Omit<GratitudeEntry, 'id' | 'logged_at'>

// Time-of-day logging periods
export type LogPeriod = 'morning' | 'afternoon' | 'evening' | 'full_day'

// Clinical scales (PHQ-9, GAD-7, HIT-6, MIDAS)
export type ClinicalScaleType = 'PHQ-9' | 'GAD-7' | 'HIT-6' | 'MIDAS' | 'PROMIS-Pain' | 'PROMIS-Fatigue'
// Severity union widened to include MIDAS disability grades (grade_1 minimal .. grade_4 severe).
// Existing consumers (PHQ-9, GAD-7) keep using minimal/mild/moderate/moderately_severe/severe.
export type ScaleSeverity =
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'moderately_severe'
  | 'severe'
  | 'grade_1'
  | 'grade_2'
  | 'grade_3'
  | 'grade_4'

export interface ClinicalScaleResponse {
  id: string
  scale_type: ClinicalScaleType
  date: string
  responses: number[]
  total_score: number
  severity: ScaleSeverity
  created_at: string
}

export type ClinicalScaleResponseInput = Omit<ClinicalScaleResponse, 'id' | 'created_at'>

// Weather daily data
export interface WeatherDaily {
  id: string
  date: string
  barometric_pressure_hpa: number | null
  temperature_c: number | null
  humidity_pct: number | null
  weather_code: string | null
  description: string | null
  fetched_at: string
}

// Medication reminders
export interface MedicationReminder {
  id: string
  medication_name: string
  reminder_times: string[] // HH:MM strings
  days_of_week: number[] | null // 0=Sun..6=Sat, null=daily
  is_active: boolean
  created_at: string
}

export type MedicationReminderInput = Omit<MedicationReminder, 'id' | 'created_at'>

// Onboarding
export interface UserOnboarding {
  id: string
  conditions: string[]
  tracking_goals: string[]
  onboarding_step: number
  completed_at: string | null
  log_section_order: string[]
  hidden_sections: string[]
  created_at: string
}

// Medical expenses (FSA/HSA receipts)
// See src/lib/migrations/026_medical_expenses.sql for schema.
export type MedicalExpenseCategory =
  | 'office_visit'
  | 'prescription'
  | 'lab_imaging'
  | 'device'
  | 'subscription'
  | 'supplement'
  | 'therapy'
  | 'dental_vision'
  | 'travel_medical'
  | 'other'

export interface MedicalExpense {
  id: string
  service_date: string            // YYYY-MM-DD
  provider_or_vendor: string
  description: string
  amount_cents: number            // integer cents, USD
  category: MedicalExpenseCategory
  letter_of_medical_necessity: boolean
  receipt_url: string | null
  notes: string | null
  appointment_id: string | null
  claimed: boolean
  claimed_at: string | null
  plan_year: number | null
  created_at: string
  updated_at: string
}

export type MedicalExpenseInput = Omit<
  MedicalExpense,
  'id' | 'created_at' | 'updated_at'
>

