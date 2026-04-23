/*
 * DashboardSideTiles
 *
 * Horizontal-scroll strip of side metrics: Weight, Steps, Active cal,
 * Water, Notes. Each is a `MetricTile` from the v2 primitive set.
 * Nullable values render an em-dash so empty tiles stay legible
 * rather than collapsing to whitespace.
 *
 * Oura-style: the strip scrolls horizontally under a soft mask. Each
 * tile hits the 72pt min-width from MetricTile, so 5 tiles overflow
 * cleanly on 375pt devices.
 */
import { MetricTile } from '@/v2/components/primitives'

export interface DashboardSideTilesProps {
  weightLb: number | null
  steps: number | null
  activeCalories: number | null
  waterGlasses: number
  notes: string | null
}

export default function DashboardSideTiles({
  weightLb,
  steps,
  activeCalories,
  waterGlasses,
  notes,
}: DashboardSideTilesProps) {
  const tiles: Array<{ label: string; value: string; accent?: string }> = [
    {
      label: 'Weight',
      value: weightLb != null ? `${weightLb.toFixed(1)} lb` : '\u2013',
    },
    {
      label: 'Steps',
      value: steps != null ? steps.toLocaleString() : '\u2013',
    },
    {
      label: 'Active cal',
      value: activeCalories != null ? Math.round(activeCalories).toString() : '\u2013',
    },
    {
      label: 'Water',
      value: waterGlasses > 0 ? `${waterGlasses} gl` : '\u2013',
    },
    {
      label: 'Notes',
      value: notes ? '1' : '\u2013',
    },
  ]

  return (
    <div
      role="group"
      aria-label="Other metrics for today"
      style={{
        display: 'flex',
        gap: 'var(--v2-space-2)',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x proximity',
        paddingBottom: 'var(--v2-space-2)',
        scrollbarWidth: 'none',
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            flex: '0 0 auto',
            scrollSnapAlign: 'start',
          }}
        >
          <MetricTile label={t.label} value={t.value} />
        </div>
      ))}
    </div>
  )
}
