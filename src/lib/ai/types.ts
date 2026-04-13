// AI Analysis Engine - Type re-exports and analysis-specific types

export type {
  AnalysisRun,
  AnalysisFinding,
  PipelineInput,
  PipelineResult,
  InsightCategory,
  ClinicalSignificance,
  RunType,
  RunStatus,
  DiagnosticConnection,
  MedicationSafety,
  BiomarkerInsight,
  PathwayNode,
  PathwayEdge,
  ResearchPaper,
  ClinicalTrial,
  FoodCorrelation,
  FlarePrediction,
} from '@/lib/types'

// Prompt template context passed to Claude
export interface AnalysisContext {
  patientSummary: {
    age: number
    sex: string
    confirmedDiagnoses: string[]
    suspectedConditions: string[]
    medications: string[]
    supplements: string[]
    keySymptoms: { symptom: string; frequency: number; avgSeverity: string }[]
  }
  labSummary: {
    testName: string
    values: { date: string; value: number; unit: string; flag: string | null }[]
    trend: string
  }[]
  biometricSummary: {
    avgHrv: number | null
    avgRestingHr: number | null
    avgTempDeviation: number | null
    avgSleepScore: number | null
    recentTrend: string
  }
  cycleSummary: {
    avgCycleLength: number | null
    avgPeriodLength: number | null
    heavyFlowDays: number
    phaseSymptomCorrelation: Record<string, { avgPain: number; topSymptoms: string[] }>
  }
  apiEvidence: Record<string, unknown>
}

// Claude API call options
export interface AnalysisOptions {
  model?: string
  maxTokens?: number
  temperature?: number
}
