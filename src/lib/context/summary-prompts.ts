/**
 * Layer 2: Summary Topic Definitions
 *
 * Defines the 12 pre-computed clinical summary topics.
 * Each topic specifies which database tables to query,
 * how many tokens the summary may use, and which keywords
 * in a user query should trigger its inclusion.
 */

export const SUMMARY_TOPICS = {
  last_90_days: {
    name: 'Last 90 Days Overview',
    maxTokens: 2000,
    dataSources: ['daily_logs', 'oura_daily', 'symptoms', 'lab_results', 'cycle_entries'],
    keywords: [] as string[], // Always included as baseline
  },
  gi_digestive: {
    name: 'GI/Digestive System',
    maxTokens: 1500,
    dataSources: ['symptoms', 'food_entries', 'daily_logs'],
    keywords: ['nausea', 'bloating', 'bowel', 'digestive', 'ibs', 'gastro', 'stomach', 'cramp'],
  },
  neurological: {
    name: 'Neurological',
    maxTokens: 1500,
    dataSources: ['symptoms', 'daily_logs', 'oura_daily'],
    keywords: ['dizzy', 'headache', 'vertigo', 'presyncope', 'syncope', 'migraine', 'neuro'],
  },
  cardiovascular: {
    name: 'Cardiovascular',
    maxTokens: 1500,
    dataSources: ['oura_daily', 'symptoms', 'daily_logs'],
    keywords: ['heart', 'hr', 'hrv', 'tachycardia', 'syncope', 'palpitation', 'pots', 'cardio'],
  },
  reproductive: {
    name: 'Reproductive',
    maxTokens: 1500,
    dataSources: ['cycle_entries', 'nc_imported', 'symptoms'],
    keywords: ['period', 'cycle', 'menstrual', 'flow', 'ovulation', 'endo', 'pelvic'],
  },
  lab_trajectories: {
    name: 'Lab Trajectories',
    maxTokens: 2000,
    dataSources: ['lab_results'],
    keywords: ['lab', 'ferritin', 'iron', 'cbc', 'crp', 'vitamin', 'cholesterol', 'blood'],
  },
  cycle_patterns: {
    name: 'Cycle Patterns',
    maxTokens: 1500,
    dataSources: ['cycle_entries', 'nc_imported'],
    keywords: ['cycle', 'phase', 'luteal', 'follicular', 'ovulation', 'fertility'],
  },
  food_correlations: {
    name: 'Food Correlations',
    maxTokens: 1500,
    dataSources: ['food_entries'],
    keywords: ['food', 'trigger', 'gluten', 'dairy', 'diet', 'meal', 'nutrition', 'eat'],
  },
  biometric_baselines: {
    name: 'Biometric Baselines',
    maxTokens: 1000,
    dataSources: ['oura_daily'],
    keywords: ['hrv', 'sleep', 'readiness', 'temperature', 'stress', 'spo2', 'biometric', 'oura'],
  },
  correlation_findings: {
    name: 'Correlation Findings',
    maxTokens: 2000,
    dataSources: ['correlation_results'],
    keywords: ['correlation', 'pattern', 'predict', 'flare', 'trigger', 'cause', 'factor'],
  },
  medication_log: {
    name: 'Medication/Supplement Log',
    maxTokens: 500,
    dataSources: ['health_profile'],
    keywords: ['medication', 'supplement', 'drug', 'dose', 'prescription', 'vitamin', 'iron'],
  },
  imaging_summary: {
    name: 'Imaging Summary',
    maxTokens: 1000,
    dataSources: ['imaging_studies'],
    keywords: ['ct', 'mri', 'x-ray', 'imaging', 'scan', 'radiology', 'dicom'],
  },
} as const

export type SummaryTopic = keyof typeof SUMMARY_TOPICS
