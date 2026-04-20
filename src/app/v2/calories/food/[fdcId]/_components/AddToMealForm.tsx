'use client'

/*
 * AddToMealForm
 *
 * Meal picker (SegmentedControl, fullWidth) + primary Button with a
 * dynamic "Add to [Meal]" label. Wraps a native <form method="POST">
 * posting to /api/food/log with the scaled portion + meal + date.
 *
 * Hidden inputs mirror the fields the legacy route expects: fdcId,
 * meal_type, servings, gramsPerUnit, portionLabel, date. The native
 * form post lets the browser's 303 redirect carry us back to the
 * dashboard after insert.
 */

import { useState } from 'react'
import { Button, SegmentedControl } from '@/v2/components/primitives'
import { useFoodDetail } from './FoodDetailHero'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface AddToMealFormProps {
  fdcId: number
  date: string
  defaultMeal?: MealType
}

const MEAL_SEGMENTS: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export default function AddToMealForm({
  fdcId, date, defaultMeal = 'breakfast',
}: AddToMealFormProps) {
  const { selectedPortion } = useFoodDetail()
  const [meal, setMeal] = useState<MealType>(defaultMeal)

  // Legacy POST contract multiplies servings × gramsPerUnit to get
  // total grams eaten. USDA stores gramWeight as the total grams for
  // one portion pick (e.g., 118g for "1 medium banana"), so we send
  // servings=1 and gramsPerUnit=gramWeight. Matches the effective
  // math the legacy food detail page uses when its stepper is at 1.
  const servings = 1
  const gramsPerUnit = selectedPortion.gramWeight
  const portionLabel = selectedPortion.label

  return (
    <form
      method="POST"
      action="/api/food/log"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}
    >
      <input type="hidden" name="fdcId" value={fdcId} />
      <input type="hidden" name="meal_type" value={meal} />
      <input type="hidden" name="servings" value={servings} />
      <input type="hidden" name="gramsPerUnit" value={gramsPerUnit} />
      <input type="hidden" name="portionLabel" value={portionLabel} />
      <input type="hidden" name="date" value={date} />

      <SegmentedControl<MealType>
        segments={MEAL_SEGMENTS}
        value={meal}
        onChange={setMeal}
        fullWidth
      />

      <Button type="submit" variant="primary" size="lg" fullWidth>
        Add to {MEAL_LABELS[meal]}
      </Button>
    </form>
  )
}
