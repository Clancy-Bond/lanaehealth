/*
 * AtAGlanceCard
 *
 * Compact 3-tile metric strip derived from the summary object: 30-day
 * median peak rise, positive tests in the last 60 days, and all-time
 * total. Mirrors the Oura frame_0050 tile strip so trend context is
 * readable in a glance without scrolling.
 */
import { Card, MetricTile } from '@/v2/components/primitives'

export interface AtAGlanceCardProps {
  median30dPeakRise: number | null
  positiveLast60Days: number
  totalTests: number
}

export default function AtAGlanceCard({
  median30dPeakRise,
  positiveLast60Days,
  totalTests,
}: AtAGlanceCardProps) {
  const medianValue =
    median30dPeakRise === null ? (
      <span
        style={{
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-muted)',
          fontWeight: 'var(--v2-weight-medium)',
        }}
      >
        No recent tests
      </span>
    ) : (
      <span>
        {median30dPeakRise}
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            color: 'var(--v2-text-muted)',
            marginLeft: 2,
            fontWeight: 'var(--v2-weight-medium)',
          }}
        >
          {' '}
          bpm
        </span>
      </span>
    )

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--v2-space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--v2-tracking-wide)',
          }}
        >
          At a glance
        </span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--v2-space-2)',
          }}
        >
          <MetricTile
            value={medianValue}
            label="30-day median peak rise"
          />
          <MetricTile value={positiveLast60Days} label="Positive (60 days)" />
          <MetricTile value={totalTests} label="All-time tests" />
        </div>
      </div>
    </Card>
  )
}
