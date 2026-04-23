'use client'

/*
 * PortionChipStrip
 *
 * Horizontal scroll of portion pills sourced from nutrients.portions[].
 * One tap swaps the selected portion index in FoodDetailContext, which
 * re-scales FoodDetailHero, NutritionFactsCardV2, and AddToMealForm in
 * the same render. No network.
 */
import { useEffect, useRef } from 'react'
import { useFoodDetail } from './FoodDetailHero'

export default function PortionChipStrip() {
  const { portions, selectedIndex, setSelectedIndex } = useFoodDetail()
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!activeRef.current) return
    activeRef.current.scrollIntoView({
      behavior: 'smooth', block: 'nearest', inline: 'center',
    })
  }, [selectedIndex])

  if (portions.length === 0) return null

  return (
    <div
      role="radiogroup"
      aria-label="Portion"
      style={{
        display: 'flex', gap: 'var(--v2-space-2)',
        overflowX: 'auto', overflowY: 'hidden',
        paddingBottom: 'var(--v2-space-2)',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        scrollSnapType: 'x proximity',
      }}
    >
      {portions.map((p, i) => {
        const isActive = i === selectedIndex
        // USDA's gramWeight already represents total grams for this
        // portion entry; `amount` is label metadata only.
        const grams = Math.round(p.gramWeight)
        return (
          <button
            key={`${p.label}-${p.gramWeight}-${i}`}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setSelectedIndex(i)}
            style={{
              flex: '0 0 auto',
              minHeight: 'var(--v2-touch-target-min)',
              padding: '0 var(--v2-space-4)',
              border: `1px solid ${isActive ? 'var(--v2-accent-primary)' : 'var(--v2-border)'}`,
              background: isActive ? 'var(--v2-accent-primary-soft)' : 'var(--v2-bg-card)',
              color: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-text-secondary)',
              borderRadius: 'var(--v2-radius-full)',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: isActive ? 'var(--v2-weight-semibold)' : 'var(--v2-weight-medium)',
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              scrollSnapAlign: 'center',
              transition:
                'background var(--v2-duration-fast) var(--v2-ease-standard), color var(--v2-duration-fast) var(--v2-ease-standard), border-color var(--v2-duration-fast) var(--v2-ease-standard)',
            }}
          >
            <span>{p.label}</span>
            <span
              style={{
                marginLeft: 'var(--v2-space-2)',
                fontSize: 'var(--v2-text-xs)',
                color: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {grams} g
            </span>
          </button>
        )
      })}
    </div>
  )
}
