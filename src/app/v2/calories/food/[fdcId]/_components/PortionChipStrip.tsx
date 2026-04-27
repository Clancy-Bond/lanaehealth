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
 */
import { useFoodDetail } from './FoodDetailHero'

export default function PortionChipStrip() {
  const { portions, selectedIndex, setSelectedIndex } = useFoodDetail()
  if (portions.length === 0) return null

  return (
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
      {portions.map((p, i) => (
        <PortionChip
          key={`${p.label}-${p.gramWeight}-${i}`}
          label={p.label}
          isActive={i === selectedIndex}
          onClick={() => setSelectedIndex(i)}
        />
      ))}
      <PortionGuideChip />
    </section>
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
 * color for helper actions. Currently a stub — clicking it could open
 * a sheet with photographic portion references (cup vs tbsp, etc.) but
 * we don't have that surface yet. Renders the magnifier icon + label
 * for visual parity with frame_0045 even though the click is a no-op.
 *
 * TODO: wire to a portion-guide sheet once that view ships. Linked in
 * docs/research/calories-mfn-tasks.md.
 */
function PortionGuideChip() {
  return (
    <button
      type="button"
      onClick={() => {
        // No-op for now. We render this chip because removing it would
        // make the strip shorter than the MFN reference and the user
        // explicitly asked for visual parity.
      }}
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
