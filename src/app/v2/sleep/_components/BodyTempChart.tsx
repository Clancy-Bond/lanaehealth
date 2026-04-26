'use client'

/**
 * BodyTempChart
 *
 * 30-day line chart of `body_temp_deviation` from each night's
 * Oura sync. We surface this on the Sleep page in addition to the
 * Cycle page because temperature deviation reflects general
 * autonomic and hormonal context, not just BBT for ovulation.
 *
 * Color: orange for nights above the user's mean, blue for nights
 * below. Nights with null deviation render no segment (the line
 * skips them).
 *
 * Tap a point: shows the exact deviation, that night's resting HR,
 * and that night's sleep score so the user can spot the cluster
 * (low HRV + high temp + low sleep is the migraine prodrome
 * signature per condition mapping research).
 */
import { useMemo, useState } from 'react'
import type { OuraDaily } from '@/lib/types'
import Sheet from '@/v2/components/primitives/Sheet'

export interface BodyTempChartProps {
  nights: OuraDaily[]
}

interface Point {
  date: string
  dev: number | null
  restingHr: number | null
  sleepScore: number | null
}

function mean(xs: number[]): number {
  const arr = xs.filter((x) => Number.isFinite(x))
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function formatDev(d: number): string {
  return `${d >= 0 ? '+' : ''}${d.toFixed(2)}°C`
}

export default function BodyTempChart({ nights }: BodyTempChartProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const last30 = nights.slice(-30)

  const points: Point[] = useMemo(
    () =>
      last30.map((n) => ({
        date: n.date,
        dev:
          typeof n.body_temp_deviation === 'number' && Number.isFinite(n.body_temp_deviation)
            ? n.body_temp_deviation
            : null,
        restingHr: n.resting_hr,
        sleepScore: n.sleep_score,
      })),
    [last30],
  )

  const userMean = useMemo(
    () => mean(points.map((p) => p.dev).filter((x): x is number => x != null)),
    [points],
  )

  const validDevs = points.map((p) => p.dev).filter((x): x is number => x != null)
  if (validDevs.length === 0) {
    return (
      <div style={{ padding: 'var(--v2-space-4)', color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-sm)' }}>
        Body temperature deviation needs at least a few synced nights.
      </div>
    )
  }

  // Y range: pad +/- 0.3°C around min/max for visual breathing room.
  const yMinRaw = Math.min(...validDevs, userMean) - 0.3
  const yMaxRaw = Math.max(...validDevs, userMean) + 0.3
  const yMin = Math.min(yMinRaw, userMean - 0.3)
  const yMax = Math.max(yMaxRaw, userMean + 0.3)
  const yRange = yMax - yMin || 1

  const W = 700
  const H = 220
  const padL = 50
  const padR = 16
  const padT = 16
  const padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  function xFor(i: number): number {
    if (points.length <= 1) return padL + innerW / 2
    return padL + (i / (points.length - 1)) * innerW
  }
  function yFor(v: number): number {
    return padT + ((yMax - v) / yRange) * innerH
  }

  const meanY = yFor(userMean)

  // Build the line segments, skipping nulls.
  const segments: { from: { x: number; y: number; dev: number }; to: { x: number; y: number; dev: number } }[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    if (a.dev == null || b.dev == null) continue
    segments.push({
      from: { x: xFor(i), y: yFor(a.dev), dev: a.dev },
      to: { x: xFor(i + 1), y: yFor(b.dev), dev: b.dev },
    })
  }

  const active = openIdx != null ? points[openIdx] : null

  return (
    <div>
      <p
        style={{
          margin: '0 0 var(--v2-space-3)',
          fontSize: 'var(--v2-text-sm)',
          color: 'var(--v2-text-secondary)',
        }}
      >
        30-day body temperature deviation. Above your mean reads orange, below reads blue. Persistent
        elevation alongside lower HRV is worth a check-in.
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Body temperature deviation chart, 30 days"
      >
        {/* Mean baseline. */}
        <line
          x1={padL}
          x2={W - padR}
          y1={meanY}
          y2={meanY}
          stroke="var(--v2-border-subtle, #444)"
          strokeDasharray="4 4"
        />
        <text x={padL - 6} y={meanY + 4} fontSize="10" fill="var(--v2-text-muted, #999)" textAnchor="end">
          mean
        </text>

        {/* Line segments. */}
        {segments.map((s, i) => {
          const midDev = (s.from.dev + s.to.dev) / 2
          const color = midDev >= userMean ? '#fb923c' : '#60a5fa'
          return (
            <line
              key={`seg-${i}`}
              x1={s.from.x}
              y1={s.from.y}
              x2={s.to.x}
              y2={s.to.y}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          )
        })}

        {/* Points + invisible larger hit targets. */}
        {points.map((p, i) => {
          if (p.dev == null) return null
          const cx = xFor(i)
          const cy = yFor(p.dev)
          const color = p.dev >= userMean ? '#fb923c' : '#60a5fa'
          return (
            <g key={`pt-${p.date}`}>
              <circle cx={cx} cy={cy} r={3} fill={color} />
              <circle
                cx={cx}
                cy={cy}
                r={14}
                fill="transparent"
                onClick={() => setOpenIdx(i)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          )
        })}

        {/* Sparse x ticks. */}
        {points.map((p, i) => {
          if (i % 5 !== 0) return null
          const dom = new Date(`${p.date}T00:00:00Z`).getUTCDate()
          return (
            <text
              key={`tick-${p.date}`}
              x={xFor(i)}
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
        title={active ? active.date : ''}
      >
        {active && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <Row label="Temperature deviation" value={active.dev != null ? formatDev(active.dev) : '-'} />
            <Row
              label="Resting heart rate"
              value={active.restingHr != null ? `${Math.round(active.restingHr)} bpm` : '-'}
            />
            <Row
              label="Sleep score"
              value={active.sleepScore != null ? `${Math.round(active.sleepScore)}` : '-'}
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
