'use client'

/**
 * PortionChipStrip
 *
 * MFN parity. Mirrors `docs/reference/mynetdiary/frames/full-tour/
 * frame_0045.png` chip strip: portions wrap to multiple rows (NOT a
 * single horizontal scroll), each chip is a rounded-md rectangle with
 * a light gray fill, the selected chip has a primary-color border +
 * primary-color text, and the trailing chip is a green-tinted
 * "Portion Guide" with a magnifier icon.
 *
 * The previous design used a horizontal scroll of pill-shaped chips
 * with grams labels inside each chip. User feedback (2026-04-27)
 * identified this as one of several elements that "is nothing like my
 * net diary." Replaced wholesale here.
 *
 * The chip strip writes selectedIndex on tap and the rest of the
 * page (PortionInputRow, NutritionFactsCardV2, AddToMealForm)
 * re-renders from the same FoodDetailContext. No network.
 *
 * Tapping the trailing "Portion Guide" chip opens a Sheet with the
 * full set of common kitchen-weight references plus the food's
 * USDA-reported portions, labelled with their gram weight, so the
 * user can pick from a denser list when the visible chip strip is
 * too short or doesn't carry the right unit.
 */
import { useState } from 'react'
import Sheet from '@/v2/components/primitives/Sheet'
import type { FoodPortion } from '@/lib/api/usda-portions'
import { UNIT_OPTIONS, type UnitOption } from '@/lib/api/unit-options'
import { useFoodDetail } from './FoodDetailHero'

export default function PortionChipStrip() {
  const {
    portions,
    selectedIndex,
    setSelectedIndex,
    selectedUnit,
    setSelectedUnit,
  } = useFoodDetail()
  const [guideOpen, setGuideOpen] = useState(false)
  if (portions.length === 0) return null

  return (
    <>
      <section
        aria-label="Portion options"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--v2-space-2)',
          padding: 'var(--v2-space-4)',
          background: 'var(--v2-bg-card)',
          borderBottom: '1px solid var(--v2-border-subtle)',
        }}
      >
        {/* USDA-reported portions ("1 medium banana", "100 g"). Tapping
         *  one of these clears unit-mode and uses the portion's own
         *  gram weight. */}
        {portions.map((p, i) => (
          <PortionChip
            key={`${p.label}-${p.gramWeight}-${i}`}
            label={p.label}
            isActive={selectedUnit === null && i === selectedIndex}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
        {/* Universal unit chips (g/mg/kg/oz/lb/ml/L/fl oz/cup/tbsp/tsp).
         *  Tapping one of these clears the USDA-portion selection and
         *  flips the picker into unit-mode -- the inline numeric input
         *  in PortionInputRow then represents the typed amount IN that
         *  unit and the calorie total recomputes via the conversion
         *  factor in unit-options.ts. */}
        {UNIT_OPTIONS.map((u) => (
          <UnitChip
            key={u.unit}
            unit={u}
            isActive={selectedUnit?.unit === u.unit}
            onClick={() => setSelectedUnit(u)}
          />
        ))}
        <PortionGuideChip onOpen={() => setGuideOpen(true)} />
      </section>
      <PortionGuideSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        portions={portions}
        selectedIndex={selectedIndex}
        onPick={(i) => {
          setSelectedIndex(i)
          setGuideOpen(false)
        }}
      />
    </>
  )
}

/**
 * UnitChip — a universal unit option (g, oz, ml, cup, tbsp, etc.).
 *
 * Visually distinct from PortionChip: the icon-less label is
 * surrounded by a slightly different border color so the user can
 * tell at a glance "these are units I type into, those are
 * pre-shaped portions."
 *
 * Volume units carry a tiny "≈" prefix in the active state so the
 * user knows volume conversions assume water density and aren't
 * exact for solid foods. Mass units are exact and have no marker.
 */
function UnitChip({
  unit,
  isActive,
  onClick,
}: {
  unit: UnitOption
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      aria-label={
        unit.isVolume
          ? `Use ${unit.unit} (volume, approximate)`
          : `Use ${unit.unit}`
      }
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        minHeight: 36,
        padding: '0 var(--v2-space-3)',
        border: `1.5px solid ${isActive ? 'var(--v2-accent-primary)' : 'var(--v2-border-subtle)'}`,
        background: isActive ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-surface)',
        color: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
        borderRadius: 'var(--v2-radius-md)',
        fontSize: 'var(--v2-text-sm)',
        fontWeight: isActive ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
    >
      {unit.isVolume && isActive ? '≈ ' : ''}
      {unit.unit}
    </button>
  )
}

function PortionChip({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        minHeight: 36,
        padding: '0 var(--v2-space-3)',
        border: `1.5px solid ${isActive ? 'var(--v2-accent-primary)' : 'transparent'}`,
        background: isActive ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-surface)',
        color: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
        borderRadius: 'var(--v2-radius-md)',
        fontSize: 'var(--v2-text-sm)',
        fontWeight: isActive ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Trailing "Portion Guide" chip. Green-tinted to match MFN's accent
 * color for helper actions. Tapping it opens PortionGuideSheet, a
 * bottom sheet that lists every parsed portion with its gram weight
 * so the user can pick from a denser list than the inline chip strip.
 */
function PortionGuideChip({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open portion guide"
      onClick={onOpen}
      style={{
        flex: '0 0 auto',
        minHeight: 36,
        padding: '0 var(--v2-space-3)',
        border: '1.5px solid transparent',
        background: 'rgba(67, 160, 121, 0.12)',
        color: '#3F8F69',
        borderRadius: 'var(--v2-radius-md)',
        fontSize: 'var(--v2-text-sm)',
        fontWeight: 'var(--v2-weight-semibold)',
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <MagnifierIcon />
      Portion Guide
    </button>
  )
}

/**
 * PortionGuideSheet
 *
 * Bottom sheet listing every parsed portion in a single tap-to-pick
 * list. Each row shows the portion label on the left ("1 cup (240 g)",
 * "1 medium banana") and the underlying gram weight on the right
 * (right-aligned, tabular). The currently-selected portion is bolded
 * and tinted plum. Tapping any row sets it as the new portion and
 * closes the sheet.
 *
 * Why a sheet instead of an inline expand: the chip strip is the
 * one-glance fast path; the guide is the "I want to see ALL options
 * including conversions I might not need every day" deeper pick.
 * Matches MFN's "Portion Guide" pattern (frame_0045 trailing chip).
 */
interface PortionGuideSheetProps {
  open: boolean
  onClose: () => void
  portions: FoodPortion[]
  selectedIndex: number
  onPick: (index: number) => void
}

function PortionGuideSheet({ open, onClose, portions, selectedIndex, onPick }: PortionGuideSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Portion guide" explanatory>
      <p
        style={{
          margin: '0 0 var(--v2-space-3)',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.7))',
          lineHeight: 'var(--v2-leading-relaxed)',
        }}
      >
        Pick the portion that matches what you ate. The grams shown on the right
        are how much that portion weighs.
      </p>
      <ul
        role="radiogroup"
        aria-label="Portion options"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {portions.map((p, i) => {
          const isActive = i === selectedIndex
          return (
            <li key={`${p.label}-${p.gramWeight}-${i}`} style={{ width: '100%' }}>
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onPick(i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--v2-space-3)',
                  padding: 'var(--v2-space-3) var(--v2-space-2)',
                  border: 0,
                  borderBottom: '1px solid var(--v2-surface-explanatory-border, rgba(45, 25, 60, 0.06))',
                  background: 'transparent',
                  color: isActive
                    ? 'var(--v2-surface-explanatory-cta, #5B2852)'
                    : 'var(--v2-surface-explanatory-text, #2D193C)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--v2-text-base)',
                  fontWeight: isActive ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  minHeight: 48,
                }}
              >
                <span>{p.label}</span>
                <span
                  style={{
                    fontSize: 'var(--v2-text-sm)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--v2-surface-explanatory-text-muted, rgba(45, 25, 60, 0.6))',
                  }}
                >
                  {Math.round(p.gramWeight)} g
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

function MagnifierIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
