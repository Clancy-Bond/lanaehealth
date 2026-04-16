'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { getSeverityColor, getSeverityLabel } from '@/lib/clinical-scales'
import type { ClinicalScaleResponse, ScaleSeverity } from '@/lib/types'

interface ClinicalScaleTrendProps {
  initialData: ClinicalScaleResponse[]
}

interface ChartPoint {
  date: string
  dateLabel: string
  phq9?: number
  gad7?: number
}

// Severity band definitions for PHQ-9 (0-27)
const PHQ9_BANDS: { severity: ScaleSeverity; min: number; max: number }[] = [
  { severity: 'minimal', min: 0, max: 4 },
  { severity: 'mild', min: 5, max: 9 },
  { severity: 'moderate', min: 10, max: 14 },
  { severity: 'moderately_severe', min: 15, max: 19 },
  { severity: 'severe', min: 20, max: 27 },
]

// Severity band definitions for GAD-7 (0-21)
const GAD7_BANDS: { severity: ScaleSeverity; min: number; max: number }[] = [
  { severity: 'minimal', min: 0, max: 4 },
  { severity: 'mild', min: 5, max: 9 },
  { severity: 'moderate', min: 10, max: 14 },
  { severity: 'severe', min: 15, max: 21 },
]

// Tooltip
function CustomTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || !label) return null

  const dateStr = (() => {
    try {
      return format(parseISO(label), 'MMM d, yyyy')
    } catch {
      return label
    }
  })()

  const entries = payload.filter((p) => p.value != null)
  if (entries.length === 0) return null

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E5DC',
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(26, 26, 46, 0.08)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 6 }}>
        {dateStr}
      </div>
      {entries.map((p) => {
        const label = p.dataKey === 'phq9' ? 'PHQ-9' : 'GAD-7'
        return (
          <div
            key={p.dataKey}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 3,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: p.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#6B7280' }}>{label}:</span>
            <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{p.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ClinicalScaleTrend({ initialData }: ClinicalScaleTrendProps) {
  // Measure parent width for recharts (same SSR-safe pattern as TrendChart)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)

  useEffect(() => {
    const measure = () => {
      if (chartRef.current) {
        setChartWidth(chartRef.current.clientWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Build chart data by merging PHQ-9 and GAD-7 on the same date axis
  const chartData = useMemo(() => {
    const dateMap = new Map<string, ChartPoint>()

    for (const entry of initialData) {
      const existing = dateMap.get(entry.date) ?? {
        date: entry.date,
        dateLabel: (() => {
          try {
            return format(parseISO(entry.date), 'MMM d')
          } catch {
            return entry.date
          }
        })(),
      }

      if (entry.scale_type === 'PHQ-9') {
        existing.phq9 = entry.total_score
      } else if (entry.scale_type === 'GAD-7') {
        existing.gad7 = entry.total_score
      }

      dateMap.set(entry.date, existing)
    }

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  }, [initialData])

  // Determine max Y for severity bands
  const hasPhq9 = initialData.some((d) => d.scale_type === 'PHQ-9')
  const hasGad7 = initialData.some((d) => d.scale_type === 'GAD-7')
  const maxY = hasPhq9 ? 27 : 21
  const bands = hasPhq9 ? PHQ9_BANDS : GAD7_BANDS

  // Tick interval
  const tickInterval = useMemo(() => {
    const len = chartData.length
    if (len <= 7) return 0
    if (len <= 14) return 1
    return Math.ceil(len / 8) - 1
  }, [chartData])

  // Empty state
  if (chartData.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 24,
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '1rem',
          border: '1px solid var(--border-light)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--accent-sage-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          No assessments yet
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            maxWidth: 260,
            margin: '0 auto',
          }}
        >
          Complete a PHQ-9 or GAD-7 assessment on the Log page to start tracking your mental health trends over time.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '1rem',
        border: '1px solid var(--border-light)',
        padding: '16px 12px',
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 12px 4px',
        }}
      >
        Mental Health Trends
      </h2>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 14,
          paddingLeft: 4,
        }}
      >
        {hasPhq9 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span
              style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: '#D4A0A0',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>PHQ-9 (Depression)</span>
          </span>
        )}
        {hasGad7 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <span
              style={{
                width: 12,
                height: 3,
                borderRadius: 2,
                background: '#6B9080',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>GAD-7 (Anxiety)</span>
          </span>
        )}
      </div>

      {/* Chart */}
      <div ref={chartRef} style={{ width: '100%', height: 240 }}>
        {chartWidth > 0 ? (
          <LineChart
            width={chartWidth}
            height={240}
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 24, left: -12 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#F0F0EA"
              vertical={false}
            />

            {/* Severity band overlays */}
            {bands.map((band) => (
              <ReferenceArea
                key={band.severity}
                y1={band.min}
                y2={band.max}
                fill={getSeverityColor(band.severity)}
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            ))}

            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              angle={-45}
              textAnchor="end"
              tickLine={false}
              axisLine={{ stroke: '#F0F0EA' }}
              interval={tickInterval}
              tickFormatter={(val: string) => {
                try {
                  return format(parseISO(val), 'MMM d')
                } catch {
                  return val
                }
              }}
              height={55}
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              width={36}
              domain={[0, maxY]}
            />
            <Tooltip content={<CustomTooltipContent />} />

            {hasPhq9 && (
              <Line
                type="monotone"
                dataKey="phq9"
                stroke="#D4A0A0"
                strokeWidth={2}
                dot={{ r: 4, fill: '#D4A0A0', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#D4A0A0' }}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {hasGad7 && (
              <Line
                type="monotone"
                dataKey="gad7"
                stroke="#6B9080"
                strokeWidth={2}
                dot={{ r: 4, fill: '#6B9080', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#6B9080' }}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        ) : (
          <div
            style={{
              width: '100%',
              height: 240,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#9CA3AF', fontSize: 13 }}>Loading chart...</span>
          </div>
        )}
      </div>

      {/* Severity band legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 10,
          paddingLeft: 4,
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        {bands.map((band) => (
          <span
            key={band.severity}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                width: 10,
                height: 6,
                borderRadius: 2,
                background: getSeverityColor(band.severity),
                opacity: 0.4,
              }}
            />
            {getSeverityLabel(band.severity)} ({band.min}-{band.max})
          </span>
        ))}
      </div>
    </div>
  )
}
