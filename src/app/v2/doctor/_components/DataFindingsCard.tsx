'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, ResponsiveContainer } from 'recharts'
import { Card } from '@/v2/components/primitives'
import DoctorPanelHeader from './DoctorPanelHeader'
import { DataFindingsExplainer } from './MetricExplainers'
import { useLabGrouping, type LabTrendGroup, type LabTrendPoint } from './useLabGrouping'
import type { DoctorPageData } from '@/app/doctor/page'
import { bucketVisible, type SpecialistView } from '@/lib/doctor/specialist-config'

interface DataFindingsCardProps {
  data: DoctorPageData
  view: SpecialistView
}

interface TrendTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: { dateLabel: string; flag: string | null } }>
  unit: string | null
}

function TrendTooltip({ active, payload, unit }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]
  return (
    <div
      style={{
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
        borderRadius: 'var(--v2-radius-sm)',
        padding: 'var(--v2-space-2) var(--v2-space-3)',
        boxShadow: 'var(--v2-shadow-md)',
        fontSize: 'var(--v2-text-sm)',
      }}
    >
      <div style={{ fontWeight: 'var(--v2-weight-semibold)', color: 'var(--v2-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {p.value}
        {unit && <span style={{ fontWeight: 'var(--v2-weight-regular)', color: 'var(--v2-text-secondary)' }}> {unit}</span>}
      </div>
      <div style={{ color: 'var(--v2-text-muted)', fontSize: 'var(--v2-text-xs)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {p.payload.dateLabel}
        {p.payload.flag && p.payload.flag !== 'normal' && (
          <span
            style={{
              marginLeft: 6,
              color: 'var(--v2-accent-warning)',
              textTransform: 'uppercase',
              fontWeight: 'var(--v2-weight-semibold)',
              fontSize: 'var(--v2-text-xs)',
            }}
          >
            {p.payload.flag}
          </span>
        )}
      </div>
    </div>
  )
}

function LabTrend({ group }: { group: LabTrendGroup }) {
  const { testName, unit, refLow, refHigh, points } = group
  const values = points.map((p) => p.value)
  const minV = Math.min(...values, refLow ?? Infinity)
  const maxV = Math.max(...values, refHigh ?? -Infinity)
  const padding = (maxV - minV) * 0.2 || 1
  const yMin = minV - padding
  const yMax = maxV + padding
  const latest = points[points.length - 1]
  const trendDirection: 'up' | 'down' | 'flat' =
    points.length > 1
      ? points[points.length - 1].value > points[0].value
        ? 'up'
        : points[points.length - 1].value < points[0].value
          ? 'down'
          : 'flat'
      : 'flat'
  const hasAbnormal = points.some((p) => p.flag && p.flag !== 'normal')
  const trendIntent = trendDirection === 'flat' ? 'stable' : trendDirection === 'up' ? 'trending up' : 'trending down'
  return (
    <div
      style={{
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-sm)',
        background: 'var(--v2-bg-elevated)',
        border: hasAbnormal ? '1px solid rgba(217, 119, 92, 0.35)' : '1px solid var(--v2-border-subtle)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--v2-space-2)' }}>
        <h4 style={{ margin: 0, fontSize: 'var(--v2-text-sm)', fontWeight: 'var(--v2-weight-semibold)', color: 'var(--v2-text-primary)' }}>
          {testName}
        </h4>
        <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          Latest: <strong style={{ color: 'var(--v2-text-primary)' }}>{latest.value}</strong>
          {unit && <span> {unit}</span>} · {trendIntent}
        </div>
      </div>
      {refLow !== null && refHigh !== null && (
        <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)', marginTop: 2 }}>
          Ref: {refLow}–{refHigh} {unit ?? ''}
        </div>
      )}
      <div style={{ marginTop: 'var(--v2-space-2)', width: '100%', height: 140, minWidth: 0 }}>
        <ChartMount>
          <ResponsiveContainer width="100%" height="100%" debounce={0}>
            <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: 'var(--v2-text-muted)' }}
              stroke="var(--v2-border)"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: 'var(--v2-text-muted)' }}
              stroke="var(--v2-border)"
              width={32}
            />
            {refLow !== null && refHigh !== null && (
              <ReferenceArea
                y1={refLow}
                y2={refHigh}
                fill="var(--v2-accent-success)"
                fillOpacity={0.08}
                stroke="none"
              />
            )}
            {refLow !== null && <ReferenceLine y={refLow} stroke="var(--v2-accent-success)" strokeOpacity={0.4} strokeDasharray="3 3" />}
            {refHigh !== null && <ReferenceLine y={refHigh} stroke="var(--v2-accent-success)" strokeOpacity={0.4} strokeDasharray="3 3" />}
            <Tooltip content={<TrendTooltip unit={unit} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--v2-accent-primary)"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props as { cx: number; cy: number; payload: LabTrendPoint }
                const abnormal = payload.flag && payload.flag !== 'normal'
                return (
                  <circle
                    key={payload.date}
                    cx={cx}
                    cy={cy}
                    r={abnormal ? 5 : 3}
                    fill={abnormal ? 'var(--v2-accent-warning)' : 'var(--v2-accent-primary)'}
                    stroke={abnormal ? 'var(--v2-accent-warning)' : 'var(--v2-accent-primary)'}
                  />
                )
              }}
            />
            </LineChart>
          </ResponsiveContainer>
        </ChartMount>
      </div>
    </div>
  )
}

/*
 * ChartMount
 *
 * Recharts' ResponsiveContainer measures its parent during the first
 * render pass. Inside a Next.js server-rendered tree this fires
 * before layout has settled and recharts logs a noisy
 * "width(-1) and height(-1)" warning even though the chart paints
 * correctly on the next tick. Gating on a post-mount effect skips
 * the bad first measure entirely without changing visible behavior.
 */
function ChartMount({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  return <>{children}</>
}

/*
 * DataFindingsCard
 *
 * Lab-trend charts for the 6 most important repeat tests. Reference
 * ranges show as a faint band so the doctor can eyeball "is the
 * current value in range" without reading the number. Abnormal
 * points are enlarged and tinted warning. Bucket-gated on `labs`.
 */
export default function DataFindingsCard({ data, view }: DataFindingsCardProps) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  const groups = useLabGrouping(data.allLabs)
  if (!bucketVisible(view, 'labs') || groups.length === 0) return null
  const abnormalCount = groups.filter((g) => g.points.some((p) => p.flag && p.flag !== 'normal')).length
  const summary =
    abnormalCount > 0
      ? `${abnormalCount} of ${groups.length} tracked tests have recent abnormals`
      : `${groups.length} tests tracking in range`

  return (
    <Card padding="md">
      <DoctorPanelHeader
        title="Lab trends"
        summary={summary}
        onExplain={() => setExplainerOpen(true)}
        explainLabel="Learn about abnormal flags and trend detection"
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--v2-space-3)',
        }}
      >
        {groups.map((g) => (
          <LabTrend key={g.testName} group={g} />
        ))}
      </div>
      <DataFindingsExplainer open={explainerOpen} onClose={() => setExplainerOpen(false)} />
    </Card>
  )
}
