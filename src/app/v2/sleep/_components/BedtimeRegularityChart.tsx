'use client'

/**
 * BedtimeRegularityChart
 *
 * 14-day bar chart showing each night's bedtime relative to the
 * user's usual. Bars are colored:
 *   green if within 30 minutes of usual
 *   amber if within 1 hour of usual
 *   red if more than 1 hour off
 *
 * "Usual" is the median bedtime over the last 14 days. We surface
 * the deviation, not just the absolute time, because bedtime
 * regularity (not bedtime hour) is the documented predictor of
 * migraine and POTS amplification per docs/research/oura-condition-mapping.md.
 *
 * Tap a bar: opens a sheet with exact bedtime and wake time.
 */
import { useMemo, useState } from 'react'
import type { OuraDaily } from '@/lib/types'
import Sheet from '@/v2/components/primitives/Sheet'

export interface BedtimeRegularityChartProps {
  nights: OuraDaily[]
}

interface NightPoint {
  date: string
  bedtimeIso: string | null
  waketimeIso: string | null
  /** Decimal hour of day for bedtime, normalized so a midnight bed maps to 24 not 0. */
  bedHour: number | null
}

const ON_TIME_MIN = 30
const NEAR_MIN = 60

function extractNightTimes(n: OuraDaily): {
  bedtimeIso: string | null
  waketimeIso: string | null
} {
  const sd = (
    n.raw_json as {
      oura?: { sleep_detail?: { bedtime_start?: string; bedtime_end?: string } }
    } | null
  )?.oura?.sleep_detail
  return {
    bedtimeIso: typeof sd?.bedtime_start === 'string' ? sd.bedtime_start : null,
    waketimeIso: typeof sd?.bedtime_end === 'string' ? sd.bedtime_end : null,
  }
}

function bedHourFromIso(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  let h = d.getHours() + d.getMinutes() / 60
  // Push early-morning bedtimes (e.g. 1am) onto the end of the prior
  // day so the chart shows them as "very late" rather than wrapping
  // visually back to the start.
  if (h < 12) h += 24
  return h
}

function median(xs: number[]): number {
  const arr = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (arr.length === 0) return 0
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}

function formatHour(h: number): string {
  let display = h % 24
  if (display < 0) display += 24
  const wholeHours = Math.floor(display)
  const minutes = Math.round((display - wholeHours) * 60)
  return `${wholeHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function formatClock(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${hh}:${mm}`
}

function colorFor(deviationMin: number): string {
  const a = Math.abs(deviationMin)
  if (a <= ON_TIME_MIN) return 'var(--v2-accent-positive, #22c55e)'
  if (a <= NEAR_MIN) return 'var(--v2-accent-warning, #f59e0b)'
  return 'var(--v2-accent-danger, #ef4444)'
}

export default function BedtimeRegularityChart({ nights }: BedtimeRegularityChartProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const last14 = nights.slice(-14)

  const points: NightPoint[] = useMemo(() => {
    return last14.map((n) => {
      const { bedtimeIso, waketimeIso } = extractNightTimes(n)
      return {
        date: n.date,
        bedtimeIso,
        waketimeIso,
        bedHour: bedHourFromIso(bedtimeIso),
      }
    })
  }, [last14])

  const usual = useMemo(
    () => median(points.map((p) => p.bedHour ?? Number.NaN).filter((x) => Number.isFinite(x))),
    [points],
  )

  if (points.length === 0 || usual === 0) {
    return (
      <div style={{ padding: 'var(--v2-space-4)', color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
        Bedtime regularity needs at least a few nights of ring data.
      </div>
    )
  }

  // Y-axis spans usual +/- 3 hours (a comfortable read window).
  const yMin = usual - 3
  const yMax = usual + 3
  const yRange = yMax - yMin

  // Layout maths in viewBox units. 700 wide, 200 tall, generous margins.
  const W = 700
  const H = 200
  const padL = 50
  const padR = 16
  const padT = 16
  const padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const barWidth = innerW / Math.max(points.length, 1) - 4

  const usualY = padT + ((yMax - usual) / yRange) * innerH

  const active = openIdx != null ? points[openIdx] : null
  const activeDeviation = active?.bedHour != null ? Math.round((active.bedHour - usual) * 60) : null

  return (
    <div>
      <p
        style={{
          margin: '0 0 var(--v2-space-3)',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        Your usual bedtime is around {formatHour(usual)}. Irregular bedtimes amplify migraine risk and
        POTS symptoms (per condition mapping research).
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Bedtime regularity chart, 14 days"
      >
        {/* Usual bedtime baseline. */}
        <line
          x1={padL}
          x2={W - padR}
          y1={usualY}
          y2={usualY}
          stroke="var(--v2-border-subtle, #444)"
          strokeDasharray="4 4"
        />
        <text
          x={padL - 6}
          y={usualY + 4}
          fontSize="10"
          fill="var(--v2-text-muted, #999)"
          textAnchor="end"
        >
          {formatHour(usual)}
        </text>

        {/* Bars. */}
        {points.map((p, i) => {
          const x = padL + (i * innerW) / points.length + 2
          if (p.bedHour == null) {
            return (
              <g key={p.date}>
                <rect
                  x={x}
                  y={padT + innerH - 2}
                  width={barWidth}
                  height={2}
                  fill="var(--v2-text-muted, #666)"
                  opacity={0.5}
                />
              </g>
            )
          }
          const deviationMin = (p.bedHour - usual) * 60
          const color = colorFor(deviationMin)
          // Bar grows from baseline toward the actual bedtime.
          const valueY = padT + ((yMax - p.bedHour) / yRange) * innerH
          const top = Math.min(usualY, valueY)
          const height = Math.max(2, Math.abs(valueY - usualY))
          return (
            <g key={p.date}>
              <rect
                x={x}
                y={top}
                width={barWidth}
                height={height}
                fill={color}
                rx={2}
                onClick={() => setOpenIdx(i)}
                style={{ cursor: 'pointer' }}
              />
              {/* Larger transparent hit target so taps work on mobile. */}
              <rect
                x={x - 2}
                y={padT}
                width={barWidth + 4}
                height={innerH}
                fill="transparent"
                onClick={() => setOpenIdx(i)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          )
        })}

        {/* X axis day ticks (every 2 days for readability). */}
        {points.map((p, i) => {
          if (i % 2 !== 0) return null
          const x = padL + (i * innerW) / points.length + barWidth / 2 + 2
          const dom = new Date(`${p.date}T00:00:00Z`).getUTCDate()
          return (
            <text
              key={`tick-${p.date}`}
              x={x}
              y={H - padB + 14}
              fontSize="10"
              fill="var(--v2-text-muted, #999)"
              textAnchor="middle"
            >
              {dom}
            </text>
          )
        })}
      </svg>

      <Sheet
        open={active !== null}
        onClose={() => setOpenIdx(null)}
        title={active ? `Night of ${active.date}` : ''}
      >
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <Row label="Bedtime" value={formatClock(active.bedtimeIso)} />
            <Row label="Wake time" value={formatClock(active.waketimeIso)} />
            <Row
              label="Off your usual by"
              value={
                activeDeviation == null
                  ? '-'
                  : `${activeDeviation > 0 ? '+' : ''}${activeDeviation}m`
              }
            />
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{label}</span>
      <span style={{ color: 'var(--v2-text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
