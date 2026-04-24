'use client'

/**
 * CycleHistoryExplainer
 *
 * Tap-to-explain modal for the cycle history bar strip. Most patients
 * see a row of bars and wonder what counts as "outside usual range",
 * how the average is computed, and whether short outliers are a flag.
 * This modal answers all three in plain language with no causal claim.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface CycleHistoryExplainerProps {
  open: boolean
  onClose: () => void
  /** Mean cycle length in days, if computed. */
  meanLength: number | null
  /** Number of completed cycles shown in the strip. */
  cycleCount: number
}

export default function CycleHistoryExplainer({
  open,
  onClose,
  meanLength,
  cycleCount,
}: CycleHistoryExplainerProps) {
  const hasMean = typeof meanLength === 'number' && Number.isFinite(meanLength)
  const sourceNote = hasMean
    ? cycleCount > 0
      ? `Showing your last ${cycleCount} completed cycle${cycleCount === 1 ? '' : 's'}. Average length is ${meanLength.toFixed(1)} days.`
      : 'No completed cycles to summarize yet.'
    : 'Average appears once you have at least two completed cycles logged.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Cycle history"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Each bar is one completed cycle, ordered oldest on the left to most
        recent on the right. Bar height matches that cycle&apos;s length in days.
      </p>
      <p style={{ margin: 0 }}>
        The number above the bars is your running average. It updates as new
        cycles complete and recent ones age out of the window.
      </p>
      <p style={{ margin: 0 }}>
        <strong>What the warning color means.</strong> Bars more than 5 days
        from your average switch to a warmer color so they catch the eye.
        That is a notice, not a verdict. A single outlier after travel,
        illness, or a rough sleep stretch is normal. A run of them is worth
        bringing up with your doctor.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> a cycle starts on the first day of
        a logged period and ends the day before the next one begins. The
        average is a simple mean of the last six completed cycles.
      </p>
    </ExplainerSheet>
  )
}
