'use client'

/*
 * BbtChart
 *
 * NC's signature visualization (frame_0117, frame_0125, frame_0128 in
 * docs/reference/natural-cycles/frames/full-tour). A BBT time-series
 * line where the line color itself encodes the cover-line transition.
 *
 *   Green segments = readings at or BELOW the cover line (pre-ovulatory).
 *   Red segments   = readings ABOVE the cover line (post-ovulatory).
 *
 * The cover line itself is NEVER drawn. NC's design choice: the color
 * shift carries the information, and a horizontal threshold line
 * implies more clinical certainty than is warranted for a personal
 * moving baseline. See CoverLineExplainer for the methodology copy.
 *
 * X-axis: cycle day (1-indexed), NOT calendar date. NC uses cycle day
 * because two cycles of the same length compare more naturally than
 * two stretches of the calendar that span different month boundaries.
 *
 * Y-axis: temperature in degrees F. We render exactly what was logged.
 *
 * Period days appear as light pink rectangles in the background so the
 * reader can see when the cycle started without having to count.
 *
 * Wave 1 dependency: the props shape uses BbtReading and accepts a
 * `coverLine` value. Wave 1 will create src/lib/cycle/bbt-source.ts
 * (per-cycle reading windowing) and src/lib/cycle/cover-line.ts
 * (the personal moving baseline). Until those land, callers can pass
 * the raw bbt-log entries mapped through a small adapter and a
 * coverLine of null. This file imports nothing from those Wave 1
 * modules directly so it compiles in isolation.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
} from 'recharts'

// Recharts writes these into SVG stroke/fill presentation attributes,
// where CSS custom properties are not resolved reliably. Literal hex
// mirrors the v2 dark tokens (tokens.css) so the chart stays visible.
const CHART_COLORS = {
  belowCover: '#6ACF89', // --v2-accent-success
  aboveCover: '#D9775C', // --v2-accent-warning
  neutral: '#7FBFB5',    // softened teal when no cover line is known
  axis: '#7E8088',       // --v2-text-muted
  period: 'rgba(232, 69, 112, 0.18)', // light pink wash
  lhDot: '#E5C952',      // --v2-accent-highlight (LH+ marker)
  tooltipBg: '#17171B',  // --v2-bg-card
  tooltipBorder: 'rgba(255, 255, 255, 0.10)',
  tooltipText: '#F2F2F4',// --v2-text-primary
} as const

const CHART_HEIGHT = 220
const CHART_HEIGHT_COMPACT = 160

export interface BbtReading {
  /** ISO date YYYY-MM-DD (used for tooltip + period overlay match). */
  date: string
  /** 1-indexed cycle day. */
  cycleDay: number
  /** Temperature in degrees Fahrenheit. */
  temp_f: number
  /** True when an LH ovulation test was positive on this day. */
  lhPositive?: boolean
  /** True when this date had logged menstrual flow. */
  isPeriodDay?: boolean
}

export interface BbtChartProps {
  /** Readings for the current cycle, ordered oldest -> newest. */
  readings: BbtReading[]
  /**
   * The user's personal cover-line temperature (degrees F). Line
   * segments at or below this value render green; above it, red.
   * Pass null when not enough data is logged yet.
   */
  coverLine: number | null
  /**
   * Compact mode reduces chart height (160px instead of 220px). Used when
   * the chart is embedded as a glanceable card on the today screen.
   */
  compact?: boolean
}

interface PointDatum {
  cycleDay: number
  temp_f: number
  date: string
  isPeriodDay: boolean
  lhPositive: boolean
  /** Carries belowCover / aboveCover / neutral so dots color-encode the threshold. */
  color: string
}

function classify(temp_f: number, coverLine: number | null): 'below' | 'above' | 'neutral' {
  if (coverLine == null || !Number.isFinite(coverLine)) return 'neutral'
  return temp_f > coverLine ? 'above' : 'below'
}

/**
 * Pre-compute a single chart series where each adjacent pair of points
 * gets the color of the SECOND point in the pair. recharts Line does
 * not natively support per-segment stroke color, so we render two
 * overlaid Lines (one with belowCover stroke, one with aboveCover) and
 * mask the values that don't belong to that band. This keeps the curve
 * smooth (type="monotone") while encoding the threshold via color.
 */
function splitSeries(
  data: PointDatum[],
  coverLine: number | null,
): { below: Array<PointDatum & { value: number | null }>; above: Array<PointDatum & { value: number | null }> } {
  const below: Array<PointDatum & { value: number | null }> = []
  const above: Array<PointDatum & { value: number | null }> = []
  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const cls = classify(d.temp_f, coverLine)
    // We need overlap at the boundary so the line visually transitions
    // without a gap. A point colored "below" still contributes its
    // value to the "above" series if its NEIGHBOR is above-cover, and
    // vice versa. recharts will then connect the two segments where
    // they meet at the threshold crossing.
    const prev = data[i - 1]
    const next = data[i + 1]
    const prevCls = prev ? classify(prev.temp_f, coverLine) : null
    const nextCls = next ? classify(next.temp_f, coverLine) : null
    const inBelow = cls === 'below' || cls === 'neutral' || prevCls === 'below' || nextCls === 'below'
    const inAbove = cls === 'above' || prevCls === 'above' || nextCls === 'above'
    below.push({ ...d, value: inBelow ? d.temp_f : null })
    above.push({ ...d, value: inAbove ? d.temp_f : null })
  }
  return { below, above }
}

interface PeriodBand {
  startDay: number
  endDay: number
}

function deriveBands(data: PointDatum[]): PeriodBand[] {
  const bands: PeriodBand[] = []
  let current: PeriodBand | null = null
  for (const d of data) {
    if (d.isPeriodDay) {
      if (current && d.cycleDay === current.endDay + 1) {
        current.endDay = d.cycleDay
      } else {
        if (current) bands.push(current)
        current = { startDay: d.cycleDay, endDay: d.cycleDay }
      }
    }
  }
  if (current) bands.push(current)
  return bands
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--v2-space-2)',
        padding: 'var(--v2-space-6) var(--v2-space-4)',
        background: 'var(--v2-bg-card)',
        border: '1px dashed var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-lg)',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontSize: 'var(--v2-text-xs)',
          color: 'var(--v2-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--v2-tracking-wide)',
        }}
      >
        Temperature pattern
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
          lineHeight: 'var(--v2-leading-relaxed)',
          maxWidth: 280,
        }}
      >
        No temperature data yet for this cycle. Log a morning basal reading and
        the curve will start to build.
      </p>
    </div>
  )
}

export default function BbtChart({ readings, coverLine, compact = false }: BbtChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const chartHeight = compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT

  useEffect(() => {
    if (!ref.current) return
    const node = ref.current
    const measure = () => setWidth(node.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const data: PointDatum[] = useMemo(() => {
    return readings
      .filter((r) => Number.isFinite(r.temp_f) && r.cycleDay > 0)
      .sort((a, b) => a.cycleDay - b.cycleDay)
      .map((r) => ({
        cycleDay: r.cycleDay,
        temp_f: r.temp_f,
        date: r.date,
        isPeriodDay: r.isPeriodDay === true,
        lhPositive: r.lhPositive === true,
        color:
          classify(r.temp_f, coverLine) === 'above'
            ? CHART_COLORS.aboveCover
            : classify(r.temp_f, coverLine) === 'below'
              ? CHART_COLORS.belowCover
              : CHART_COLORS.neutral,
      }))
  }, [readings, coverLine])

  if (data.length === 0) return <EmptyState />

  const { below, above } = splitSeries(data, coverLine)
  const bands = deriveBands(data)

  const temps = data.map((d) => d.temp_f)
  const yMin = Math.min(...temps) - 0.3
  const yMax = Math.max(...temps) + 0.3
  const days = data.map((d) => d.cycleDay)
  const xMin = Math.max(1, Math.min(...days) - 1)
  const xMax = Math.max(...days) + 1

  return (
    <div ref={ref} style={{ width: '100%', height: chartHeight }}>
      {width > 0 && (
        <ComposedChart
          data={below}
          width={width}
          height={chartHeight}
          margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
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
              value: '°F',
              position: 'insideLeft',
              angle: -90,
              offset: 14,
              style: { fontSize: 10, fill: CHART_COLORS.axis },
            }}
          />

          {/* Period bands behind the line. Per NC frame inventory,
              menstrual days render as a light pink rectangle that
              spans cycle day range. */}
          {bands.map((b) => (
            <ReferenceArea
              key={`period-${b.startDay}-${b.endDay}`}
              x1={b.startDay - 0.5}
              x2={b.endDay + 0.5}
              fill={CHART_COLORS.period}
              ifOverflow="visible"
            />
          ))}

          {/* Below-cover (green) line. Smooth monotone per NC. */}
          <Line
            data={below}
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.belowCover}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, key } = props as {
                cx?: number
                cy?: number
                payload?: PointDatum & { value: number | null }
                key?: string | number
              }
              if (cx == null || cy == null || !payload) return <></>
              if (payload.value == null) return <></>
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={payload.lhPositive ? 4 : 2.5}
                  fill={payload.lhPositive ? CHART_COLORS.lhDot : CHART_COLORS.belowCover}
                  stroke={payload.lhPositive ? CHART_COLORS.lhDot : 'none'}
                  strokeWidth={payload.lhPositive ? 1.5 : 0}
                />
              )
            }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Above-cover (red) line drawn on top so the transition
              reads from green into red as the eye scans rightward. */}
          <Line
            data={above}
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.aboveCover}
            strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload, key } = props as {
                cx?: number
                cy?: number
                payload?: PointDatum & { value: number | null }
                key?: string | number
              }
              if (cx == null || cy == null || !payload) return <></>
              if (payload.value == null) return <></>
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={payload.lhPositive ? 4 : 2.5}
                  fill={payload.lhPositive ? CHART_COLORS.lhDot : CHART_COLORS.aboveCover}
                  stroke={payload.lhPositive ? CHART_COLORS.lhDot : 'none'}
                  strokeWidth={payload.lhPositive ? 1.5 : 0}
                />
              )
            }}
            activeDot={{ r: 4 }}
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
            formatter={(_v, _n, entry) => {
              const p = entry?.payload as PointDatum | undefined
              if (!p) return ['', '']
              const cls = classify(p.temp_f, coverLine)
              const tag = cls === 'above' ? ' (above cover)' : cls === 'below' ? ' (below cover)' : ''
              const lh = p.lhPositive ? ' · LH+' : ''
              return [`Day ${p.cycleDay}: ${p.temp_f.toFixed(2)}°F${tag}${lh}`, '']
            }}
            separator=""
          />
        </ComposedChart>
      )}
    </div>
  )
}
