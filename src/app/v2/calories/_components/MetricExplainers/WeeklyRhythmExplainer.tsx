'use client'

/**
 * WeeklyRhythmExplainer
 *
 * Tap-to-explain modal for the seven-day calorie sparkline on the
 * dashboard. Frames the sparkline as a "rhythm" view: the spread
 * matters more than any one bar. No bands; the meaningful read is
 * variability and trend, not threshold.
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface WeeklyRhythmExplainerProps {
  open: boolean
  onClose: () => void
  /** Average calories across the visible 7-day window. */
  weeklyAverage: number | null | undefined
  /** Daily target the bars are normalized against. */
  target: number | null | undefined
  /** Count of days in the window with any logged food. */
  daysLogged: number | null | undefined
}

export default function WeeklyRhythmExplainer({
  open,
  onClose,
  weeklyAverage,
  target,
  daysLogged,
}: WeeklyRhythmExplainerProps) {
  const hasAvg = typeof weeklyAverage === 'number' && Number.isFinite(weeklyAverage) && weeklyAverage > 0
  const hasTarget = typeof target === 'number' && Number.isFinite(target) && target > 0
  const logged = typeof daysLogged === 'number' ? daysLogged : 0

  const sourceNote = hasAvg
    ? hasTarget
      ? `Across the last 7 days you logged ${logged} of them, averaging about ${Math.round(weeklyAverage as number)} cal per day. Your target is ${Math.round(target as number)} cal.`
      : `Across the last 7 days you logged ${logged} of them, averaging about ${Math.round(weeklyAverage as number)} cal per day.`
    : 'No meals logged in the last 7 days yet. Once a few days are in, the rhythm becomes legible.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Your rhythm this week"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        Each bar is one day of intake. Today is filled in; the rest are the days
        leading up to today. The point is not any one bar, it is the shape of
        the row.
      </p>
      <p style={{ margin: 0 }}>
        A steady row tends to feel calmer than a row that swings. A few low bars
        next to a few high bars often means a missed log, not a real fast or
        feast. Treat skinny ghost bars as &ldquo;no data&rdquo; rather than &ldquo;no food&rdquo;.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> each bar height is that day&apos;s logged
        total, scaled against the larger of your daily target and the week&apos;s
        highest day. Bars under 4% get a small visible floor so a logged-but-low
        day is not invisible.
      </p>
    </ExplainerSheet>
  )
}
