'use client'

/**
 * SleepRegularityExplainer
 *
 * Tap-to-explain modal for sleep regularity, the metric Oura's
 * signature explainer (frame_0098, frame_0099, frame_0100) was built
 * around. Regularity is about consistency of bedtime and wake time,
 * which research links to recovery quality more cleanly than any
 * single night's duration.
 */
import ExplainerSheet, { type ExplainerBand } from '../../../_components/ExplainerSheet'

export interface SleepRegularityExplainerProps {
  open: boolean
  onClose: () => void
  /** 0-100 regularity index, if your ring reports one. */
  regularityScore: number | null | undefined
  dateISO: string | null | undefined
}

const BANDS: ExplainerBand[] = [
  { label: 'Variable', min: 0, max: 60, color: 'var(--v2-accent-warning)' },
  { label: 'Fair', min: 60, max: 75, color: 'var(--v2-accent-highlight)' },
  { label: 'Steady', min: 75, max: 90, color: 'var(--v2-accent-primary)' },
  { label: 'Very steady', min: 90, max: 100, color: 'var(--v2-accent-success)' },
]

function labelFor(score: number): string {
  if (score < 60) return 'Variable'
  if (score < 75) return 'Fair'
  if (score < 90) return 'Steady'
  return 'Very steady'
}

export default function SleepRegularityExplainer({
  open,
  onClose,
  regularityScore,
  dateISO,
}: SleepRegularityExplainerProps) {
  const hasScore = typeof regularityScore === 'number' && Number.isFinite(regularityScore)
  const sourceNote = hasScore
    ? `Your regularity index over the last two weeks${dateISO ? ` (through ${dateISO})` : ''} is ${Math.round(regularityScore as number)} of 100.`
    : 'Not enough overlapping nights yet to score regularity. A couple more weeks of consistent ring wear will populate this.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Sleep regularity"
      bands={BANDS}
      currentValue={hasScore ? Math.round(regularityScore as number) : null}
      currentBandLabel={hasScore ? labelFor(Math.round(regularityScore as number)) : undefined}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Sleep regularity measures how close your bedtime and wake time are from one
        night to the next. The actual score is a percentage: 100 would be a perfectly
        identical schedule every day.
      </p>
      <p style={{ margin: 0 }}>
        Research increasingly suggests that regular sleep and wake times track more
        closely with long-term health than total hours slept. A steady rhythm helps
        your circadian system, hormones, and recovery line up.
      </p>
      <p style={{ margin: 0 }}>
        Realistic targets: most people land in the 70 to 85 range. Very steady
        schedules, above 90, are uncommon outside of strict routines and are not
        required to feel well.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we use a rolling two-week window of your
        bed and wake times, scoring how tight that distribution is. A single late
        night barely moves the number; a week of shifted timing moves it a lot.
      </p>
    </ExplainerSheet>
  )
}
