/*
 * MetricTile
 *
 * Oura home screen chip: icon + big number + small caption.
 * Rendered as a horizontally-scrolling row on the home tile strip.
 * Observed on frame_0001.png: Readiness 79 / Sleep 83 / Activity 62 /
 * Cycle day 551 with a leading icon glyph above each number.
 */
import { ReactNode } from 'react'

export interface MetricTileProps {
  icon?: ReactNode
  value: ReactNode
  label: string
  color?: string
  onClick?: () => void
}

export default function MetricTile({ icon, value, label, color = 'var(--v2-text-primary)', onClick }: MetricTileProps) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--v2-space-1)',
        minWidth: 72,
        minHeight: 88,
        padding: `var(--v2-space-2) var(--v2-space-3)`,
        borderRadius: 'var(--v2-radius-lg)',
        border: '1px solid var(--v2-border)',
        background: 'var(--v2-bg-card)',
        color: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        transition: 'background var(--v2-duration-fast) var(--v2-ease-standard)',
      }}
    >
      {icon && (
        <span style={{ fontSize: 18, color: 'var(--v2-text-secondary)', lineHeight: 1 }}>{icon}</span>
      )}
      <span style={{ fontSize: 'var(--v2-text-xl)', fontWeight: 'var(--v2-weight-semibold)', color, lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', lineHeight: 1 }}>{label}</span>
    </Wrapper>
  )
}
