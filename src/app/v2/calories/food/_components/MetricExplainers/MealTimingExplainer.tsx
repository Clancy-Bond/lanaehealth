'use client'

/**
 * MealTimingExplainer
 *
 * Tap-to-explain modal for the meal-section headers (Breakfast,
 * Lunch, Dinner, Snacks) on the food log. Single component covers
 * all four, with the `meal` prop selecting the timing copy. Stays
 * paragraph-only because timing windows are heuristic, not banded.
 */
import ExplainerSheet from '../../../../_components/ExplainerSheet'

export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealTimingExplainerProps {
  open: boolean
  onClose: () => void
  meal: MealKind
  /** Number of items logged in this meal today, for the source line. */
  entryCount: number | null | undefined
  /** Calorie subtotal for this meal today, for the source line. */
  totalCalories: number | null | undefined
}

const MEAL_TITLE: Record<MealKind, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

const MEAL_WINDOW: Record<MealKind, string> = {
  breakfast: 'roughly 4am to 11am',
  lunch: 'roughly 11am to 3pm',
  dinner: 'roughly 3pm to 9pm',
  snack: 'anything outside those windows',
}

const MEAL_LEAD: Record<MealKind, string> = {
  breakfast:
    "Breakfast is the first eating window of the day. Some people thrive on it; some prefer to delay until mid-morning. Both are reasonable.",
  lunch:
    "Lunch is the midday refuel. A balanced lunch with protein and fiber tends to keep afternoon energy steadier than a lunch heavy on quick carbs alone.",
  dinner:
    "Dinner is usually the longest eating window of the day. Earlier is generally easier on sleep; very late dinners can show up in heart rate and HRV the next morning.",
  snack:
    "Snacks are anything outside the main meal windows. Worth noting both the food and the cue: hungry, bored, social, anxious. The cue often matters more than the calories.",
}

export default function MealTimingExplainer({
  open,
  onClose,
  meal,
  entryCount,
  totalCalories,
}: MealTimingExplainerProps) {
  const count = typeof entryCount === 'number' ? entryCount : 0
  const cal = typeof totalCalories === 'number' ? Math.round(totalCalories) : 0

  const sourceNote =
    count > 0
      ? `Today: ${count} ${count === 1 ? 'item' : 'items'} logged in this meal, totaling ${cal} cal.`
      : 'Nothing logged in this meal yet today. Tap "Add" on the section to start.'

  return (
    <ExplainerSheet
      open={open}
      onClose={onClose}
      title={MEAL_TITLE[meal]}
      source={sourceNote}
    >
      <p style={{ margin: 0 }}>{MEAL_LEAD[meal]}</p>
      <p style={{ margin: 0 }}>
        We bucket food entries into this section using your logged time of day
        ({MEAL_WINDOW[meal]}). The windows are loose, not strict; if you log
        lunch at 11am or dinner at 9:30pm, it still lands in the right bucket
        for everyday review.
      </p>
      <p style={{ margin: 0 }}>
        <strong>Per-item calories:</strong> each row in this section shows the
        calorie estimate for that food, looked up against the USDA food-nutrient
        database and scaled to your portion. Estimates are fuzzy: portion,
        preparation, and the underlying database each add noise. Treat each
        number as a neighborhood, not a fact.
      </p>
    </ExplainerSheet>
  )
}
