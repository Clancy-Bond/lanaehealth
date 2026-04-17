'use client'

import type { CheckInPrefill } from '@/lib/log/prefill'

interface WeeklySummaryCardProps {
  weekly: CheckInPrefill['weekly']
  yesterdayPain: number | null
}

export default function WeeklySummaryCard({ weekly, yesterdayPain }: WeeklySummaryCardProps) {
  if (weekly.dayCount === 0) return null

  const delta = weekly.avgPain !== null && yesterdayPain !== null
    ? Number((yesterdayPain - weekly.avgPain).toFixed(1))
    : null

  const deltaLabel =
    delta === null ? null :
    delta > 0.5 ? `+${delta} vs week` :
    delta < -0.5 ? `${delta} vs week` :
    'steady'
  const deltaColor =
    delta === null ? '#8a8a8a' :
    delta > 0.5 ? '#D4A0A0' :
    delta < -0.5 ? '#6B9080' :
    '#8a8a8a'

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Last 7 days
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
            {weekly.dayCount} logged
          </span>
        </h3>
        {deltaLabel ? (
          <span className="text-xs font-medium" style={{ color: deltaColor }}>
            {deltaLabel}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Cell label="Avg pain" value={weekly.avgPain} suffix="/10" accent="#D4A0A0" />
        <Cell label="Avg fatigue" value={weekly.avgFatigue} suffix="/10" accent="#CCB167" />
        <Cell label="Avg sleep" value={weekly.avgSleepScore} suffix="/100" accent="#6B9080" />
      </div>

      {weekly.symptomsCount > 0 ? (
        <div className="text-xs mt-3" style={{ color: '#6a6a6a' }}>
          {weekly.symptomsCount} symptom{weekly.symptomsCount === 1 ? '' : 's'} logged this week
        </div>
      ) : null}

      <Sparkline points={weekly.painSparkline} />
    </div>
  )
}

interface SparklineProps {
  points: Array<{ date: string; pain: number | null }>
}

function Sparkline({ points }: SparklineProps) {
  const hasData = points.some(p => p.pain !== null)
  if (!hasData) return null

  const width = 280
  const height = 40
  const maxPain = 10
  const step = width / Math.max(1, points.length - 1)

  const pathPoints = points
    .map((p, i) => ({ x: i * step, y: p.pain === null ? null : height - (p.pain / maxPain) * height, pain: p.pain, date: p.date }))

  let path = ''
  let started = false
  for (const pt of pathPoints) {
    if (pt.y === null) continue
    if (!started) {
      path += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
      started = true
    } else {
      path += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    }
  }

  return (
    <div className="mt-3">
      <div className="text-xs mb-1" style={{ color: '#8a8a8a' }}>
        Pain trend
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-label="Pain trend over 8 days" role="img">
        <path d={path} fill="none" stroke="#D4A0A0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pathPoints.map((pt, i) => pt.y === null ? null : (
          <circle
            key={i}
            cx={pt.x.toFixed(1)}
            cy={pt.y.toFixed(1)}
            r={i === pathPoints.length - 1 ? 3.5 : 2}
            fill={i === pathPoints.length - 1 ? '#A66B6B' : '#D4A0A0'}
          />
        ))}
      </svg>
    </div>
  )
}

interface CellProps {
  label: string
  value: number | null
  suffix: string
  accent: string
}

function Cell({ label, value, suffix, accent }: CellProps) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide" style={{ color: '#8a8a8a' }}>
        {label}
      </div>
      <div className="mt-1">
        <span className="text-xl font-semibold" style={{ color: accent }}>
          {value === null ? '--' : value}
        </span>
        {value === null ? null : (
          <span className="text-xs ml-1" style={{ color: '#8a8a8a' }}>{suffix}</span>
        )}
      </div>
    </div>
  )
}
