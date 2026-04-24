/**
 * PrimaryInsightCard
 *
 * The single most important sentence on the home screen. Renders the
 * insight synchronously from local data so SSR is complete in one
 * paint, no Suspense flash.
 *
 * Chrome: Oura's home "What's new" / "Bedtime's approaching" hero
 * cards (frame_0001, frame_0200) sit in dark mode with a faint
 * tinted gradient, not an inverted NC white card. Previously we
 * surfaced the insight on a cream card which broke the dark-mode
 * continuity right under the date header. This variant keeps the
 * card in-chrome and saves the white explanatory surface for its
 * canonical use: tap-through educational modals.
 *
 * See docs/v2-design-system.md §6 (G3 honest-with-context): the
 * `source` line is required, not decorative.
 */
import type { PrimaryInsight } from '@/lib/v2/primary-insight'

export interface PrimaryInsightCardProps {
  insight: PrimaryInsight
}

export default function PrimaryInsightCard({ insight }: PrimaryInsightCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--v2-radius-lg)',
        border: '1px solid var(--v2-border-subtle)',
        padding: 'var(--v2-space-5)',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, rgba(77, 184, 168, 0.14) 0%, rgba(155, 127, 224, 0.06) 55%, rgba(23, 23, 27, 0) 100%), var(--v2-bg-card)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
            fontWeight: 'var(--v2-weight-medium)',
          }}
        >
          {insight.eyebrow}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-xl)',
            fontWeight: 'var(--v2-weight-medium)',
            lineHeight: 'var(--v2-leading-normal)',
            letterSpacing: 'var(--v2-tracking-tight)',
            color: 'var(--v2-text-primary)',
          }}
        >
          {insight.sentence}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {insight.source}
        </p>
      </div>
    </div>
  )
}
