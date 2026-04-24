'use client'

/**
 * CaloriesExplainer
 *
 * Tap-to-explain modal for the Calories chip on home. Calories are
 * absolute, not banded, so this modal stays in the paragraph-only
 * form and leans hard on "this is an estimate, not a verdict" tone.
 */
import ExplainerSheet from '../ExplainerSheet'

export interface CaloriesExplainerProps {
  open: boolean
  onClose: () => void
  calories: number | null | undefined
  entryCount: number | null | undefined
  dateISO: string | null
}

export default function CaloriesExplainer({
  open,
  onClose,
  calories,
  entryCount,
  dateISO,
}: CaloriesExplainerProps) {
  const hasValue = typeof calories === 'number' && Number.isFinite(calories) && calories > 0
  const count = typeof entryCount === 'number' ? entryCount : 0

  const sourceNote = hasValue
    ? `Totalled from ${count} meal ${count === 1 ? 'entry' : 'entries'} logged today${dateISO ? ` (${dateISO}).` : '.'} Estimates come from the USDA food-nutrient cache where possible.`
    : 'No meals logged today. Tap "Log a meal" from the Jump to section to add one.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title="Calories today"
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>
        This is a running tally of the energy in everything you&apos;ve logged today.
        It&apos;s useful for spotting days that were unusually high or unusually thin,
        not for nutrition maths.
      </p>
      <p style={{ margin: 0 }}>
        All calorie estimates are fuzzy. Portion size, preparation, and the
        underlying database each add noise. Treat the number as a neighbourhood, not
        a fact.
      </p>
      <p style={{ margin: 0 }}>
        <strong>How we compute it:</strong> we look up each food entry against the
        USDA nutrient database, scale by portion, and add them up. Meals without a
        reliable match contribute zero rather than a guess.
      </p>
    </ExplainerSheet>
  )
}
