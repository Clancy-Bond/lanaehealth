/**
 * Clinical Scales - PHQ-9, GAD-7, HIT-6, MIDAS
 *
 * Validated questionnaire text and scoring logic for standardized
 * screening instruments:
 *  - PHQ-9: Patient Health Questionnaire, 9-item depression screen (Kroenke 2001)
 *  - GAD-7: Generalized Anxiety Disorder, 7-item anxiety screen (Spitzer 2006)
 *  - HIT-6: Headache Impact Test, 6-item headache impact (Kosinski 2003)
 *  - MIDAS: Migraine Disability Assessment, 5-item disability score (Stewart 2000)
 *
 * Copy rule: All surfaces must read "your score is X" not "you have condition Y".
 * These instruments are screeners, not diagnoses.
 */

import type { ClinicalScaleType, ScaleSeverity } from '@/lib/types'

export interface ScaleQuestion {
  index: number
  text: string
}

export interface ScaleResult {
  total_score: number
  severity: ScaleSeverity
}

// HIT-6 impact category strings. Not diagnostic, just descriptors per IHS.
export type Hit6Category =
  | 'little_or_no_impact'
  | 'some_impact'
  | 'substantial_impact'
  | 'severe_impact'

export interface Hit6Result extends ScaleResult {
  category: Hit6Category
  descriptor: string
}

// MIDAS Grade I through IV per Stewart 2001.
export type MidasGrade = 'I' | 'II' | 'III' | 'IV'

export interface MidasResult extends ScaleResult {
  grade: MidasGrade
  descriptor: string
}

// Literal Likert response point values for HIT-6.
// Source: Kosinski M et al. Qual Life Res 2003, instrument weights 6, 8, 10, 11, 13.
export const HIT6_RESPONSE_VALUES = [6, 8, 10, 11, 13] as const

// ── PHQ-9 Questions ─────────────────────────────────────────────────

const PHQ9_QUESTIONS: ScaleQuestion[] = [
  { index: 0, text: 'Little interest or pleasure in doing things' },
  { index: 1, text: 'Feeling down, depressed, or hopeless' },
  { index: 2, text: 'Trouble falling or staying asleep, or sleeping too much' },
  { index: 3, text: 'Feeling tired or having little energy' },
  { index: 4, text: 'Poor appetite or overeating' },
  { index: 5, text: 'Feeling bad about yourself, or that you are a failure, or have let yourself or your family down' },
  { index: 6, text: 'Trouble concentrating on things, such as reading the newspaper or watching television' },
  { index: 7, text: 'Moving or speaking so slowly that other people could have noticed. Or the opposite: being so fidgety or restless that you have been moving around a lot more than usual' },
  { index: 8, text: 'Thoughts that you would be better off dead, or of hurting yourself in some way' },
]

// ── GAD-7 Questions ─────────────────────────────────────────────────

const GAD7_QUESTIONS: ScaleQuestion[] = [
  { index: 0, text: 'Feeling nervous, anxious, or on edge' },
  { index: 1, text: 'Not being able to stop or control worrying' },
  { index: 2, text: 'Worrying too much about different things' },
  { index: 3, text: 'Trouble relaxing' },
  { index: 4, text: 'Being so restless that it is hard to sit still' },
  { index: 5, text: 'Becoming easily annoyed or irritable' },
  { index: 6, text: 'Feeling afraid, as if something awful might happen' },
]

// ── HIT-6 Questions ─────────────────────────────────────────────────
// 6-item Headache Impact Test. Each item scored on a 5-point Likert scale
// with weights 6, 8, 10, 11, 13 (see HIT6_RESPONSE_VALUES). Total 36 to 78.
// Source: Kosinski M, Bayliss MS, Bjorner JB, et al.
// "A six-item short-form survey for measuring headache impact: the HIT-6."
// Quality of Life Research 2003; 12(8):963 to 974.

const HIT6_QUESTIONS: ScaleQuestion[] = [
  { index: 0, text: 'When you have headaches, how often is the pain severe?' },
  { index: 1, text: 'How often do headaches limit your ability to do usual daily activities including household work, work, school, or social activities?' },
  { index: 2, text: 'When you have a headache, how often do you wish you could lie down?' },
  { index: 3, text: 'In the past 4 weeks, how often have you felt too tired to do work or daily activities because of your headaches?' },
  { index: 4, text: 'In the past 4 weeks, how often have you felt fed up or irritated because of your headaches?' },
  { index: 5, text: 'In the past 4 weeks, how often did headaches limit your ability to concentrate on work or daily activities?' },
]

// ── MIDAS Questions ─────────────────────────────────────────────────
// 5-item Migraine Disability Assessment. Each item asks for a raw day count
// over the past 3 months. Sum of all 5 items is the total MIDAS score.
// Source: Stewart WF, Lipton RB, Dowson AJ, Sawyer J.
// "Development and testing of the Migraine Disability Assessment (MIDAS) questionnaire
// to assess headache-related disability." Neurology 2001; 56(Suppl 1):S20 to S28.

const MIDAS_QUESTIONS: ScaleQuestion[] = [
  { index: 0, text: 'On how many days in the last 3 months did you miss work or school because of your headaches?' },
  { index: 1, text: 'How many days in the last 3 months was your productivity at work or school reduced by half or more because of your headaches? (Do not include days you counted above.)' },
  { index: 2, text: 'On how many days in the last 3 months did you not do household work because of your headaches?' },
  { index: 3, text: 'How many days in the last 3 months was your productivity in household work reduced by half or more because of your headaches? (Do not include days you counted above.)' },
  { index: 4, text: 'On how many days in the last 3 months did you miss family, social, or leisure activities because of your headaches?' },
]

// ── Response Labels ─────────────────────────────────────────────────

export const RESPONSE_LABELS = [
  'Not at all',
  'Several days',
  'More than half',
  'Nearly every day',
] as const

// ── Scoring ─────────────────────────────────────────────────────────

function scorePHQ9(responses: number[]): ScaleResult {
  const total = responses.reduce((sum, val) => sum + val, 0)
  let severity: ScaleSeverity

  if (total <= 4) severity = 'minimal'
  else if (total <= 9) severity = 'mild'
  else if (total <= 14) severity = 'moderate'
  else if (total <= 19) severity = 'moderately_severe'
  else severity = 'severe'

  return { total_score: total, severity }
}

function scoreGAD7(responses: number[]): ScaleResult {
  const total = responses.reduce((sum, val) => sum + val, 0)
  let severity: ScaleSeverity

  if (total <= 4) severity = 'minimal'
  else if (total <= 9) severity = 'mild'
  else if (total <= 14) severity = 'moderate'
  else severity = 'severe'

  return { total_score: total, severity }
}

/**
 * Score a completed HIT-6 response set.
 *
 * Inputs are 6 numbers each drawn from HIT6_RESPONSE_VALUES (6, 8, 10, 11, 13).
 * Total range is 36 to 78. Thresholds follow Kosinski et al. 2003:
 *   <=49: little or no impact
 *   50-55: some impact
 *   56-59: substantial impact
 *   >=60: severe impact
 *
 * Severity maps to the existing ScaleSeverity union using minimal/mild/
 * moderate/severe so existing color and label helpers keep working.
 *
 * Citation: Kosinski M, Bayliss MS, Bjorner JB, et al. A six-item short-form
 * survey for measuring headache impact: the HIT-6. Quality of Life Research
 * 2003; 12(8):963 to 974.
 */
export function scoreHIT6(responses: number[]): Hit6Result {
  const total = responses.reduce((sum, val) => sum + val, 0)
  let category: Hit6Category
  let severity: ScaleSeverity
  let descriptor: string

  if (total <= 49) {
    category = 'little_or_no_impact'
    severity = 'minimal'
    descriptor = 'Little or no impact'
  } else if (total <= 55) {
    category = 'some_impact'
    severity = 'mild'
    descriptor = 'Some impact'
  } else if (total <= 59) {
    category = 'substantial_impact'
    severity = 'moderate'
    descriptor = 'Substantial impact'
  } else {
    category = 'severe_impact'
    severity = 'severe'
    descriptor = 'Severe impact'
  }

  return { total_score: total, severity, category, descriptor }
}

/**
 * Score a completed MIDAS response set.
 *
 * Inputs are the 5 disability-day counts (items A through E). Two extra
 * context items (frequency, average pain) are displayed separately in the UI
 * but are NOT summed per Stewart 2001. The total is the sum of the 5
 * disability-day counts.
 *
 * Grades per Stewart et al. 2001:
 *   0 to 5: Grade I (little or no disability)
 *   6 to 10: Grade II (mild disability)
 *   11 to 20: Grade III (moderate disability)
 *   21+: Grade IV (severe disability)
 *
 * Severity maps to the grade_1 through grade_4 extensions of the
 * ScaleSeverity union so consumers of either axis can render correctly.
 *
 * Citation: Stewart WF, Lipton RB, Dowson AJ, Sawyer J. Development and
 * testing of the Migraine Disability Assessment (MIDAS) questionnaire to
 * assess headache-related disability. Cephalalgia 2001 (Neurology 56 Suppl 1).
 */
export function scoreMIDAS(responses: number[]): MidasResult {
  // Sum only the first 5 items (A through E). Extra items after index 4 are
  // frequency and intensity context and are not summed per the instrument.
  const disabilityItems = responses.slice(0, 5)
  const total = disabilityItems.reduce((sum, val) => sum + val, 0)

  let grade: MidasGrade
  let severity: ScaleSeverity
  let descriptor: string

  if (total <= 5) {
    grade = 'I'
    severity = 'grade_1'
    descriptor = 'Little or no disability'
  } else if (total <= 10) {
    grade = 'II'
    severity = 'grade_2'
    descriptor = 'Mild disability'
  } else if (total <= 20) {
    grade = 'III'
    severity = 'grade_3'
    descriptor = 'Moderate disability'
  } else {
    grade = 'IV'
    severity = 'grade_4'
    descriptor = 'Severe disability'
  }

  return { total_score: total, severity, grade, descriptor }
}

// ── Exports ─────────────────────────────────────────────────────────

/**
 * Get the question array for a given clinical scale type.
 */
export function getScaleQuestions(scaleType: ClinicalScaleType): ScaleQuestion[] {
  switch (scaleType) {
    case 'PHQ-9':
      return PHQ9_QUESTIONS
    case 'GAD-7':
      return GAD7_QUESTIONS
    case 'HIT-6':
      return HIT6_QUESTIONS
    case 'MIDAS':
      return MIDAS_QUESTIONS
    default:
      return []
  }
}

/**
 * Get the maximum possible score for a given scale.
 */
export function getMaxScore(scaleType: ClinicalScaleType): number {
  switch (scaleType) {
    case 'PHQ-9':
      return 27
    case 'GAD-7':
      return 21
    case 'HIT-6':
      // 6 items each at max weight 13 = 78.
      return 78
    case 'MIDAS':
      // MIDAS total has no fixed maximum (raw day counts can climb). A value
      // of 90 days caps a 3-month recall on any single item, five items sum
      // to 450 as a practical ceiling for UI scaling.
      return 450
    default:
      return 0
  }
}

/**
 * Score a completed clinical scale and return total + severity.
 *
 * For HIT-6 and MIDAS this returns the base ScaleResult shape. Callers that
 * need category or grade strings should invoke scoreHIT6 / scoreMIDAS
 * directly for the extended return type.
 */
export function scoreScale(
  scaleType: ClinicalScaleType,
  responses: number[]
): ScaleResult {
  switch (scaleType) {
    case 'PHQ-9':
      return scorePHQ9(responses)
    case 'GAD-7':
      return scoreGAD7(responses)
    case 'HIT-6':
      return scoreHIT6(responses)
    case 'MIDAS':
      return scoreMIDAS(responses)
    default:
      return { total_score: 0, severity: 'minimal' }
  }
}

/**
 * Get a CSS-compatible color for a severity level, drawn from
 * the Warm Modern design system palette.
 */
export function getSeverityColor(severity: ScaleSeverity): string {
  switch (severity) {
    case 'minimal':
      return '#6B9080' // sage
    case 'mild':
      return '#C4A35A' // warm gold
    case 'moderate':
      return '#D4874D' // burnt orange
    case 'moderately_severe':
      return '#C85C5C' // soft red
    case 'severe':
      return '#8B2E2E' // dark red
    default:
      return '#6B9080'
  }
}

/**
 * Get a human-friendly label for a severity level.
 */
export function getSeverityLabel(severity: ScaleSeverity): string {
  switch (severity) {
    case 'minimal':
      return 'Minimal'
    case 'mild':
      return 'Mild'
    case 'moderate':
      return 'Moderate'
    case 'moderately_severe':
      return 'Moderately Severe'
    case 'severe':
      return 'Severe'
    default:
      return severity
  }
}
