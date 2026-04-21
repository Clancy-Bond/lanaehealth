'use client'

/*
 * TabStrip
 *
 * Horizontal scrollable tab strip for larger tab sets (6+). Complements
 * SegmentedControl, which is sized for 2-5 segments. Active tab
 * auto-scrolls into view on mount and on change, important on narrow
 * viewports where the full set overflows.
 *
 * Callers: v2 calories search (8 tabs: Search / Scan / Favorites /
 * Staples / Custom / My meals / My recipes / Recent). Added as
 * foundation after Session 02 validated the pattern.
 */

import { useEffect, useRef } from 'react'

export interface TabItem<T extends string = string> {
  key: T
  label: string
  count?: number
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
              padding: '0 var(--v2-space-4)',
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
            }}
          >
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
          </button>
        )
      })}
    </div>
  )
}
