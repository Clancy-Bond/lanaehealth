'use client'

/**
 * SleepExplainer
 *
 * Tap-to-explain modal for the Sleep score chip on home. Same Oura
 * pattern as ReadinessExplainer: range bands over a plain-language
 * explanation, with a source note pinned to last night's recording.
 */
import ExplainerSheet, { type ExplainerBand } from '../ExplainerSheet'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface SleepExplainerProps {
  open: boolean
  onClose: () => void
  score: number | null | undefined
  durationSeconds: number | null | undefined
  dateISO: string | null
}

const BANDS: ExplainerBand[] = [
  { label: 'Pay attention', min: 0, max: 60, color: 'var(--v2-accent-warning)' },
  { label: 'Fair', min: 60, max: 70, color: 'var(--v2-accent-highlight)' },
  { label: 'Good', min: 70, max: 85, color: 'var(--v2-accent-primary)' },
  { label: 'Optimal', min: 85, max: 100, color: 'var(--v2-accent-success)' },
]

export default function SleepExplainer({ open, onClose, score, durationSeconds, dateISO }: SleepExplainerProps) {
  const band = bandForScore(typeof score === 'number' ? score : null)
  const label = bandConfig(band).label
  const hasValue = typeof score === 'number' && Number.isFinite(score)
  const durationPretty = secondsToHoursMinutes(durationSeconds)

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Sleep score"
      bands={BANDS}
      currentValue={hasValue ? score : null}
      currentBandLabel={hasValue ? label : undefined}
      source={
        hasValue
          ? `Based on ${durationPretty} of sleep${dateISO ? ` last night (${dateISO}).` : '.'} Your ring watches total duration, efficiency, and how evenly you moved between stages.`
          : 'No sleep recording synced yet. Wear the ring overnight and a score will appear here in the morning.'
      }
    >
      <p style={{ margin: 0 }}>
        Sleep score condenses last night into a single number that reflects how long
        you slept, how efficiently you slept through it, how settled you were once
        asleep, and how the night was split across stages.
      </p>
      <p style={{ margin: 0 }}>
        A single low night is normal and usually not worth action. A run of three or
        four low nights in a row, especially paired with rising resting heart rate,
        is the signal to slow things down a bit the next day.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> the ring&apos;s algorithm produces the score.
        We show it exactly as your ring reported, coloured by the bands above.
      </p>
    </ExplainerSheet>
  )
}
