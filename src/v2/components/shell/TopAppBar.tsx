/*
 * TopAppBar
 *
 * Oura-style top bar. Variant `standard` is a 56pt bar with
 * optional leading back arrow and trailing action. Variant `large`
 * is a 112pt bar where the title sits on its own row below the
 * leading/trailing actions (matches Oura's Readiness/Activity
 * screens).
 */
import { ReactNode } from 'react'

export interface TopAppBarProps {
  title?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  variant?: 'standard' | 'large'
  /**
   * When true, the bar fades its background to transparent so
   * imagery behind (e.g. a study card) shows through. Oura uses
   * this on the home screen.
   */
  transparent?: boolean
}

export default function TopAppBar({
  title,
  leading,
  trailing,
  variant = 'standard',
  transparent = false,
}: TopAppBarProps) {
  const isLarge = variant === 'large'
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: transparent ? 'transparent' : 'var(--v2-bg-primary)',
        borderBottom: transparent ? 'none' : '1px solid var(--v2-border-subtle)',
        minHeight: isLarge ? 'var(--v2-topbar-height-large)' : 'var(--v2-topbar-height)',
        display: 'flex',
        flexDirection: isLarge ? 'column' : 'row',
        alignItems: isLarge ? 'stretch' : 'center',
        gap: isLarge ? 'var(--v2-space-2)' : 'var(--v2-space-3)',
        padding: isLarge
          ? 'var(--v2-space-3) var(--v2-space-4) var(--v2-space-4)'
          : '0 var(--v2-space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'var(--v2-touch-target-min)',
        }}
      >
        <div style={{ minWidth: 44, display: 'flex', alignItems: 'center' }}>
          {leading}
        </div>
        {!isLarge && title && (
          <h1
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h1>
        )}
        <div style={{ minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {trailing}
        </div>
      </div>
      {isLarge && title && (
        <h1
          style={{
            fontSize: 'var(--v2-text-3xl)',
            fontWeight: 'var(--v2-weight-bold)',
            color: 'var(--v2-text-primary)',
            margin: 0,
            letterSpacing: 'var(--v2-tracking-tight)',
          }}
        >
          {title}
        </h1>
      )}
    </header>
  )
}
