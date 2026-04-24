'use client'

/*
 * BbtChartPanel
 *
 * Client wrapper around BbtChart that adds NC's "Temperature pattern"
 * panel header (label + tap-to-explain affordance), the chart itself,
 * and a CoverLineExplainer modal. The header tap target opens the
 * explainer in place, mirroring the metric-strip pattern from the home
 * surface (PR #45) and the BbtTile / FertilityAwarenessCard pattern in
 * this same folder.
 *
 * The panel is the place to hold knowledge about the chart context
 * (cover line, ovulation shift detected). The chart itself stays
 * presentational so it can be reused for cycle comparisons later.
 */
import { useState } from 'react'
import { Card } from '@/v2/components/primitives'
import BbtChart, { type BbtReading } from './BbtChart'
import { CoverLineExplainer } from './MetricExplainers'

export interface BbtChartPanelProps {
  readings: BbtReading[]
  coverLine: number | null
  shiftDetected: boolean
  /** Compact variant for embedding (no header label, smaller margins). */
  compact?: boolean
}

export default function BbtChartPanel({
  readings,
  coverLine,
  shiftDetected,
  compact = false,
}: BbtChartPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card padding={compact ? 'sm' : 'md'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
        <button
          type="button"
          aria-label="Open temperature pattern explainer"
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-2)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--v2-tracking-wide)',
              fontWeight: 'var(--v2-weight-semibold)',
            }}
          >
            Temperature pattern
          </span>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
              borderBottom: '1px dotted var(--v2-text-muted)',
            }}
          >
            What is this?
          </span>
        </button>

        <BbtChart readings={readings} coverLine={coverLine} />

        {!compact && readings.length > 0 && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            Your temperature usually rises after ovulation. The shift you see
            here is what we use to confirm it.
          </p>
        )}
      </div>

      <CoverLineExplainer
        open={open}
        onClose={() => setOpen(false)}
        coverLine={coverLine}
        shiftDetected={shiftDetected}
      />
    </Card>
  )
}
