'use client'

/**
 * AddToMealForm
 *
 * MFN parity: replaces the previous SegmentedControl tab strip +
 * full-width Add-to-Meal button with the inline pattern from
 * `docs/reference/mynetdiary/frames/full-tour/frame_0045.png`:
 *
 *     Breakfast                     [ Log ]
 *
 * - Left: meal name styled as a tappable link (blue, link-decorated)
 *   that opens a small picker sheet to switch among breakfast / lunch
 *   / dinner / snack.
 * - Right: green pill button labelled "Log" (NOT "Add to Breakfast").
 *
 * The previous tab + stepper layout was visually correct for an Oura
 * surface but wrong for MFN parity (user feedback 2026-04-27). The
 * servings stepper has been removed from this row entirely; the
 * portion multiplier on PortionInputRow is the new servings input
 * because that matches MFN's flow (the number-on-the-left drives the
 * total).
 *
 * The wire contract to /api/food/log is unchanged: we still POST
 * fdcId, meal_type, servings, gramsPerUnit, portionLabel, date,
 * returnTo. servings = the portion multiplier from PortionInputRow.
 */

import { useState } from 'react'
import { useFoodDetail } from './FoodDetailHero'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface AddToMealFormProps {
  fdcId: number
  date: string
  defaultMeal?: MealType
  /**
   * The portion multiplier from PortionInputRow. Combined with
   * selectedPortion.gramWeight, the legacy /api/food/log route
   * computes total grams as servings * gramsPerUnit. This component
   * does not own the multiplier; it reads it from the parent.
   */
  servings: number
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function AddToMealForm({
  fdcId,
  date,
  defaultMeal = 'breakfast',
  servings,
}: AddToMealFormProps) {
  const { selectedPortion } = useFoodDetail()
  const [meal, setMeal] = useState<MealType>(defaultMeal)
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <section
      aria-label="Log to meal"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-4)',
        background: 'var(--v2-bg-card)',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={pickerOpen}
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          color: 'var(--v2-accent-primary)',
          fontSize: 'var(--v2-text-base)',
          fontWeight: 'var(--v2-weight-semibold)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: 4,
          textDecorationColor: 'var(--v2-accent-primary-soft, currentColor)',
          textDecorationThickness: '1.5px',
        }}
      >
        {MEAL_LABELS[meal]}
      </button>

      <form
        method="POST"
        action="/api/food/log"
        style={{ margin: 0 }}
      >
        <input type="hidden" name="fdcId" value={fdcId} />
        <input type="hidden" name="meal_type" value={meal} />
        <input type="hidden" name="servings" value={servings} />
        <input type="hidden" name="gramsPerUnit" value={selectedPortion.gramWeight} />
        <input type="hidden" name="portionLabel" value={selectedPortion.label} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="returnTo" value={`/v2/calories?date=${date}`} />
        <button
          type="submit"
          style={{
            minHeight: 40,
            padding: '0 24px',
            border: 0,
            borderRadius: 'var(--v2-radius-full)',
            background: '#43A079',
            color: '#ffffff',
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          Log
        </button>
      </form>

      {pickerOpen && (
        <MealPickerOverlay
          current={meal}
          onSelect={(next) => {
            setMeal(next)
            setPickerOpen(false)
          }}
          onDismiss={() => setPickerOpen(false)}
        />
      )}
    </section>
  )
}

/**
 * Lightweight bottom-sheet-ish picker. We don't reach for the Sheet
 * primitive here because this overlay is dead simple and tightly
 * scoped — four options, no header, no scrim animation needed.
 * Tapping the backdrop or any option closes it.
 */
function MealPickerOverlay({
  current,
  onSelect,
  onDismiss,
}: {
  current: MealType
  onSelect: (m: MealType) => void
  onDismiss: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Select meal"
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <ul
        onClick={(e) => e.stopPropagation()}
        role="listbox"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 'var(--v2-space-2)',
          background: 'var(--v2-bg-card)',
          borderTopLeftRadius: 'var(--v2-radius-lg)',
          borderTopRightRadius: 'var(--v2-radius-lg)',
          width: '100%',
          maxWidth: 480,
          paddingBottom: 'calc(var(--v2-safe-bottom, 0px) + var(--v2-space-3))',
        }}
      >
        {MEAL_ORDER.map((m) => (
          <li key={m}>
            <button
              type="button"
              role="option"
              aria-selected={m === current}
              onClick={() => onSelect(m)}
              style={{
                width: '100%',
                minHeight: 48,
                padding: '0 var(--v2-space-4)',
                border: 0,
                background:
                  m === current ? 'var(--v2-accent-primary-soft)' : 'transparent',
                color:
                  m === current ? 'var(--v2-accent-primary)' : 'var(--v2-text-primary)',
                fontSize: 'var(--v2-text-base)',
                fontWeight:
                  m === current
                    ? 'var(--v2-weight-semibold)'
                    : 'var(--v2-weight-medium)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                borderRadius: 'var(--v2-radius-md)',
              }}
            >
              {MEAL_LABELS[m]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
