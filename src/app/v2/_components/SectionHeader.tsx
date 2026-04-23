/**
 * SectionHeader
 *
 * Small uppercase-eyebrow + optional trailing link used between
 * scrollable sections on home, patterns, and sleep. Mirrors the
 * "CONTRIBUTORS" / "TRENDS" headings observed on Oura's drill-down
 * screens.
 */
import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  eyebrow: string
  title?: ReactNode
  trailing?: ReactNode
}

export default function SectionHeader({ eyebrow, title, trailing }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--v2-space-3)',
        paddingTop: 'var(--v2-space-2)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            fontWeight: 'var(--v2-weight-medium)',
          }}
        >
          {eyebrow}
        </span>
        {title && (
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-lg)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            {title}
          </h2>
        )}
      </div>
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </div>
  )
}
