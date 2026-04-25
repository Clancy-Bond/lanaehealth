'use client'

/*
 * FAB (floating action button)
 *
 * Primary action. Default position: bottom-right, above the tab
 * bar. Variant `tab-center` places it between tabs (used by
 * BottomTabBar's centerAction slot). Variant `desktop` pins to
 * top-left (matches legacy QuickLogFab pattern for > 900pt wide
 * viewports; v2 inherits that choice for parity).
 */
import { MouseEventHandler, ReactNode } from 'react'
import { mediumTap } from '@/v2/lib/haptics'

export type FabVariant = 'floating' | 'tab-center' | 'desktop'

export interface FabProps {
  onClick?: MouseEventHandler<HTMLButtonElement>
  label: string
  icon?: ReactNode
  variant?: FabVariant
}

export default function FAB({ onClick, label, icon, variant = 'floating' }: FabProps) {
  const isTabCenter = variant === 'tab-center'
  const positionStyle =
    variant === 'floating'
      ? {
          position: 'fixed' as const,
          right: 'calc(var(--v2-space-4) + var(--v2-safe-right))',
          bottom: `calc(var(--v2-tabbar-height) + var(--v2-safe-bottom) + var(--v2-space-4))`,
        }
      : variant === 'desktop'
        ? {
            position: 'fixed' as const,
            left: 'var(--v2-space-5)',
            top: 'calc(var(--v2-safe-top) + var(--v2-space-16))',
          }
        : { position: 'relative' as const }

  return (
    <button
      type="button"
      onClick={(event) => {
        mediumTap()
        onClick?.(event)
      }}
      aria-label={label}
      className="v2-btn-press"
      style={{
        ...positionStyle,
        width: 'var(--v2-fab-size)',
        height: 'var(--v2-fab-size)',
        borderRadius: 'var(--v2-radius-full)',
        border: 'none',
        background: 'var(--v2-accent-primary)',
        color: 'var(--v2-on-accent)',
        fontSize: 24,
        fontWeight: 'var(--v2-weight-semibold)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isTabCenter ? 'none' : 'var(--v2-shadow-lg)',
        transition: 'transform 120ms var(--v2-ease-standard), background var(--v2-duration-fast) var(--v2-ease-standard)',
        zIndex: 20,
      }}
    >
      {icon ?? '+'}
    </button>
  )
}
