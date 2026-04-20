/*
 * Banner
 *
 * For important notices and red flags. Four intents map to Oura's
 * observed color vocabulary:
 *   - info:    teal (accent-primary)
 *   - warning: terracotta ("Pay attention")
 *   - danger:  red (destructive)
 *   - success: green
 */
import { ReactNode } from 'react'

export type BannerIntent = 'info' | 'warning' | 'danger' | 'success'

export interface BannerProps {
  intent?: BannerIntent
  title: ReactNode
  body?: ReactNode
  trailing?: ReactNode
  onDismiss?: () => void
}

const INTENT_MAP: Record<BannerIntent, { accent: string; soft: string }> = {
  info: { accent: 'var(--v2-accent-primary)', soft: 'var(--v2-accent-primary-soft)' },
  warning: { accent: 'var(--v2-accent-warning)', soft: 'rgba(217, 119, 92, 0.15)' },
  danger: { accent: 'var(--v2-accent-danger)', soft: 'rgba(239, 93, 93, 0.15)' },
  success: { accent: 'var(--v2-accent-success)', soft: 'rgba(106, 207, 137, 0.15)' },
}

export default function Banner({ intent = 'info', title, body, trailing, onDismiss }: BannerProps) {
  const { accent, soft } = INTENT_MAP[intent]
  return (
    <div
      role={intent === 'danger' || intent === 'warning' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3) var(--v2-space-4)',
        borderRadius: 'var(--v2-radius-md)',
        background: soft,
        border: `1px solid ${accent}`,
        color: 'var(--v2-text-primary)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--v2-text-base)', fontWeight: 'var(--v2-weight-semibold)', color: accent }}>
          {title}
        </div>
        {body && (
          <div style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', marginTop: 2, lineHeight: 'var(--v2-leading-relaxed)' }}>
            {body}
          </div>
        )}
      </div>
      {trailing}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            border: 0,
            background: 'transparent',
            color: 'var(--v2-text-muted)',
            cursor: 'pointer',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            fontSize: 18,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
