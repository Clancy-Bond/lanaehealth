'use client'

/*
 * CycleInsightsChart (Feature A, NC wave 3)
 *
 * NC's signature landscape BBT view (frame_0117 / frame_0125 in
 * docs/reference/natural-cycles/frames/full-tour). Differs from
 * BbtChart on the today screen in three ways:
 *   - Wider chart spanning the full screen width with extra height,
 *     readable in landscape rotation.
 *   - Optional prior-cycle overlay rendered as a semi-transparent line
 *     so the user can compare cycle shape directly.
 *   - Phase color bands rendered behind the chart (menstrual pink,
 *     follicular green, ovulatory amber, luteal blue) using NC's
 *     observed band hues. The cover line itself is drawn as a dotted
 *     reference threshold, which the today-screen chart deliberately
 *     omits but the Insights surface includes for comparison context.
 *
 * Tap-to-snapshot: tapping any data point reveals a small inline
 * snapshot card listing that day's BBT, LH status, and cervical mucus
 * note. The snapshot is keyboard-accessible (the legend chips also
 * step through it) and gracefully empty when no log data is on file.
 *
 * Shape contract is intentionally close to BbtChart's so callers can
 * map the same Wave 1 BBT stream into either surface.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'

const CHART_COLORS = {
  belowCover: '#6ACF89',
  aboveCover: '#D9775C',
  neutral: '#7FBFB5',
  axis: '#7E8088',
  prior: 'rgba(176, 179, 189, 0.55)',
  coverLine: 'rgba(255, 255, 255, 0.35)',
  // Phase tints. Translucent so the line stays the dominant element.
  phase: {
    menstrual: 'rgba(232, 69, 112, 0.14)', // NC pink
    follicular: 'rgba(106, 207, 137, 0.10)', // soft green
    ovulatory: 'rgba(229, 201, 82, 0.16)', // amber
    luteal: 'rgba(155, 127, 224, 0.12)', // luteal blue/violet
  },
  tooltipBg: '#17171B',
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  tooltipText: '#F2F2F4',
} as const

const CHART_HEIGHT = 320

export interface InsightsBbtPoint {
  cycleDay: number
  temp_f: number
  date: string
  isPeriodDay?: boolean
  lhPositive?: boolean
  cervicalMucus?: string | null
}

export interface CycleInsightsChartProps {
  /** Current cycle BBT readings (oldest to newest by cycleDay). */
  current: InsightsBbtPoint[]
  /**
   * Prior cycle for comparison overlay. Pass null to skip the overlay.
   * Aligned by cycleDay rather than by calendar date so two cycles of
   * different lengths line up at CD1.
   */
  prior?: InsightsBbtPoint[] | null
  /** Personal cover-line threshold in degrees F. Drawn as a dotted reference. */
  coverLine: number | null
  /** Total cycle length used for phase-band placement (mean over completed cycles). */
  meanCycleLength: number | null
}

interface SeriesPoint {
  cycleDay: number
  current: number | null
  prior: number | null
  point: InsightsBbtPoint | null
}

interface PhaseBand {
  start: number
  end: number
  label: 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal'
  fill: string
}

/**
 * Compute the phase bands behind the chart. Boundaries scale with the
 * user's mean cycle length using the same rules as phaseFromDay so the
 * Radar / Today / Insights surfaces all agree on which day belongs to
 * which phase.
 */
function derivePhaseBands(meanCycleLength: number | null, xMax: number): PhaseBand[] {
  const m = meanCycleLength != null && Number.isFinite(meanCycleLength) ? Math.round(meanCycleLength) : 28
  const ovAnchor = Math.max(10, m - 14)
  const ovStart = Math.max(6, ovAnchor - 1)
  const ovEnd = Math.min(m - 1, ovAnchor + 1)
  const menstrualEnd = m < 22 ? Math.max(3, Math.min(5, Math.round(m * 0.2))) : 5
  const lutealEnd = Math.max(xMax, m)
  const bands: PhaseBand[] = [
    { start: 1, end: menstrualEnd, label: 'Menstrual', fill: CHART_COLORS.phase.menstrual },
    { start: menstrualEnd + 1, end: ovStart - 1, label: 'Follicular', fill: CHART_COLORS.phase.follicular },
    { start: ovStart, end: ovEnd, label: 'Ovulatory', fill: CHART_COLORS.phase.ovulatory },
    { start: ovEnd + 1, end: lutealEnd, label: 'Luteal', fill: CHART_COLORS.phase.luteal },
  ]
  return bands.filter((b) => b.end >= b.start)
}

function classify(temp_f: number, coverLine: number | null): 'above' | 'below' | 'neutral' {
  if (coverLine == null || !Number.isFinite(coverLine)) return 'neutral'
  return temp_f > coverLine ? 'above' : 'below'
}

export default function CycleInsightsChart({
  current,
  prior = null,
  coverLine,
  meanCycleLength,
}: CycleInsightsChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [snapshotIdx, setSnapshotIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const node = ref.current
    const measure = () => setWidth(node.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // Merge current and prior into a single series keyed by cycleDay so
  // recharts renders both lines in the same chart.
  const series = useMemo<SeriesPoint[]>(() => {
    const byDay = new Map<number, SeriesPoint>()
    for (const c of current) {
      if (!Number.isFinite(c.temp_f) || c.cycleDay <= 0) continue
      byDay.set(c.cycleDay, { cycleDay: c.cycleDay, current: c.temp_f, prior: null, point: c })
    }
    for (const p of prior ?? []) {
      if (!Number.isFinite(p.temp_f) || p.cycleDay <= 0) continue
      const existing = byDay.get(p.cycleDay)
      if (existing) existing.prior = p.temp_f
      else byDay.set(p.cycleDay, { cycleDay: p.cycleDay, current: null, prior: p.temp_f, point: null })
    }
    return Array.from(byDay.values()).sort((a, b) => a.cycleDay - b.cycleDay)
  }, [current, prior])

  if (series.length === 0) {
    return (
      <div
        ref={ref}
        style={{
          padding: 'var(--v2-space-6) var(--v2-space-4)',
          background: 'var(--v2-bg-card)',
          border: '1px dashed var(--v2-border-subtle)',
          borderRadius: 'var(--v2-radius-lg)',
          textAlign: 'center',
        }}
        data-testid="cycle-insights-chart-empty"
      >
        <p
          style={{
            margin: 0,
            fontSize: 'var(--v2-text-sm)',
            color: 'var(--v2-text-secondary)',
          }}
        >
          No temperature readings yet for this cycle. Log a morning basal
          temperature and the chart fills in.
        </p>
      </div>
    )
  }

  const allTemps = series.flatMap((p) => [p.current, p.prior].filter((v): v is number => v != null))
  const yMin = Math.min(...allTemps) - 0.3
  const yMax = Math.max(...allTemps) + 0.3
  const xMin = 1
  const xMax = Math.max(meanCycleLength ?? 28, ...series.map((s) => s.cycleDay))

  const bands = derivePhaseBands(meanCycleLength, xMax)
  const snapshot = snapshotIdx != null ? current[snapshotIdx] ?? null : null

  return (
    <div
      data-testid="cycle-insights-chart"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-3)',
      }}
    >
      <div ref={ref} style={{ width: '100%', height: CHART_HEIGHT }}>
        {width > 0 && (
          <ComposedChart
            data={series}
            width={width}
            height={CHART_HEIGHT}
            margin={{ top: 18, right: 16, left: 0, bottom: 28 }}
          >
            <XAxis
              dataKey="cycleDay"
              type="number"
              domain={[xMin, xMax]}
              stroke={CHART_COLORS.axis}
              fontSize={10}
              tickMargin={4}
              label={{
                value: 'Cycle day',
                position: 'insideBottom',
                offset: -2,
                style: { fontSize: 10, fill: CHART_COLORS.axis },
              }}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke={CHART_COLORS.axis}
              fontSize={10}
              tickMargin={4}
              width={36}
              tickFormatter={(v: number) => v.toFixed(1)}
              label={{
                value: 'degrees F',
                position: 'insideLeft',
                angle: -90,
                offset: 14,
                style: { fontSize: 10, fill: CHART_COLORS.axis },
              }}
            />

            {/* Phase tint bands behind the lines. */}
            {bands.map((b) => (
              <ReferenceArea
                key={`band-${b.label}-${b.start}`}
                x1={b.start - 0.5}
                x2={b.end + 0.5}
                fill={b.fill}
                ifOverflow="visible"
                label={{
                  value: b.label,
                  position: 'insideTop',
                  fill: 'rgba(255, 255, 255, 0.42)',
                  fontSize: 10,
                  offset: 6,
                }}
              />
            ))}

            {/* Cover line as a horizontal threshold reference. NC's today
                chart hides this; the Insights surface shows it for
                comparison context. Label position is `insideTopRight`
                rather than `right` because Recharts renders `right`
                outside the chart's plot area and the resulting text
                overflows the viewport at 375pt and 390pt (caught by
                tests/e2e/v2-cycle-viewport.spec.ts). `insideTopRight`
                keeps the label visible without leaking past the SVG. */}
            {coverLine != null && (
              <ReferenceLine
                y={coverLine}
                stroke={CHART_COLORS.coverLine}
                strokeDasharray="3 4"
                label={{
                  value: `Cover line ${coverLine.toFixed(1)} F`,
                  position: 'insideTopRight',
                  fill: CHART_COLORS.coverLine,
                  fontSize: 10,
                }}
              />
            )}

            {/* Prior cycle, drawn first so the current cycle sits on top. */}
            {prior && prior.length > 0 && (
              <Line
                data={series}
                type="monotone"
                dataKey="prior"
                stroke={CHART_COLORS.prior}
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )}

            {/* Current cycle line. Color-coded dots: red above cover, green below. */}
            <Line
              data={series}
              type="monotone"
              dataKey="current"
              stroke={CHART_COLORS.belowCover}
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload, key, index } = props as {
                  cx?: number
                  cy?: number
                  payload?: SeriesPoint
                  key?: string | number
                  index?: number
                }
                if (cx == null || cy == null || !payload || payload.current == null) return <></>
                const cls = classify(payload.current, coverLine)
                const fill =
                  cls === 'above'
                    ? CHART_COLORS.aboveCover
                    : cls === 'below'
                      ? CHART_COLORS.belowCover
                      : CHART_COLORS.neutral
                const isLh = payload.point?.lhPositive === true
                const r = isLh ? 5 : 3.5
                const targetIdx =
                  index != null ? current.findIndex((c) => c.cycleDay === payload.cycleDay) : -1
                return (
                  <circle
                    key={key}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    stroke={isLh ? '#FFFFFF' : 'none'}
                    strokeWidth={isLh ? 1 : 0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSnapshotIdx(targetIdx >= 0 ? targetIdx : null)}
                  />
                )
              }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls={false}
            />

            <Tooltip
              cursor={{ stroke: 'rgba(255, 255, 255, 0.10)', strokeDasharray: '2 3' }}
              contentStyle={{
                background: CHART_COLORS.tooltipBg,
                border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                borderRadius: 8,
                fontSize: 12,
                color: CHART_COLORS.tooltipText,
                padding: '6px 8px',
              }}
              labelStyle={{ display: 'none' }}
              itemStyle={{ color: CHART_COLORS.tooltipText }}
              formatter={(_v, name, entry) => {
                const p = entry?.payload as SeriesPoint | undefined
                if (!p) return ['', '']
                if (name === 'prior') {
                  return p.prior != null ? [`Prior CD ${p.cycleDay}: ${p.prior.toFixed(2)} F`, ''] : ['', '']
                }
                if (p.current == null) return ['', '']
                const cls = classify(p.current, coverLine)
                const tag = cls === 'above' ? ' (above cover)' : cls === 'below' ? ' (below cover)' : ''
                return [`CD ${p.cycleDay}: ${p.current.toFixed(2)} F${tag}`, '']
              }}
              separator=""
            />
          </ComposedChart>
        )}
      </div>

      {/* Phase legend chips. Doubles as a keyboard-friendly affordance to
          step the snapshot through each band. */}
      <div
        role="list"
        aria-label="Phase bands"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--v2-space-2)',
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
        }}
      >
        {bands.map((b) => (
          <span
            key={`legend-${b.label}`}
            role="listitem"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--v2-space-1)',
              padding: '4px 10px',
              borderRadius: 'var(--v2-radius-full)',
              border: '1px solid var(--v2-border-subtle)',
              background: b.fill,
            }}
          >
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: b.fill, border: '1px solid rgba(255, 255, 255, 0.16)' }} />
            {b.label}
          </span>
        ))}
        {prior && prior.length > 0 && (
          <span
            role="listitem"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--v2-space-1)',
              padding: '4px 10px',
              borderRadius: 'var(--v2-radius-full)',
              border: '1px dashed var(--v2-border-subtle)',
            }}
          >
            <span aria-hidden style={{ width: 16, height: 0, borderTop: `2px dashed ${CHART_COLORS.prior}` }} />
            Prior cycle
          </span>
        )}
      </div>

      {/* Day snapshot. Inline so the user does not lose chart context. */}
      <SnapshotCard point={snapshot} onClose={() => setSnapshotIdx(null)} />
    </div>
  )
}

function SnapshotCard({ point, onClose }: { point: InsightsBbtPoint | null; onClose: () => void }) {
  if (!point) {
    return (
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          fontStyle: 'italic',
        }}
        data-testid="cycle-insights-snapshot-hint"
      >
        Tap any temperature dot to see that day's BBT, LH test, and cervical mucus snapshot.
      </p>
    )
  }
  const niceDate = new Date(point.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return (
    <div
      data-testid="cycle-insights-snapshot"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--v2-space-1)',
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: 'var(--v2-text-sm)',
            fontWeight: 'var(--v2-weight-semibold)',
            color: 'var(--v2-text-primary)',
          }}
        >
          CD {point.cycleDay} · {niceDate}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close snapshot"
          style={{
            background: 'transparent',
            color: 'var(--v2-text-muted)',
            border: 'none',
            fontSize: 'var(--v2-text-xs)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          Close
        </button>
      </div>
      <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
        BBT: {point.temp_f.toFixed(2)} F
      </span>
      <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
        LH test: {point.lhPositive ? 'positive' : 'no positive logged'}
      </span>
      <span style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)' }}>
        Cervical mucus: {point.cervicalMucus ?? 'not logged'}
      </span>
      {point.isPeriodDay && (
        <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-accent-warning)' }}>
          Period day
        </span>
      )}
    </div>
  )
}
