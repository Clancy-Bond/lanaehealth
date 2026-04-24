'use client'

/**
 * ReadinessExplainer
 *
 * Oura-pattern tap-to-explain modal for the Readiness chip on home.
 * Mirrors frame_0098 / frame_0099 / frame_0100: large title, segmented
 * band bar with the user's tick, two paragraphs of NC-voiced copy, a
 * small source note, and a "Got it" dismiss.
 *
 * Copy lives here so future editing stays section-local and doesn't
 * touch the ExplainerSheet primitive.
 */
import ExplainerSheet, { type ExplainerBand } from '../ExplainerSheet'
import { bandConfig, bandForScore } from '@/lib/v2/home-signals'

export interface ReadinessExplainerProps {
  open: boolean
  onClose: () => void
  value: number | null | undefined
  dateISO: string | null
}

const BANDS: ExplainerBand[] = [
  { label: 'Pay attention', min: 0, max: 60, color: 'var(--v2-accent-warning)' },
  { label: 'Fair', min: 60, max: 70, color: 'var(--v2-accent-highlight)' },
  { label: 'Good', min: 70, max: 85, color: 'var(--v2-accent-primary)' },
  { label: 'Optimal', min: 85, max: 100, color: 'var(--v2-accent-success)' },
]

export default function ReadinessExplainer({ open, onClose, value, dateISO }: ReadinessExplainerProps) {
  const band = bandForScore(typeof value === 'number' ? value : null)
  const label = bandConfig(band).label
  const hasValue = typeof value === 'number' && Number.isFinite(value)

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Readiness"
      bands={BANDS}
      currentValue={hasValue ? value : null}
      currentBandLabel={hasValue ? label : undefined}
      source={
        hasValue
          ? `Based on last night's sleep, resting heart rate, HRV, and body temperature${
              dateISO ? ` (${dateISO}).` : '.'
            }`
          : 'Your ring has not synced a reading yet. Wear the ring overnight and a score will show here tomorrow.'
      }
    >
      <p style={{ margin: 0 }}>
        Readiness is your ring&apos;s one-number read on how recovered your body looks today.
        It leans on last night&apos;s sleep, your resting heart rate, heart rate variability,
        and body temperature compared to your usual baseline.
      </p>
      <p style={{ margin: 0 }}>
        Scores in the 70s are a typical baseline day. Below 60 often means your body is
        asking for a gentler pace. On a flare day, treat readiness as a hint, not a
        verdict, and pair it with how you actually feel.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> your Oura ring combines those signals each
        morning. We surface the number as-is, and colour-code it using the bands above.
      </p>
    </ExplainerSheet>
  )
}
