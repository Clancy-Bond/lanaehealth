/**
 * PrimaryInsightCard
 *
 * The single most important sentence on the home screen. Renders the
 * insight synchronously from local data so SSR is complete in one
 * paint, no Suspense flash. A future Claude-routed upgrade can swap
 * in a richer sentence, but the local version is always shippable.
 *
 * See docs/v2-design-system.md §6 (G3 honest-with-context): the
 * `source` line is required, not decorative.
 */
import { Card } from '@/v2/components/primitives'
import type { PrimaryInsight } from '@/lib/v2/primary-insight'

export interface PrimaryInsightCardProps {
  insight: PrimaryInsight
}

export default function PrimaryInsightCard({ insight }: PrimaryInsightCardProps) {
  return (
    <Card variant="explanatory" padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-surface-explanatory-muted)',
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
            fontSize: 'var(--v2-text-lg)',
            fontWeight: 'var(--v2-weight-semibold)',
            lineHeight: 'var(--v2-leading-normal)',
            color: 'var(--v2-surface-explanatory-text)',
          }}
        >
          {insight.sentence}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-surface-explanatory-muted)',
            lineHeight: 'var(--v2-leading-normal)',
          }}
        >
          {insight.source}
        </p>
      </div>
    </Card>
  )
}
