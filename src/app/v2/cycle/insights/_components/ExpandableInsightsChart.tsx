'use client'

/*
 * ExpandableInsightsChart
 *
 * Closes Tier 6a from docs/research/cycle-nc-substantive-gaps.md. NC's
 * primary BBT chart (frame_0117 / 0123 / 0125 / 0128 / 0130) is
 * landscape-oriented so each cycle day gets enough horizontal real
 * estate that the post-ovulation thermal shift reads at a glance. Our
 * embedded portrait chart squeezes ~28 days into ~311px on a 375pt
 * viewport, which can make the shift look like noise.
 *
 * Rather than implement literal CSS rotation (browser quirks,
 * accessibility breakage, scrollbar weirdness), this wrapper opens a
 * full-screen Sheet that renders the same `CycleInsightsChart` at the
 * sheet's full width and at ~480px height. The chart's internal
 * `ResizeObserver` picks up the new container dimensions
 * automatically, so no chart-side change is needed.
 *
 * Both renderings are the SAME chart, sharing the same data props, so
 * tap-to-snapshot and the phase legend chips are fully functional in
 * either view.
 */
import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { Sheet } from '@/v2/components/primitives'
import CycleInsightsChart, {
  type InsightsBbtPoint,
} from './CycleInsightsChart'

export interface ExpandableInsightsChartProps {
  current: InsightsBbtPoint[]
  prior?: InsightsBbtPoint[] | null
  coverLine: number | null
  meanCycleLength: number | null
}

export default function ExpandableInsightsChart(props: ExpandableInsightsChartProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--v2-space-2)',
          margin: '0 0 var(--v2-space-3)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-md)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          Temperature pattern
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Expand temperature chart for landscape view"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 'var(--v2-space-2) var(--v2-space-3)',
            borderRadius: 'var(--v2-radius-full)',
            border: '1px solid var(--v2-border-subtle)',
            background: 'var(--v2-bg-card)',
            color: 'var(--v2-text-secondary)',
            fontSize: 'var(--v2-text-xs)',
            fontWeight: 'var(--v2-weight-medium)',
            fontFamily: 'inherit',
            cursor: 'pointer',
            minHeight: 'var(--v2-touch-target-min)',
          }}
        >
          <Maximize2 size={12} aria-hidden />
          Expand
        </button>
      </div>

      {/* Embedded chart, same component, default dimensions. */}
      <CycleInsightsChart {...props} />

      {/*
       * Expanded sheet. The chart re-mounts inside the sheet so its
       * ResizeObserver re-measures against the wider container. We
       * wrap in a tall fixed-height container so the chart's
       * width:100% inside CycleInsightsChart can read a generous
       * pixel value rather than hitting a flex-shrunk-to-zero parent.
       */}
      <Sheet open={open} onClose={() => setOpen(false)} title="Temperature pattern">
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--v2-space-3)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-secondary)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            {"The full-width view gives each cycle day more horizontal room so the post-ovulation thermal shift is easier to spot. Tap any data point to see that day's BBT, LH test, and cervical mucus snapshot."}
          </p>
          <div data-testid="cycle-insights-chart-expanded">
            <CycleInsightsChart {...props} />
          </div>
        </div>
      </Sheet>
    </>
  )
}
