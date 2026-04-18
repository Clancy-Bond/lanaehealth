// ---------------------------------------------------------------------------
// Clinical Intelligence Engine -- core types and deterministic scoring
// ---------------------------------------------------------------------------

// ===========================================================================
// Data reliability weights by source table
// ===========================================================================

export const DATA_RELIABILITY: Record<string, number> = {
  lab_results: 1.0,
  imaging_studies: 1.0,
  medical_timeline: 1.0,
  health_profile: 1.0,
  oura_daily: 0.7,
  correlation_results: 0.8,
  daily_logs: 0.6,
  symptoms: 0.6,
  cycle_entries: 0.6,
  nc_imported: 0.6,
  food_entries: 0.5,
}

// ===========================================================================
// Time decay (Ebbinghaus forgetting curve)
// ===========================================================================

/**
 * Compute time-based decay for evidence freshness.
 *
 * Uses the Ebbinghaus forgetting curve: max(0.3, e^(-0.01 * daysOld)).
 * The floor of 0.3 ensures very old data still carries some weight.
 *
 * If `isAnchored` is true the finding is a confirmed diagnosis and never
 * decays -- returns 1.0 regardless of age.
 */
export function computeTimeDecay(daysOld: number, isAnchored?: boolean): number {
  if (isAnchored) return 1.0
  return Math.max(0.3, Math.exp(-0.01 * daysOld))
}

// ===========================================================================
// Confidence categories
// ===========================================================================

export type ConfidenceCategory =
  | 'ESTABLISHED'
  | 'PROBABLE'
  | 'POSSIBLE'
  | 'SPECULATIVE'
  | 'INSUFFICIENT'

/**
 * Map a numeric confidence score (0-100) to a clinical confidence category.
 */
export function getConfidenceCategory(score: number): ConfidenceCategory {
  if (score >= 80) return 'ESTABLISHED'
  if (score >= 60) return 'PROBABLE'
  if (score >= 40) return 'POSSIBLE'
  if (score >= 20) return 'SPECULATIVE'
  return 'INSUFFICIENT'
}

// ===========================================================================
// Evidence
// ===========================================================================

export interface EvidenceItem {
  finding: string
  source_table: string
  /** YYYY-MM-DD */
  source_date: string
  source_reliability: number
  supports: boolean
  clinical_weight: number
  fdr_corrected: boolean
  meets_criteria_rule: boolean
  is_anchored: boolean
}

// ===========================================================================
// Hypothesis scoring
// ===========================================================================

/** Upper score bound when a hypothesis lacks any objectively confirmed
 *  criterion-meeting evidence. Stays below the ESTABLISHED threshold (80)
 *  and inside PROBABLE (60-79). Clinical rationale: without imaging,
 *  histology, or a criterion-level lab value, ESTABLISHED over-states
 *  what the data can support. See the "Challenger Assessment" in any
 *  `hypothesis_tracker` KB doc for a worked example of why this cap
 *  matters (N92.0 symptom code being conflated with N80.x endometriosis
 *  diagnosis was the motivating failure). */
export const UNCONFIRMED_HYPOTHESIS_SCORE_CAP = 70

/**
 * Compute a deterministic hypothesis confidence score (0-100).
 *
 * Per-item weight =
 *   clinical_weight
 *   * source_reliability
 *   * timeDecay(daysOld, isAnchored)
 *   * (fdr_corrected ? 1.0 : 0.5)
 *   * (meets_criteria_rule ? 1.5 : 1.0)
 *
 * Raw score = sum(supporting weights) - sum(contradicting weights)
 * Normalized = 50 + (raw / maxPossible) * 50
 *   where maxPossible = supportSum + contradictSum (min 1)
 *
 * Confirmation gate: if NO supporting evidence has
 * meets_criteria_rule=true AND is_anchored=true, the score is capped
 * at UNCONFIRMED_HYPOTHESIS_SCORE_CAP so ESTABLISHED (>=80) is
 * unreachable without an objective confirmatory item. This keeps the
 * category boundary honest when the engine is working from symptoms
 * or clinical suspicion alone.
 *
 * Result is clamped to [0, 100] and rounded to integer.
 */
export function computeHypothesisScore(
  supporting: EvidenceItem[],
  contradicting: EvidenceItem[],
): number {
  const weight = (item: EvidenceItem): number => {
    const daysSinceSource = daysBetween(item.source_date)
    const decay = computeTimeDecay(daysSinceSource, item.is_anchored)
    const fdrFactor = item.fdr_corrected ? 1.0 : 0.5
    const criteriaFactor = item.meets_criteria_rule ? 1.5 : 1.0
    return item.clinical_weight * item.source_reliability * decay * fdrFactor * criteriaFactor
  }

  const supportSum = supporting.reduce((acc, e) => acc + weight(e), 0)
  const contradictSum = contradicting.reduce((acc, e) => acc + weight(e), 0)

  const raw = supportSum - contradictSum
  const maxPossible = Math.max(supportSum + contradictSum, 1)
  const normalized = 50 + (raw / maxPossible) * 50

  const hasConfirmatoryEvidence = supporting.some(
    (e) => e.meets_criteria_rule && e.is_anchored,
  )
  const preCap = Math.min(100, Math.max(0, normalized))
  const capped = hasConfirmatoryEvidence
    ? preCap
    : Math.min(preCap, UNCONFIRMED_HYPOTHESIS_SCORE_CAP)

  return Math.round(capped)
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr + 'T00:00:00Z')
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

// ===========================================================================
// Knowledge-base document types
// ===========================================================================

export type KBDocumentType =
  | 'chronicle'
  | 'micro_summary'
  | 'ifm_review'
  | 'hypothesis'
  | 'connection'
  | 'research'
  | 'completeness'
  | 'next_action'
  | 'conversation'
  | 'doctor_brief'
  | 'criteria_rules'

export interface KBDocument {
  id?: string
  document_id: string
  document_type: KBDocumentType
  title: string
  content: string
  version: number
  generated_at: string
  generated_by: string
  metadata: Record<string, unknown>
  covers_date_start: string | null
  covers_date_end: string | null
  token_count: number
  is_stale: boolean
}

// ===========================================================================
// Hypothesis record
// ===========================================================================

export interface HypothesisRecord {
  hypothesis_id: string
  name: string
  description: string
  score: number
  confidence: ConfidenceCategory
  direction: 'rising' | 'stable' | 'falling'
  systems_affected: string[]
  supporting_evidence: EvidenceItem[]
  contradicting_evidence: EvidenceItem[]
  challenger_notes: string | null
  last_evaluated: string
  what_would_change: string[]
  alternative_explanations: string[]
}

// ===========================================================================
// Validation flags
// ===========================================================================

export interface ValidationFlag {
  source_table: string
  source_id?: string
  source_date: string
  flag_type: 'out_of_range' | 'sudden_jump' | 'impossible_value' | 'missing_data'
  field_name: string
  original_value: unknown
  expected_range: string
  severity: 'warning' | 'error'
}

// ===========================================================================
// IFM (Institute for Functional Medicine) nodes
// ===========================================================================

export const IFM_NODES = [
  'transport',
  'communication',
  'assimilation',
  'defense_and_repair',
  'energy',
  'structural_integrity',
  'biotransformation',
] as const

export type IFMNode = (typeof IFM_NODES)[number]

// ===========================================================================
// Persona handoff
// ===========================================================================

export interface PersonaHandoff {
  persona: string
  findings: string[]
  data_quality: string
  delta: string
  handoff_message: string
}

// ===========================================================================
// Analysis modes and triggers
// ===========================================================================

export type AnalysisMode = 'incremental' | 'standard' | 'full' | 'doctor_prep'

export interface AnalysisTrigger {
  mode: AnalysisMode
  reason: string
  new_data_tables?: string[]
  target_appointment?: string
}

// ===========================================================================
// Chat tiers
// ===========================================================================

export type ChatTier = 'quick' | 'standard' | 'deep' | 'doctor_prep'
