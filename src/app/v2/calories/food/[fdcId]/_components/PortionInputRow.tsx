'use client'

/**
 * PortionInputRow
 *
 * MFN parity row directly under the photo banner. Matches
 * `docs/reference/mynetdiary/frames/full-tour/frame_0045.png` second row:
 *
 *   2 [_____] fl oz                     33 cals
 *   Weight: N/A
 *
 * LEFT column:
 *   - Numeric input bound to selectedPortion. Reuses the existing
 *     FoodDetailContext so the chip strip and nutrient table re-scale
 *     in the same render. The user can type any positive multiplier;
 *     internally we treat it as `servings` and multiply gramWeight by
 *     it for the nutrient scaling, mirroring AddToMealForm's contract.
 *   - Trailing unit chip showing `selectedPortion.unit` (or the label
 *     when unit is absent).
 *   - Muted "Weight: <grams> g" caption beneath, since users skim grams
 *     when comparing portions.
 *
 * RIGHT column:
 *   - Big blue calorie total in `--v2-text-3xl`. "cals" muted suffix.
 *
 * The right column is read-only. Tapping the input on the left puts
 * the cursor on the number; the chip strip below this row remains the
 * primary way to choose a unit (cup/tbsp/etc.).
 */
import { useFoodDetail } from './FoodDetailHero'

const MIN_MULT = 0.1
const MAX_MULT = 99

export interface PortionInputRowProps {
  /**
   * Multiplier applied to the selected portion. 1 = exactly one
   * portion. The page-level state (servings in AddToMealForm) is the
   * source of truth; this row reads + writes the same value via the
   * `value` / `onChange` props passed in from the page wrapper.
   */
  value: number
  onChange: (next: number) => void
}

export default function PortionInputRow({ value, onChange }: PortionInputRowProps) {
  const { scaled, selectedPortion, gramsEaten } = useFoodDetail()
  // The hero's `scaled.calories` is per-portion; multiply by the
  // user-entered portion count to mirror MFN's behavior where the
  // input value directly drives the total on the right.
  const totalCalories = scaled.calories !== null ? Math.round(scaled.calories * value) : null
  const totalGrams = Math.round(gramsEaten * value)
  const unitLabel = formatUnit(selectedPortion.label, selectedPortion.unit)

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
            min={MIN_MULT}
            max={MAX_MULT}
            step="0.1"
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n)) return
              onChange(Math.max(MIN_MULT, Math.min(MAX_MULT, n)))
            }}
            aria-label="Portion amount"
            style={{
              width: 64,
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
              // Hide the spin buttons - the chip strip below + this
              // tap-to-edit input are the primary affordances.
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
 * Format the trailing unit label MFN-style.
 *
 * USDA portions arrive in two flavors:
 *   - amount + unit (e.g. amount=2, unit='fl oz') → render `fl oz`
 *   - label only (e.g. label='1 medium banana')   → render `medium`
 *
 * We strip the leading numeric component from labels because the
 * numeric input on the left already shows it; otherwise the row reads
 * "1 1 medium banana" which is wrong.
 */
function formatUnit(label: string, unit: string | null | undefined): string {
  if (unit && unit.trim()) return unit
  // Drop a leading numeric prefix from the label.
  const stripped = label.replace(/^\s*(?:\d+(?:\.\d+)?|\d+\/\d+)\s*/, '')
  return stripped || label || 'serving'
}
