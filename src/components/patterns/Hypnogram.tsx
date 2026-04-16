'use client'

/**
 * Hypnogram (Sleep Stage Timeline)
 *
 * Stepped "cityscape" chart showing sleep stages over the night.
 * Self-fetches from /api/oura/sleep-stages when no props provided.
 *
 * Visual design notes:
 * - Palette tuned to warm-modern + clinical calm (Oura-inspired, not Oura-copy)
 * - Deep rooted indigo for deep sleep, calm teal for REM, gentle sage for light, blush for awake
 * - Axis labels on left (always visible), time markers on bottom with actual HH:MM
 * - Subtle stage gridlines behind chart for readability
 * - Loading skeleton + empty state
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
  date?: string
}

// Warm-modern clinical palette (sage/blush aesthetic, but with clarity for stages)
const STAGE_COLORS: Record<string, string> = {
  deep: '#3B4C8A',    // Muted indigo (deep sleep, grounded)
  rem: '#5DA3A3',     // Soft teal (REM, dreaming, mentally active)
  light: '#B8D4D0',   // Sage mist (light sleep, transitional)
  awake: '#E8B5A6',   // Warm blush (awake, interruption)
}

const STAGE_Y: Record<string, number> = {
  awake: 0,
  rem: 1,
  light: 2,
  deep: 3,
}

const STAGE_LABELS: Record<string, string> = {
  awake: 'Awake',
  rem: 'REM',
  light: 'Light',
  deep: 'Deep',
}

function formatMinutesAsTime(bedtime: string | null, minutesFromStart: number): string {
  if (!bedtime) return ''
  const parts = bedtime.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!parts) return ''
  let hour = parseInt(parts[1], 10)
  const minute = parseInt(parts[2], 10)
  const ampm = parts[3]?.toUpperCase()
  if (ampm === 'PM' && hour !== 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0

  const totalStartMinutes = hour * 60 + minute
  const current = (totalStartMinutes + minutesFromStart) % (24 * 60)
  const h = Math.floor(current / 60)
  const m = current % 60
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${String(m).padStart(2, '0')}`
}

export function HypnogramSkeleton() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded" style={{ background: 'var(--border-light)' }} />
        <div className="h-3 w-28 rounded" style={{ background: 'var(--border-light)' }} />
      </div>
      <div className="h-[120px] rounded-lg" style={{ background: 'var(--bg-muted)' }} />
      <div className="grid grid-cols-4 gap-3 mt-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-16 rounded" style={{ background: 'var(--border-light)' }} />
            <div className="h-2.5 w-12 rounded" style={{ background: 'var(--border-light)' }} />
          </div>
        ))}
      </div>
    </div>
  )
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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (propStages && propStages.length > 0) return
    setLoading(true)
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
      .finally(() => setLoading(false))
  }, [propStages, date])

  if (loading && !propStages) {
    return <HypnogramSkeleton />
  }

  const stages = propStages && propStages.length > 0 ? propStages : fetched?.stages ?? []
  const totalMinutes = propTotalMinutes ?? fetched?.totalMinutes ?? 0
  const bedtime = propBedtime ?? fetched?.bedtime ?? null
  const wakeTime = propWakeTime ?? fetched?.wakeTime ?? null

  if (stages.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
             style={{ background: 'var(--bg-muted)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          No sleep stage data
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Sync your Oura ring to see nightly stage breakdowns.
        </p>
      </div>
    )
  }

  // Chart dimensions with axis room
  const axisWidth = 44     // Left space for stage labels
  const chartWidth = 320
  const chartHeight = 120
  const bottomAxis = 22    // Space below for time labels
  const totalWidth = chartWidth + axisWidth
  const totalHeight = chartHeight + bottomAxis

  const minuteWidth = chartWidth / Math.max(totalMinutes, 1)
  const stageHeight = chartHeight / 4

  // Stage durations
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
      const x = axisWidth + d.minute * minuteWidth
      const y = chartHeight - ((d.bpm - hrMin) / hrRange) * (chartHeight - 10) - 5
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    }).join(' ')
  }

  const timeMarkers = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            Sleep Stages
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m total
          </p>
        </div>
        {bedtime && wakeTime && (
          <span className="text-[11px] px-2 py-1 rounded-full font-medium"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}>
            {bedtime} to {wakeTime}
          </span>
        )}
      </div>

      {/* Hypnogram SVG */}
      <div className="overflow-x-auto -mx-1 px-1">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}
          role="img"
          aria-label={`Sleep stage timeline across ${Math.floor(totalMinutes / 60)} hours ${totalMinutes % 60} minutes`}
        >
          {/* Horizontal gridlines for each stage (subtle) */}
          {(['awake', 'rem', 'light', 'deep'] as const).map((stage, i) => (
            <line
              key={`grid-${stage}`}
              x1={axisWidth}
              y1={i * stageHeight + stageHeight / 2}
              x2={totalWidth}
              y2={i * stageHeight + stageHeight / 2}
              stroke="var(--border-light)"
              strokeWidth="0.5"
              strokeDasharray="2 3"
              opacity="0.4"
            />
          ))}

          {/* Stage labels on left (always visible) */}
          {(['awake', 'rem', 'light', 'deep'] as const).map(stage => (
            <text
              key={stage}
              x={axisWidth - 8}
              y={STAGE_Y[stage] * stageHeight + stageHeight / 2 + 3}
              fontSize="10"
              fontWeight="500"
              fill={STAGE_COLORS[stage]}
              textAnchor="end"
              style={{ letterSpacing: '0.02em' }}
            >
              {STAGE_LABELS[stage]}
            </text>
          ))}

          {/* Stage blocks (the "cityscape") */}
          {stages.map((block, i) => {
            const x = axisWidth + block.startMinute * minuteWidth
            const w = Math.max(block.durationMinutes * minuteWidth, 1)
            const y = STAGE_Y[block.stage] * stageHeight + 2
            const h = stageHeight - 4

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={STAGE_COLORS[block.stage]}
                rx={2}
                opacity="0.92"
              >
                <title>
                  {STAGE_LABELS[block.stage]}: {block.durationMinutes}m starting at {formatMinutesAsTime(bedtime, block.startMinute)}
                </title>
              </rect>
            )
          })}

          {/* Heart rate overlay */}
          {hrPath && (
            <path
              d={hrPath}
              fill="none"
              stroke="#D4766B"
              strokeWidth="1.25"
              opacity="0.55"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Time axis baseline */}
          <line
            x1={axisWidth}
            y1={chartHeight}
            x2={totalWidth}
            y2={chartHeight}
            stroke="var(--border-light)"
            strokeWidth="1"
          />

          {/* Time tick marks + labels at bottom */}
          {timeMarkers.map(pct => {
            const x = axisWidth + pct * chartWidth
            const mins = Math.round(pct * totalMinutes)
            const timeLabel = formatMinutesAsTime(bedtime, mins)
            return (
              <g key={pct}>
                <line
                  x1={x}
                  y1={chartHeight}
                  x2={x}
                  y2={chartHeight + 4}
                  stroke="var(--text-muted)"
                  strokeWidth="0.75"
                />
                <text
                  x={x}
                  y={chartHeight + 14}
                  fontSize="9"
                  fill="var(--text-muted)"
                  textAnchor="middle"
                  fontWeight="500"
                >
                  {timeLabel}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Stage summary legend */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
        {(['deep', 'rem', 'light', 'awake'] as const).map(stage => {
          const mins = stageTotals[stage]
          const hrs = Math.floor(mins / 60)
          const m = mins % 60
          const pct = totalMinutes > 0 ? Math.round(mins / totalMinutes * 100) : 0

          return (
            <div key={stage} className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: STAGE_COLORS[stage] }}
                />
                <p className="text-[10px] font-semibold uppercase tracking-wider truncate"
                   style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                  {STAGE_LABELS[stage]}
                </p>
              </div>
              <p className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {hrs > 0 ? `${hrs}h ${m}m` : `${m}m`}
              </p>
              <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {pct}% of night
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
