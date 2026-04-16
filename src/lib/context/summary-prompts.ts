/**
 * Layer 2: Summary Topic Definitions
 *
 * Defines 32 fine-grained micro-summary topics (DeepSeekMoE principle:
 * more small experts > fewer large ones). Each micro-summary is highly
 * specialized, enabling more precise topic matching and smaller token
 * payloads per summary.
 *
 * Each topic specifies which database tables to query,
 * how many tokens the summary may use, and which keywords
 * in a user query should trigger its inclusion.
 */

export const SUMMARY_TOPICS = {
  // ── Cardiovascular (5) ──────────────────────────────────────────
  cv_resting_hr: {
    name: 'Resting Heart Rate Trends',
    maxTokens: 800,
    dataSources: ['oura_daily'],
    keywords: ['resting hr', 'heart rate', 'bradycardia', 'rhr'],
  },
  cv_orthostatic: {
    name: 'Orthostatic Vital Signs',
    maxTokens: 800,
    dataSources: ['oura_daily', 'daily_logs', 'symptoms'],
    keywords: ['standing', 'orthostatic', 'pots', 'tilt', 'positional'],
  },
  cv_hrv_patterns: {
    name: 'HRV Patterns by Cycle Phase',
    maxTokens: 800,
    dataSources: ['oura_daily', 'cycle_entries'],
    keywords: ['hrv', 'heart rate variability', 'autonomic', 'vagal'],
  },
  cv_palpitations: {
    name: 'Palpitation and Tachycardia Episodes',
    maxTokens: 800,
    dataSources: ['symptoms', 'daily_logs'],
    keywords: ['palpitation', 'tachycardia', 'racing heart', 'flutter'],
  },
  cv_exercise_tolerance: {
    name: 'Exercise Tolerance and Activity',
    maxTokens: 800,
    dataSources: ['oura_daily'],
    keywords: ['exercise', 'activity', 'exertion', 'stairs', 'walking'],
  },

  // ── Endocrine (4) ──────────────────────────────────────────────
  endo_thyroid: {
    name: 'Thyroid Function Trajectory',
    maxTokens: 1000,
    dataSources: ['lab_results'],
    keywords: ['thyroid', 'tsh', 't4', 't3', 'hashimoto', 'hypothyroid'],
  },
  endo_cycle_patterns: {
    name: 'Cycle Length and Regularity',
    maxTokens: 800,
    dataSources: ['cycle_entries', 'nc_imported'],
    keywords: ['cycle', 'period', 'menstrual', 'luteal', 'follicular', 'ovulation'],
  },
  endo_hormonal_symptoms: {
    name: 'Hormonal Symptom Correlation',
    maxTokens: 800,
    dataSources: ['symptoms', 'cycle_entries'],
    keywords: ['hormonal', 'pms', 'mood', 'cramp', 'breast'],
  },
  endo_temperature: {
    name: 'Basal Temperature and Metabolic Patterns',
    maxTokens: 800,
    dataSources: ['oura_daily', 'nc_imported'],
    keywords: ['temperature', 'basal', 'metabolic', 'bbt'],
  },

  // ── Neurological (3) ───────────────────────────────────────────
  neuro_presyncope: {
    name: 'Presyncope and Syncope Episodes',
    maxTokens: 800,
    dataSources: ['symptoms', 'daily_logs'],
    keywords: ['presyncope', 'syncope', 'faint', 'blackout', 'vision'],
  },
  neuro_headache: {
    name: 'Headache Patterns and Triggers',
    maxTokens: 800,
    dataSources: ['symptoms', 'daily_logs', 'food_entries'],
    keywords: ['headache', 'migraine', 'head pain', 'frontal'],
  },
  neuro_cognitive: {
    name: 'Cognitive Symptoms (Brain Fog)',
    maxTokens: 800,
    dataSources: ['daily_logs', 'symptoms'],
    keywords: ['brain fog', 'cognitive', 'concentration', 'memory', 'confusion'],
  },

  // ── GI/Digestive (3) ───────────────────────────────────────────
  gi_food_triggers: {
    name: 'Food Trigger Patterns',
    maxTokens: 800,
    dataSources: ['food_entries', 'symptoms'],
    keywords: ['trigger', 'food', 'gluten', 'dairy', 'reaction', 'intolerance'],
  },
  gi_bowel_patterns: {
    name: 'Bowel and Digestive Symptoms',
    maxTokens: 800,
    dataSources: ['symptoms', 'daily_logs'],
    keywords: ['bowel', 'digestive', 'ibs', 'constipation', 'diarrhea', 'bloating'],
  },
  gi_nausea: {
    name: 'Nausea and Upper GI Symptoms',
    maxTokens: 800,
    dataSources: ['symptoms', 'daily_logs'],
    keywords: ['nausea', 'vomiting', 'stomach', 'gastro', 'reflux', 'acid'],
  },

  // ── Metabolic/Labs (4) ─────────────────────────────────────────
  lab_cbc_trends: {
    name: 'Complete Blood Count Trends',
    maxTokens: 800,
    dataSources: ['lab_results'],
    keywords: ['cbc', 'hemoglobin', 'hematocrit', 'wbc', 'platelets', 'mch'],
  },
  lab_iron_ferritin: {
    name: 'Iron and Ferritin Trajectory',
    maxTokens: 1000,
    dataSources: ['lab_results'],
    keywords: ['iron', 'ferritin', 'tibc', 'transferrin', 'anemia'],
  },
  lab_lipids: {
    name: 'Lipid Panel and Cholesterol',
    maxTokens: 800,
    dataSources: ['lab_results'],
    keywords: ['cholesterol', 'ldl', 'hdl', 'triglycerides', 'lipid', 'statin'],
  },
  lab_inflammatory: {
    name: 'Inflammatory Markers',
    maxTokens: 800,
    dataSources: ['lab_results'],
    keywords: ['crp', 'esr', 'inflammation', 'hs-crp', 'sed rate'],
  },

  // ── Reproductive (3) ───────────────────────────────────────────
  repro_flow: {
    name: 'Menstrual Flow and Regularity',
    maxTokens: 800,
    dataSources: ['cycle_entries', 'nc_imported'],
    keywords: ['flow', 'menstruation', 'heavy', 'clot', 'menorrhagia'],
  },
  repro_fertility: {
    name: 'Fertility Markers and Ovulation',
    maxTokens: 800,
    dataSources: ['nc_imported', 'cycle_entries'],
    keywords: ['fertility', 'ovulation', 'cervical mucus', 'lh', 'opk'],
  },
  repro_endo_symptoms: {
    name: 'Endometriosis Symptom Tracking',
    maxTokens: 800,
    dataSources: ['symptoms', 'daily_logs'],
    keywords: ['endo', 'endometriosis', 'pelvic', 'pain', 'adhesion'],
  },

  // ── Sleep and Recovery (3) ─────────────────────────────────────
  sleep_quality: {
    name: 'Sleep Quality and Duration',
    maxTokens: 800,
    dataSources: ['oura_daily'],
    keywords: ['sleep', 'insomnia', 'wake', 'rem', 'deep sleep'],
  },
  sleep_readiness: {
    name: 'Readiness and Recovery Patterns',
    maxTokens: 800,
    dataSources: ['oura_daily'],
    keywords: ['readiness', 'recovery', 'stress', 'rest'],
  },
  sleep_spo2: {
    name: 'SpO2 and Respiratory Patterns',
    maxTokens: 600,
    dataSources: ['oura_daily'],
    keywords: ['spo2', 'oxygen', 'breathing', 'respiratory', 'apnea'],
  },

  // ── Medications (2) ────────────────────────────────────────────
  med_current_regimen: {
    name: 'Current Medication and Supplement Regimen',
    maxTokens: 600,
    dataSources: ['health_profile'],
    keywords: ['medication', 'supplement', 'drug', 'dose', 'prescription'],
  },
  med_effects: {
    name: 'Medication Effects and Interactions',
    maxTokens: 600,
    dataSources: ['health_profile', 'symptoms'],
    keywords: ['side effect', 'interaction', 'reaction', 'tolerance'],
  },

  // ── Imaging (1) ────────────────────────────────────────────────
  imaging_findings: {
    name: 'Imaging Studies and Findings',
    maxTokens: 800,
    dataSources: ['imaging_studies'],
    keywords: ['ct', 'mri', 'x-ray', 'imaging', 'scan', 'radiology', 'dicom', 'ultrasound'],
  },

  // ── Cross-System (2) ───────────────────────────────────────────
  correlation_findings: {
    name: 'Correlation Findings',
    maxTokens: 1000,
    dataSources: ['correlation_results'],
    keywords: ['correlation', 'pattern', 'predict', 'flare', 'trigger', 'cause', 'factor'],
  },
  last_90_days: {
    name: 'Last 90 Days Overview',
    maxTokens: 1500,
    dataSources: ['daily_logs', 'oura_daily', 'symptoms', 'lab_results', 'cycle_entries'],
    keywords: [] as string[], // Always included as baseline
  },

  // ── General (2) ────────────────────────────────────────────────
  weight_body: {
    name: 'Weight and Body Composition',
    maxTokens: 600,
    dataSources: ['daily_logs', 'oura_daily'],
    keywords: ['weight', 'bmi', 'body'],
  },
  activity_patterns: {
    name: 'Activity and Exercise Patterns',
    maxTokens: 600,
    dataSources: ['oura_daily'],
    keywords: ['activity', 'steps', 'exercise', 'movement', 'calories'],
  },
} as const

export type SummaryTopic = keyof typeof SUMMARY_TOPICS
