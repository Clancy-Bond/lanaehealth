'use client'

/*
 * MealItemEditSheet
 *
 * MFN signature edit-in-place. Tapping a logged meal row opens this
 * bottom sheet with a servings stepper (0.25 ... 20) and a live calorie
 * preview that scales the row's existing calories by the ratio
 * nextServings / prevServings. Save POSTs PATCH /api/food/log and the
 * page refreshes so the sparkline + ring + macro tiles all update.
 *
 * We keep edit-in-place strictly to "how much did you eat" because:
 *   1. food_entries has no fdcId column so we cannot replay USDA
 *      lookup without losing the original portion label.
 *   2. The MFN UX target is the same: tap the row, change the count,
 *      done. Nothing else moves.
 *
 * Optimistic update: we reflect the new calorie total in the sheet's
 * preview immediately as the user steps. The Save button switches to
 * "Saving..." while the network request flies, and any error reverts
 * to the prior value with an inline message.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Sheet } from '@/v2/components/primitives'

export interface MealItemEditSheetProps {
  open: boolean
  onClose: () => void
  entryId: string
  foodLabel: string
  /** The current displayed calories on the row before edit. */
  baseCalories: number
  /** Servings count to start the stepper at. Defaults to 1. The UI
   * never knows the original servings count from the database (we do
   * not store it as a column), so the user is editing relative to
   * "what's currently logged = 1 unit of this row". */
  startingServings?: number
}

const SERVINGS_MIN = 0.25
const SERVINGS_MAX = 20
const SERVINGS_STEP = 0.25

function clampServings(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(SERVINGS_MAX, Math.max(SERVINGS_MIN, n))
}

function formatServings(n: number): string {
  return n === Math.floor(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export default function MealItemEditSheet({
  open,
  onClose,
  entryId,
  foodLabel,
  baseCalories,
  startingServings = 1,
}: MealItemEditSheetProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [servings, setServings] = useState(startingServings)

  // Live preview multiplies the current calories by the ratio. When
  // the user opens the sheet at "1.0", baseCalories is already the
  // displayed total, so 1.5 reads as baseCalories * 1.5.
  const previewCalories = Math.round((baseCalories * servings) / startingServings)

  const setClamped = (next: number) => {
    setServings(clampServings(next))
    setError(null)
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/food/log', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: entryId,
            nextServings: servings,
            prevServings: startingServings,
          }),
        })
        if (!res.ok) {
          // Revert by closing without refresh; the row keeps its prior
          // value. NC voice: short, kind, explanatory.
          setError("That didn't save. Want to try again?")
          return
        }
        onClose()
        router.refresh()
      } catch {
        setError("That didn't save. Want to try again?")
      }
    })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Edit servings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-relaxed)',
          }}
        >
          {foodLabel}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-3)',
          }}
        >
          <span style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)' }}>
            Servings
          </span>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--v2-border)',
              borderRadius: 'var(--v2-radius-full)',
              background: 'var(--v2-bg-card)',
            }}
          >
            <button
              type="button"
              onClick={() => setClamped(servings - SERVINGS_STEP)}
              disabled={servings <= SERVINGS_MIN || pending}
              aria-label="Decrease servings"
              style={stepperBtn(servings <= SERVINGS_MIN)}
            >
              {'−'}
            </button>
            <span
              aria-live="polite"
              style={{
                minWidth: 56,
                textAlign: 'center',
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
              disabled={servings >= SERVINGS_MAX || pending}
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
            fontSize: 'var(--v2-text-base)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'center',
            padding: 'var(--v2-space-3)',
            background: 'var(--v2-bg-card)',
            borderRadius: 'var(--v2-radius-md)',
            border: '1px solid var(--v2-border-subtle)',
          }}
        >
          {previewCalories} cal
        </div>

        {error && (
          <p
            role="alert"
            style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 'var(--v2-space-2)' }}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleSave}
            disabled={pending || servings === startingServings}
          >
            {pending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

function stepperBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    border: 0,
    background: 'transparent',
    color: disabled ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
    fontSize: 20,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  }
}
