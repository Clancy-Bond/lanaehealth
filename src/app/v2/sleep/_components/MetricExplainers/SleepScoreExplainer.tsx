'use client'

/**
 * SleepScoreExplainer
 *
 * Tap-to-explain modal for the main sleep score ring on /v2/sleep.
 * Mirrors home's SleepExplainer copy register but framed for the
 * detail surface, with a callout about the contributors below.
 */
import ExplainerSheet, { type ExplainerBand } from '../../../_components/ExplainerSheet'
import { bandConfig, bandForScore, secondsToHoursMinutes } from '@/lib/v2/home-signals'

export interface SleepScoreExplainerProps {
  open: boolean
  onClose: () => void
  score: number | null | undefined
  durationSeconds: number | null | undefined
  medianScore: number | null | undefined
  dateISO: string | null | undefined
}

const BANDS: ExplainerBand[] = [
  { label: 'Pay attention', min: 0, max: 60, color: 'var(--v2-accent-warning)' },
  { label: 'Fair', min: 60, max: 70, color: 'var(--v2-accent-highlight)' },
  { label: 'Good', min: 70, max: 85, color: 'var(--v2-accent-primary)' },
  { label: 'Optimal', min: 85, max: 100, color: 'var(--v2-accent-success)' },
]

export default function SleepScoreExplainer({
  open,
  onClose,
  score,
  durationSeconds,
  medianScore,
  dateISO,
}: SleepScoreExplainerProps) {
  const band = bandForScore(typeof score === 'number' ? score : null)
  const label = bandConfig(band).label
  const hasValue = typeof score === 'number' && Number.isFinite(score)
  const durationPretty = secondsToHoursMinutes(durationSeconds)
  const hasMedian = typeof medianScore === 'number' && Number.isFinite(medianScore)

  const sourceParts: string[] = []
  if (hasValue) {
    sourceParts.push(`Last night${dateISO ? ` (${dateISO})` : ''} scored ${score}, after ${durationPretty} of sleep.`)
    if (hasMedian) {
      const delta = (score as number) - (medianScore as number)
      if (Math.abs(delta) >= 3) {
        sourceParts.push(`That is ${delta > 0 ? 'above' : 'below'} your 30-day median of ${Math.round(medianScore as number)}.`)
      } else {
        sourceParts.push(`In line with your 30-day median of ${Math.round(medianScore as number)}.`)
      }
    }
  } else {
    sourceParts.push('No sleep recording synced yet. Wear the ring overnight and a score will appear in the morning.')
  }

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Sleep score"
      bands={BANDS}
      currentValue={hasValue ? score : null}
      currentBandLabel={hasValue ? label : undefined}
      source={sourceParts.join(' ')}
    >
      <p style={{ margin: 0 }}>
        Sleep score condenses last night into a single number from 0 to 100. It blends
        how long you slept, how efficiently you slept through it, how settled you were
        once asleep, and how the night was split across stages.
      </p>
      <p style={{ margin: 0 }}>
        A single low night is normal and usually not worth action. A run of three or
        four low nights, especially paired with a rising resting heart rate, is the
        signal to slow things down a bit the next day.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> the ring&apos;s algorithm produces the score.
        We display it exactly as reported, coloured by the bands above. The
        contributor rows further down break out the inputs.
      </p>
    </ExplainerSheet>
  )
}
