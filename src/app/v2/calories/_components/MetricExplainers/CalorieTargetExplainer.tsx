'use client'

/**
 * CalorieTargetExplainer
 *
 * Tap-to-explain modal for the daily calorie target shown at the
 * center of the dashboard ring. Frames the number as a soft envelope
 * derived from the user's plan, not a hard rule. Stays in the
 * paragraph-only form because calories are absolute and the
 * meaningful bands live on the ring itself (Remaining vs Over).
 */
import ExplainerSheet from '../../../_components/ExplainerSheet'

export interface CalorieTargetExplainerProps {
  open: boolean
  onClose: () => void
  /** Daily calorie target (from nutrition_goals). */
  target: number
  /** Calories logged so far today. */
  eaten: number
}

export default function CalorieTargetExplainer({
  open,
  onClose,
  target,
  eaten,
}: CalorieTargetExplainerProps) {
  const hasTarget = typeof target === 'number' && Number.isFinite(target) && target > 0
  const remaining = hasTarget ? Math.max(0, Math.round(target - eaten)) : null
  const overage = hasTarget ? Math.max(0, Math.round(eaten - target)) : null
  const isOver = hasTarget && eaten > target

  const sourceNote = hasTarget
    ? isOver
      ? `Today's target is ${Math.round(target)} cal. You're ${overage} over so far. Soft, not a verdict.`
      : `Today's target is ${Math.round(target)} cal. Remaining ${remaining} cal. Set on Plan; tap there to adjust.`
    : 'No calorie target set yet. Visit Plan to choose one.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Daily calorie target"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        The number in the ring is your soft daily envelope. The ring fills as you log
        meals, and shifts to a warm color once you cross over.
      </p>
      <p style={{ margin: 0 }}>
        Targets are a planning tool, not a rule. A day under is not a win and a day
        over is not a failure. The 7-day rhythm tells the real story.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we set it:</strong> the target lives in your Plan settings,
        usually anchored to your maintenance estimate from height, weight, age, and
        activity, then nudged for your current goal (hold, lose, gain). It does not
        auto-adjust day to day; you control it.
      </p>
    </ExplainerSheet>
  )
}
