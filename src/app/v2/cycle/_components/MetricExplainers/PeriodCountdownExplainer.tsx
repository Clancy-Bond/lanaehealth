'use client'

/**
 * PeriodCountdownExplainer
 *
 * Tap-to-explain modal for the "Next period" countdown card. Honest
 * about confidence: a prediction with two cycles of history is not the
 * same as one with twelve.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface PeriodCountdownExplainerProps {
  open: boolean
  onClose: () => void
  status: 'projected' | 'overdue' | 'unknown'
  daysUntil: number | null | undefined
  daysOverdue: number | null | undefined
  rangeStart: string | null | undefined
  rangeEnd: string | null | undefined
  confidence: 'high' | 'medium' | 'low'
}

function describeConfidence(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return 'High confidence: enough recent cycles to predict cleanly.'
  if (c === 'medium') return 'Medium confidence: a few recent cycles, but the window is wider than it will be later.'
  return 'Low confidence: not enough history yet. The range will tighten as you log a few more cycles.'
}

export default function PeriodCountdownExplainer({
  open,
  onClose,
  status,
  daysUntil,
  daysOverdue,
  rangeStart,
  rangeEnd,
  confidence,
}: PeriodCountdownExplainerProps) {
  const sourceParts: string[] = []
  if (status === 'projected' && typeof daysUntil === 'number') {
    sourceParts.push(`Estimated ${daysUntil} day${daysUntil === 1 ? '' : 's'} until your next period.`)
  } else if (status === 'overdue' && typeof daysOverdue === 'number') {
    sourceParts.push(`Currently ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past the predicted start.`)
  } else if (status === 'unknown') {
    sourceParts.push('Not enough cycle history yet to predict the next start.')
  }
  if (rangeStart && rangeEnd) {
    sourceParts.push(`Predicted window: ${rangeStart} to ${rangeEnd}.`)
  }
  sourceParts.push(describeConfidence(confidence))

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Days to next period"
      source={sourceParts.join(' ')}
    >
      <p style={{ margin: 0 }}>
        This is an estimate of when your next period is likely to start, based on your
        own logged cycles. It is a planning tool, not a medical reading.
      </p>
      <p style={{ margin: 0 }}>
        Cycles vary, especially during stress, illness, travel, or hormonal change. A
        period a few days off the prediction is normal. A period more than a week off,
        especially repeatedly, is something worth mentioning at your next visit.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we use the average length of your last
        several cycles and project forward from your most recent period start. The
        window widens when your history is short or your cycles vary a lot.
      </p>
    </ExplainerSheet>
  )
}
