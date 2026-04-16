'use client'

/**
 * Hypnogram (Sleep Stage Timeline)
 *
 * Stepped "cityscape" chart showing sleep stages over the night.
 * Self-fetches from /api/oura/sleep-stages when no props provided.
 */

import { useEffect, useState } from 'react'

interface SleepStageBlock {
  startMinute: number
  stage: 'awake' | 'rem' | 'light' | 'deep'
  durationMinutes: number
}

interface HypnogramProps {
  stages?: SleepStageBlock[]
  totalMinutes?: number
  bedtime?: string | null
  wakeTime?: string | null
  heartRateData?: Array<{ minute: number; bpm: number }>
  date?: string                 // If provided, fetches that specific date
}

const STAGE_COLORS: Record<string, string> = {
  deep: '#1A237E',     // Deep navy
  rem: '#00897B',      // Teal
  light: '#90CAF9',    // Light blue
  awake: '#EF9A9A',    // Light red
}

const STAGE_Y: Record<string, number> = {
  deep: 3,
  light: 2,
  rem: 1,
  awake: 0,
}

const STAGE_LABELS: Record<string, string> = {
  awake: 'Awake',
  rem: 'REM',
  light: 'Light',
  deep: 'Deep',
}

export default function Hypnogram({
  stages: propStages,
  totalMinutes: propTotalMinutes,
  bedtime: propBedtime,
  wakeTime: propWakeTime,
  heartRateData,
  date,
}: HypnogramProps) {
  const [fetched, setFetched] = useState<{
    stages: SleepStageBlock[]
    totalMinutes: number
    bedtime: string | null
    wakeTime: string | null
  } | null>(null)

  useEffect(() => {
    if (propStages && propStages.length > 0) return
    const params = date ? `?date=${date}` : ''
    fetch(`/api/oura/sleep-stages${params}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.stages?.length > 0) {
          setFetched({
            stages: data.stages,
            totalMinutes: data.totalMinutes,
            bedtime: data.bedtime ?? null,
            wakeTime: data.wakeTime ?? null,
          })
        }
      })
      .catch(() => {})
  }, [propStages, date])

  const stages = propStages && propStages.length > 0 ? propStages : fetched?.stages ?? []
  const totalMinutes = propTotalMinutes ?? fetched?.totalMinutes ?? 0
  const bedtime = propBedtime ?? fetched?.bedtime ?? null
  const wakeTime = propWakeTime ?? fetched?.wakeTime ?? null

  if (stages.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          No sleep stage data available for this night.
        </p>
      </div>
    )
  }

  const chartWidth = 320
  const chartHeight = 100
  const minuteWidth = chartWidth / Math.max(totalMinutes, 1)
  const stageHeight = chartHeight / 4

  // Calculate stage durations for summary
  const stageTotals: Record<string, number> = { awake: 0, rem: 0, light: 0, deep: 0 }
  for (const block of stages) {
    stageTotals[block.stage] = (stageTotals[block.stage] ?? 0) + block.durationMinutes
  }

  // Heart rate line path
  let hrPath = ''
  if (heartRateData && heartRateData.length > 1) {
    const hrMin = Math.min(...heartRateData.map(d => d.bpm))
    const hrMax = Math.max(...heartRateData.map(d => d.bpm))
    const hrRange = hrMax - hrMin || 1

    hrPath = heartRateData.map((d, i) => {
      const x = d.minute * minuteWidth
      const y = chartHeight - ((d.bpm - hrMin) / hrRange) * (chartHeight - 10) - 5
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Sleep Stages
        </h3>
        {bedtime && wakeTime && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {bedtime} -- {wakeTime}
          </span>
        )}
      </div>

      {/* Hypnogram SVG */}
      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight + 20}
          viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}
          style={{ display: 'block', margin: '0 auto' }}
        >
          {/* Stage labels on left */}
          {(['awake', 'rem', 'light', 'deep'] as const).map(stage => (
            <text
              key={stage}
              x={-2}
              y={STAGE_Y[stage] * stageHeight + stageHeight / 2 + 4}
              fontSize="8"
              fill="var(--text-muted)"
              textAnchor="end"
              style={{ display: 'none' }} // Hidden for clean look, shown in legend
            >
              {STAGE_LABELS[stage]}
            </text>
          ))}

          {/* Stage blocks (the "cityscape") */}
          {stages.map((block, i) => {
            const x = block.startMinute * minuteWidth
            const w = Math.max(block.durationMinutes * minuteWidth, 1)
            const y = STAGE_Y[block.stage] * stageHeight
            const h = stageHeight

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={STAGE_COLORS[block.stage]}
                rx={1}
              />
            )
          })}

          {/* Heart rate overlay */}
          {hrPath && (
            <path
              d={hrPath}
              fill="none"
              stroke="#EF5350"
              strokeWidth="1"
              opacity="0.5"
            />
          )}

          {/* Time labels at bottom */}
          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
            const x = pct * chartWidth
            const mins = Math.round(pct * totalMinutes)
            const hrs = Math.floor(mins / 60)
            const label = hrs > 0 ? `${hrs}h` : ''
            return (
              <text
                key={pct}
                x={x}
                y={chartHeight + 14}
                fontSize="9"
                fill="var(--text-muted)"
                textAnchor="middle"
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Stage summary legend */}
      <div className="flex justify-between mt-3">
        {(['deep', 'rem', 'light', 'awake'] as const).map(stage => {
          const mins = stageTotals[stage]
          const hrs = Math.floor(mins / 60)
          const m = mins % 60
          const pct = totalMinutes > 0 ? Math.round(mins / totalMinutes * 100) : 0

          return (
            <div key={stage} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: STAGE_COLORS[stage] }}
              />
              <div>
                <p className="text-[10px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {STAGE_LABELS[stage]}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {hrs > 0 ? `${hrs}h ${m}m` : `${m}m`} ({pct}%)
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
