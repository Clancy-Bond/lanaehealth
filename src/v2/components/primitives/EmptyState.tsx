/*
 * EmptyState
 *
 * Illustration slot + headline + subtext + CTA. Voice follows
 * Natural Cycles: short, kind, explanatory : never just "No data."
 * See docs/reference/natural-cycles/flows.md for copy patterns.
 */
import { ReactNode } from 'react'

export interface EmptyStateProps {
  illustration?: ReactNode
  headline: string
  subtext?: string
  cta?: ReactNode
}

export default function EmptyState({ illustration, headline, subtext, cta }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--v2-space-8) var(--v2-space-5)',
        gap: 'var(--v2-space-3)',
      }}
    >
      {illustration && (
        <div style={{ fontSize: 48, color: 'var(--v2-text-muted)', lineHeight: 1 }}>{illustration}</div>
      )}
      <h3
        style={{
          fontSize: 'var(--v2-text-lg)',
          fontWeight: 'var(--v2-weight-semibold)',
          color: 'var(--v2-text-primary)',
          margin: 0,
        }}
      >
        {headline}
      </h3>
      {subtext && (
        <p
          style={{
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-muted)',
            lineHeight: 'var(--v2-leading-relaxed)',
            margin: 0,
            maxWidth: 320,
          }}
        >
          {subtext}
        </p>
      )}
      {cta && <div style={{ marginTop: 'var(--v2-space-2)' }}>{cta}</div>}
    </div>
  )
}
