'use client'

/**
 * FoodDetailServingsState
 *
 * Tiny client wrapper that owns the `servings` (portion multiplier)
 * state and threads it into PortionInputRow + PortionChipStrip +
 * AddToMealForm so they all read and write the same number.
 *
 * Why this lives here: page.tsx is a server component, but PortionInput
 * needs `useState` to be controllable AND the same state has to drive
 * the hidden `<input name="servings">` inside AddToMealForm. Lifting
 * that into one client wrapper is the smallest possible boundary.
 *
 * The wrapper also injects the chip strip directly between the input
 * row and the meal-log row, mirroring the MFN ordering exactly:
 *
 *     [PortionInputRow]    ← number + cals
 *     [PortionChipStrip]   ← unit chips wrap to 2 rows
 *     [AddToMealForm]      ← meal text link + green Log pill
 */

import { useState } from 'react'
import PortionInputRow from './PortionInputRow'
import PortionChipStrip from './PortionChipStrip'
import AddToMealForm, { type MealType } from './AddToMealForm'

export interface FoodDetailServingsStateProps {
  fdcId: number
  date: string
  defaultMeal: MealType
}

export default function FoodDetailServingsState({
  fdcId,
  date,
  defaultMeal,
}: FoodDetailServingsStateProps) {
  const [servings, setServings] = useState(1)

  return (
    <>
      <PortionInputRow value={servings} onChange={setServings} />
      <PortionChipStrip />
      <AddToMealForm
        fdcId={fdcId}
        date={date}
        defaultMeal={defaultMeal}
        servings={servings}
      />
    </>
  )
}
