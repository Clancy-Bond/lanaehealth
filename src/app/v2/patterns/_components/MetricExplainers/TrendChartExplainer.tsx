'use client'

/**
 * TrendChartExplainer
 *
 * Tap-to-explain modal for the 30-day calorie trend chart. The chart
 * looks simple but the bar coding (logged vs ghost), the average line,
 * and the missing-day footnote all carry meaning that the glance-read
 * elides. This modal is where that meaning lives.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface TrendChartExplainerProps {
  open: boolean
  onClose: () => void
  /** Average calories across the visible window. */
  average: number | null
  /** Number of days with at least one logged entry. */
  loggedDays: number
  /** Total day count in the window (typically 30). */
  totalDays: number
}

export default function TrendChartExplainer({
  open,
  onClose,
  average,
  loggedDays,
  totalDays,
}: TrendChartExplainerProps) {
  const missing = totalDays - loggedDays
  const hasAvg = typeof average === 'number' && Number.isFinite(average) && average > 0
  const sourceNote = hasAvg
    ? missing === 0
      ? `Across the last ${totalDays} days you logged every day, averaging ${average} cal.`
      : `Across the last ${totalDays} days you logged ${loggedDays} of them, averaging ${average} cal on those days.`
    : 'Not enough logged days to compute an average yet.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="30-day energy"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Each bar is one day of logged calories. The chart reads left to right,
        oldest to today. The point is the shape across weeks, not any single
        day&apos;s number.
      </p>
      <p style={{ margin: 0 }}>
        Bars in teal are days you logged something. Faded bars are days with no
        meals recorded. We show them as ghosts rather than dropping them so a
        gap reads as a gap, not as a zero-calorie day.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we sum every food entry&apos;s calorie
        value per day and scale bar heights against the highest day in the
        window. The average above the chart only counts logged days.
      </p>
      <p style={{ margin: 0 }}>
        A few low days next to a few high days usually means a missed log, not
        a real fast or feast. Steadiness across weeks is more interesting than
        any single bar.
      </p>
    </ExplainerSheet>
  )
}
