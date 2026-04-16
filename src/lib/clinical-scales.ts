/**
 * Clinical Scales - PHQ-9 and GAD-7
 *
 * Validated questionnaire text and scoring logic for standardized
 * depression (PHQ-9) and anxiety (GAD-7) screening instruments.
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
    default:
      return 0
  }
}

/**
 * Score a completed clinical scale and return total + severity.
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
