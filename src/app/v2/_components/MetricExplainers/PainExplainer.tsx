'use client'

/**
 * PainExplainer
 *
 * Tap-to-explain modal for the daily Pain chip on home. Uses the
 * Oura band pattern but on the 0-10 self-report scale, with the
 * semantics inverted (low is optimal, high is "pay attention").
 */
import ExplainerSheet, { type ExplainerBand } from '../ExplainerSheet'

export interface PainExplainerProps {
  open: boolean
  onClose: () => void
  value: number | null | undefined
  dateISO: string | null
}

const BANDS: ExplainerBand[] = [
  { label: 'Settled', min: 0, max: 3, color: 'var(--v2-accent-success)' },
  { label: 'Moderate', min: 3, max: 6, color: 'var(--v2-accent-highlight)' },
  { label: 'Flare', min: 6, max: 10, color: 'var(--v2-accent-warning)' },
]

function labelForPain(v: number): string {
  if (v < 3) return 'Settled'
  if (v < 6) return 'Moderate'
  return 'Flare'
}

export default function PainExplainer({ open, onClose, value, dateISO }: PainExplainerProps) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const band = hasValue ? labelForPain(value as number) : undefined

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Daily pain"
      bands={BANDS}
      currentValue={hasValue ? value : null}
      currentBandLabel={band}
      source={
        hasValue
          ? `Your self-rating for today${dateISO ? ` (${dateISO}).` : '.'} You can edit it any time from the daily log.`
          : 'No rating logged for today yet. Tap "Log today" to add one in a few seconds.'
      }
    >
      <p style={{ margin: 0 }}>
        This is your own 0 to 10 rating of how pain has felt today, end to end. It
        isn&apos;t meant to be precise. A quick gut-check at logging time is more useful
        to your doctor than a number you agonised over.
      </p>
      <p style={{ margin: 0 }}>
        We group the scale into three bands so patterns show up fast. A clear band
        boundary is what the doctor summary leans on when describing a month.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> nothing, really. It&apos;s your rating. The
        only math we do is averaging it across a week for the weekly chart.
      </p>
    </ExplainerSheet>
  )
}
