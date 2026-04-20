/*
 * ListRow
 *
 * Oura's Contributors list and MFN's food list share this shape:
 * leading icon + label + subtext + trailing value / chevron. A
 * hairline bottom divider (unless the last row).
 */
import { ReactNode } from 'react'

export interface ListRowProps {
  leading?: ReactNode
  label: ReactNode
  subtext?: ReactNode
  trailing?: ReactNode
  /** Show a chevron on the right. Pairs with `onClick`. */
  chevron?: boolean
  divider?: boolean
  onClick?: () => void
  /** Semantic intent for the subtext text color (e.g. 'warning'). */
  intent?: 'default' | 'warning' | 'success'
}

export default function ListRow({
  leading,
  label,
  subtext,
  trailing,
  chevron,
  divider = true,
  onClick,
  intent = 'default',
}: ListRowProps) {
  const subtextColor =
    intent === 'warning'
      ? 'var(--v2-accent-warning)'
      : intent === 'success'
        ? 'var(--v2-accent-success)'
        : 'var(--v2-text-muted)'

  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
        minHeight: 'var(--v2-touch-target-min)',
        padding: 'var(--v2-space-3) 0',
        borderBottom: divider ? '1px solid var(--v2-border-subtle)' : 'none',
        background: 'transparent',
        border: 0,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomStyle: divider ? 'solid' : 'none',
        borderBottomColor: divider ? 'var(--v2-border-subtle)' : 'transparent',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
        color: 'inherit',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {leading && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--v2-text-secondary)' }}>
          {leading}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--v2-text-base)', color: 'var(--v2-text-primary)', fontWeight: 'var(--v2-weight-medium)' }}>
          {label}
        </div>
        {subtext && (
          <div style={{ fontSize: 'var(--v2-text-sm)', color: subtextColor, marginTop: 2 }}>
            {subtext}
          </div>
        )}
      </div>
      {trailing && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--v2-space-1)',
            fontSize: 'var(--v2-text-base)',
            color: subtextColor,
          }}
        >
          {trailing}
        </div>
      )}
      {chevron && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--v2-text-muted)', flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Wrapper>
  )
}
