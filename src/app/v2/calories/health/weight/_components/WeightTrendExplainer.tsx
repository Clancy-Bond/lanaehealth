'use client'

/**
 * WeightTrendExplainer
 *
 * Tap-to-explain modal for the 30-day weight sparkline. The teaching
 * point is that body weight wobbles day to day for reasons that have
 * nothing to do with body composition (water, sodium, sleep,
 * cycle phase). Trend windows are how you separate signal from
 * noise. No bands; the meaningful read is direction over time.
 */
import ExplainerSheet from '../../../../_components/ExplainerSheet'

export interface WeightTrendExplainerProps {
  open: boolean
  onClose: () => void
  /** Most recent reading in pounds, for the source line. */
  latestLb: number | null | undefined
  /** Reading from roughly 7 days ago in pounds, for the source line. */
  weekAgoLb: number | null | undefined
  /** Reading from roughly 30 days ago in pounds, for the source line. */
  monthAgoLb: number | null | undefined
}

function formatDelta(latest: number, prior: number): string {
  const delta = latest - prior
  const abs = Math.abs(delta).toFixed(1)
  if (Math.abs(delta) < 0.05) return 'about flat'
  return delta > 0 ? `up ${abs} lb` : `down ${abs} lb`
}

export default function WeightTrendExplainer({
  open,
  onClose,
  latestLb,
  weekAgoLb,
  monthAgoLb,
}: WeightTrendExplainerProps) {
  const hasLatest = typeof latestLb === 'number' && Number.isFinite(latestLb)
  const hasWeek = hasLatest && typeof weekAgoLb === 'number' && Number.isFinite(weekAgoLb)
  const hasMonth = hasLatest && typeof monthAgoLb === 'number' && Number.isFinite(monthAgoLb)

  let sourceNote: string
  if (!hasLatest) {
    sourceNote = 'No weigh-ins yet. Add one and the trend window will start to fill in.'
  } else {
    const parts: string[] = []
    if (hasWeek) {
      parts.push(`vs 7 days ago: ${formatDelta(latestLb as number, weekAgoLb as number)}`)
    }
    if (hasMonth) {
      parts.push(`vs 30 days ago: ${formatDelta(latestLb as number, monthAgoLb as number)}`)
    }
    sourceNote = parts.length
      ? `Latest reading is ${(latestLb as number).toFixed(1)} lb. ${parts.join('. ')}.`
      : `Latest reading is ${(latestLb as number).toFixed(1)} lb. Log a few more days to start seeing the trend.`
  }

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Weight trend"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Body weight wobbles two to four pounds across a normal week for reasons
        that have nothing to do with body composition: water, sodium, sleep,
        cycle phase, even how full your gut is.
      </p>
      <p style={{ margin: 0 }}>
        That is why a single weigh-in is noisy. The 7-day window smooths short
        spikes; the 30-day window shows the underlying direction. If the two
        windows disagree, the longer one is usually closer to the truth.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> each bar is one weigh-in plotted on
        a local scale (roughly your range plus a small pad), so a flat log does
        not collapse to zero. Empty days are short ticks, not zeros. Numbers
        come straight from your manual entries; we do not interpolate.
      </p>
    </ExplainerSheet>
  )
}
