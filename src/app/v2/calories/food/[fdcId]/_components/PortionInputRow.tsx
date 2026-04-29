'use client'

/**
 * PortionInputRow
 *
 * MFN parity row directly under the photo banner. Matches
 * `docs/reference/mynetdiary/frames/full-tour/frame_0045.png` second row:
 *
 *   2 [_____] fl oz                     33 cals
 *   Weight: 60 g
 *
 * The number on the LEFT is the AMOUNT in the selected unit, not a
 * multiplier of "servings." MFN shows "2 fl oz" meaning 2 fluid
 * ounces, not "2 servings of 1 fl oz." This component honors that
 * convention by displaying `selectedPortion.amount * servings` and
 * deriving servings back from any user edit:
 *
 *     servings = userTypedAmount / selectedPortion.amount
 *
 * For pre-portioned foods (USDA Foundation entries report per-100g),
 * the portion arrives as `{ amount: 100, unit: 'g' }`. The user sees
 * "100 g" not "1 g," and editing to "200" sends servings=2 to the
 * meal log.
 *
 * RIGHT column shows total calories scaled by the multiplier. The
 * existing FoodDetailContext does the per-portion scaling once;
 * we multiply that by `servings` here so a 2x edit doubles the cals
 * in the same render with no fetch.
 */
import { useFoodDetail } from './FoodDetailHero'

const MIN_MULT = 0.05
const MAX_MULT = 99

export interface PortionInputRowProps {
  /** Portion multiplier (1.0 = exactly one serving of selectedPortion).
   *  Owned by FoodDetailServingsState and threaded through to
   *  AddToMealForm so the Log POST sends the right `servings` value. */
  value: number
  onChange: (next: number) => void
}

export default function PortionInputRow({ value, onChange }: PortionInputRowProps) {
  const { scaled, selectedPortion, gramsEaten, selectedUnit, unitAmount, setUnitAmount } = useFoodDetail()

  // Two display modes:
  //
  //   1. UNIT mode (selectedUnit !== null): the user picked a chip
  //      like "oz" or "ml". The numeric input is the typed amount IN
  //      that unit. gramsEaten already accounts for the conversion
  //      via unitAmountToGrams() in FoodDetailContext, so the cal
  //      total scaling re-uses that.
  //
  //   2. PORTION mode (selectedUnit === null): existing behavior --
  //      the input is `selectedPortion.amount * value` ("100" for a
  //      "100 g" portion, "1" for a "1 medium banana" portion).
  //
  // The two modes share the visual layout (input + unit label on
  // left, big calorie total on right) so the user perceives a single
  // affordance regardless of which mode they're in.
  const inUnitMode = selectedUnit !== null
  const baseAmount = selectedPortion.amount && selectedPortion.amount > 0 ? selectedPortion.amount : 1
  const displayedAmount = inUnitMode ? unitAmount : baseAmount * value
  const totalCalories =
    scaled.calories !== null
      ? Math.round(scaled.calories * (inUnitMode ? 1 : value))
      : null
  const totalGrams = Math.round(inUnitMode ? gramsEaten : gramsEaten * value)
  const unitLabel = inUnitMode
    ? selectedUnit!.unit
    : formatUnit(selectedPortion.label, selectedPortion.unit)

  return (
    <section
      aria-label="Portion and calories"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'flex-start',
        columnGap: 'var(--v2-space-4)',
        padding: 'var(--v2-space-4)',
        background: 'var(--v2-bg-card)',
        borderBottom: '1px solid var(--v2-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--v2-space-2)',
            color: 'var(--v2-accent-primary)',
          }}
        >
          <input
            type="number"
            inputMode="decimal"
            min={inUnitMode ? MIN_MULT : baseAmount * MIN_MULT}
            max={inUnitMode ? 9999 : baseAmount * MAX_MULT}
            step="0.1"
            value={formatInputValue(displayedAmount)}
            onChange={(e) => {
              const typed = Number(e.target.value)
              if (!Number.isFinite(typed) || typed <= 0) return
              if (inUnitMode) {
                // Unit mode: typed value is the amount IN the selected
                // unit. Push it straight into context; gramsEaten +
                // calorie scaling refresh in the next render.
                setUnitAmount(Math.max(MIN_MULT, Math.min(9999, typed)))
              } else {
                // Portion mode: typed value is the amount in the
                // portion's own unit ("3" for "3 cups"); convert back
                // to the multiplier the AddToMealForm expects.
                const nextMult = typed / baseAmount
                onChange(Math.max(MIN_MULT, Math.min(MAX_MULT, nextMult)))
              }
            }}
            aria-label="Portion amount"
            style={{
              width: 80,
              border: 0,
              borderBottom: '2px solid currentColor',
              background: 'transparent',
              color: 'currentColor',
              fontSize: 'var(--v2-text-2xl)',
              fontWeight: 'var(--v2-weight-bold)',
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              padding: '2px 0',
              outline: 'none',
              textAlign: 'left',
              MozAppearance: 'textfield',
            }}
          />
          <span
            style={{
              fontSize: 'var(--v2-text-base)',
              color: 'var(--v2-text-secondary)',
              fontWeight: 'var(--v2-weight-medium)',
            }}
          >
            {unitLabel}
          </span>
        </div>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Weight: {totalGrams > 0 ? `${totalGrams} g` : 'N/A'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--v2-space-1)',
          color: 'var(--v2-accent-primary)',
        }}
      >
        <span
          aria-live="polite"
          style={{
            fontSize: 'var(--v2-text-3xl)',
            fontWeight: 'var(--v2-weight-bold)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {totalCalories !== null ? totalCalories : '--'}
        </span>
        <span
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            fontWeight: 'var(--v2-weight-medium)',
          }}
        >
          cals
        </span>
      </div>
    </section>
  )
}

/**
 * Render the input value tightly. Whole numbers drop the decimal so
 * `100 g` shows as `100` not `100.0`. Fractional values keep up to two
 * decimals and trim trailing zeros so `2.5` stays `2.5` and `2.50`
 * collapses to `2.5`.
 */
function formatInputValue(n: number): string {
  if (n === Math.floor(n)) return String(n)
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * Trailing unit label.
 *
 * USDA portions arrive in two flavors:
 *   - amount + unit (e.g. amount=2, unit='fl oz') → render `fl oz`
 *   - label only (e.g. label='1 medium banana')   → render `medium banana`
 *
 * Strip a leading numeric prefix from labels because the numeric
 * input on the left already shows it; otherwise the row reads "1 1
 * medium banana" which is wrong.
 */
function formatUnit(label: string, unit: string | null | undefined): string {
  if (unit && unit.trim()) return unit
  const stripped = label.replace(/^\s*(?:\d+(?:\.\d+)?|\d+\/\d+)\s*/, '')
  return stripped || label || 'serving'
}
