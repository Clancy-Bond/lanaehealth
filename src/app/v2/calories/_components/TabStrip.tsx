'use client'

/*
 * TabStrip
 *
 * FOUNDATION-REQUEST: Promote to `src/v2/components/primitives/TabStrip.tsx`
 * after Session 02 lands. SegmentedControl covers 2-5 segments; TabStrip
 * covers the MFN search top-tabs (8 tabs) and anywhere else a horizontal
 * scrollable tab pattern is needed. Kept section-local for Session 02.
 *
 * Active-tab auto-scrolls into view on mount and on change (important on
 * 375pt viewports where 8 tabs overflow).
 */

import { ReactNode, useEffect, useRef } from 'react'

export interface TabItem<T extends string = string> {
  key: T
  label: string
  count?: number
  /**
   * Optional small icon glyph rendered above the label. Mirrors MFN's
   * search top-tabs (PR: v2-calories-mfn-fidelity-2): each tab pairs a
   * 16x16 SVG with the label, stacking vertically so the row reads as
   * a denser navigation strip rather than a plain text tab bar.
   */
  icon?: ReactNode
}

export interface TabStripProps<T extends string = string> {
  tabs: TabItem<T>[]
  active: T
  onChange?: (key: T) => void
  scrollable?: boolean
  ariaLabel?: string
}

export default function TabStrip<T extends string = string>({
  tabs,
  active,
  onChange,
  scrollable = true,
  ariaLabel,
}: TabStripProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!scrollable || !activeRef.current || !containerRef.current) return
    activeRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [active, scrollable])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 'var(--v2-space-1)',
        overflowX: scrollable ? 'auto' : 'visible',
        overflowY: 'hidden',
        scrollSnapType: scrollable ? 'x proximity' : undefined,
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'var(--v2-space-2)',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(tab.key)}
            style={{
              flex: '0 0 auto',
              minHeight: 'var(--v2-touch-target-min)',
              padding: tab.icon ? 'var(--v2-space-1) var(--v2-space-3)' : '0 var(--v2-space-4)',
              border: 0,
              background: 'transparent',
              color: isActive
                ? 'var(--v2-text-primary)'
                : 'var(--v2-text-muted)',
              fontSize: 'var(--v2-text-sm)',
              fontWeight: isActive
                ? 'var(--v2-weight-semibold)'
                : 'var(--v2-weight-medium)',
              fontFamily: 'inherit',
              cursor: 'pointer',
              scrollSnapAlign: scrollable ? 'center' : undefined,
              borderBottom: '2px solid',
              borderBottomColor: isActive
                ? 'var(--v2-accent-orange)'
                : 'transparent',
              transition:
                'color var(--v2-duration-fast) var(--v2-ease-standard), border-color var(--v2-duration-fast) var(--v2-ease-standard)',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              flexDirection: tab.icon ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tab.icon ? 2 : 0,
            }}
          >
            {tab.icon && (
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'var(--v2-accent-primary)' : 'var(--v2-text-muted)',
                  transition: 'color var(--v2-duration-fast) var(--v2-ease-standard)',
                }}
              >
                {tab.icon}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              {tab.label}
              {typeof tab.count === 'number' && (
                <span
                  style={{
                    marginLeft: 'var(--v2-space-2)',
                    fontSize: 'var(--v2-text-xs)',
                    color: 'var(--v2-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
