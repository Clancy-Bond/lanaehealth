'use client'

/*
 * AddToMealForm
 *
 * Meal picker (SegmentedControl, fullWidth) + servings stepper +
 * primary Button with a dynamic "Add to [Meal]" label. Wraps a
 * native <form method="POST"> posting to /api/food/log.
 *
 * The servings stepper is the contract that lets Lanae log "2.5
 * portions" instead of always 1. /api/food/log clamps servings to
 * 0.25 .. 20 so the stepper matches that range and step. Live
 * recalculated calorie + grams hint shows the user the exact total
 * before they tap submit.
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

const SERVINGS_MIN = 0.25
const SERVINGS_MAX = 20
const SERVINGS_STEP = 0.25

function clampServings(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, n))
}

function formatServings(n: number): string {
  // Show whole numbers without trailing .00; otherwise 2 decimals max.
  return n === Math.floor(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export default function AddToMealForm({
  fdcId, date, defaultMeal = 'breakfast',
}: AddToMealFormProps) {
  const { selectedPortion, scaled } = useFoodDetail()
  const [meal, setMeal] = useState<MealType>(defaultMeal)
  const [servings, setServings] = useState(1)

  // Legacy POST contract multiplies servings × gramsPerUnit to get
  // total grams eaten. USDA stores gramWeight as the total grams for
  // one portion pick (e.g., 118g for "1 medium banana"), so we send
  // gramsPerUnit=gramWeight and servings=user's chosen count.
  const gramsPerUnit = selectedPortion.gramWeight
  const portionLabel = selectedPortion.label

  // Live recalc: scaled.calories is the per-portion value (the hero
  // already scales by selected portion). Servings multiplies that.
  const perPortionCalories = scaled.calories ?? 0
  const totalCalories = Math.round(perPortionCalories * servings)
  const totalGrams = Math.round(gramsPerUnit * servings)

  const setClamped = (next: number) => setServings(clampServings(next))

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
      <input type="hidden" name="returnTo" value={`/v2/calories?date=${date}`} />

      <SegmentedControl<MealType>
        segments={MEAL_SEGMENTS}
        value={meal}
        onChange={setMeal}
        fullWidth
      />

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>
          Servings
        </span>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center',
            border: '1px solid var(--v2-border)',
            borderRadius: 'var(--v2-radius-full)',
            background: 'var(--v2-bg-card)',
          }}
        >
          <button
            type="button"
            onClick={() => setClamped(servings - SERVINGS_STEP)}
            disabled={servings <= SERVINGS_MIN}
            aria-label="Decrease servings"
            style={stepperBtn(servings <= SERVINGS_MIN)}
          >
            {'\u2212'}
          </button>
          <span
            aria-live="polite"
            style={{
              minWidth: 56, textAlign: 'center',
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--v2-text-primary)',
            }}
          >
            {formatServings(servings)}
          </span>
          <button
            type="button"
            onClick={() => setClamped(servings + SERVINGS_STEP)}
            disabled={servings >= SERVINGS_MAX}
            aria-label="Increase servings"
            style={stepperBtn(servings >= SERVINGS_MAX)}
          >
            +
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        style={{
          fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)',
          fontVariantNumeric: 'tabular-nums', textAlign: 'center',
        }}
      >
        {totalCalories} cal
        <span style={{ color: 'var(--v2-text-muted)' }}>
          {' '}{'\u00b7'} {totalGrams} g
        </span>
      </div>

      <Button type="submit" variant="primary" size="lg" fullWidth>
        Add to {MEAL_LABELS[meal]}
      </Button>
    </form>
  )
}

function stepperBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 44, height: 44, border: 0, background: 'transparent',
    color: disabled ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
    fontSize: 20, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }
}
