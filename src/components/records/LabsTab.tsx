'use client'

import { useState, useMemo } from 'react'
import type { LabResult, LabFlag } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function flagColor(flag: LabFlag | null): string {
  switch (flag) {
    case 'low':
      return '#3B82F6'    // blue-500
    case 'high':
      return '#F97316'    // orange-500
    case 'critical':
      return '#EF4444'    // red-500
    case 'normal':
    default:
      return 'var(--accent-sage)'
  }
}

function flagLabel(flag: LabFlag | null): string {
  switch (flag) {
    case 'low':
      return 'Low'
    case 'high':
      return 'High'
    case 'critical':
      return 'Critical'
    case 'normal':
    default:
      return 'Normal'
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TrendChartProps {
  testName: string
  allResults: LabResult[]
}

function TrendChart({ testName, allResults }: TrendChartProps) {
  const trendData = useMemo(() => {
    return allResults
      .filter((r) => r.test_name === testName && r.value !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: formatShortDate(r.date),
        value: r.value as number,
        refLow: r.reference_range_low,
        refHigh: r.reference_range_high,
      }))
  }, [testName, allResults])

  if (trendData.length < 2) return null

  // Use the first item's reference range for the reference lines
  const refLow = trendData[0]?.refLow ?? undefined
  const refHigh = trendData[0]?.refHigh ?? undefined

  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--bg-elevated)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
        {testName} trend
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          {refLow !== undefined && refLow !== null && (
            <ReferenceLine
              y={refLow}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {refHigh !== undefined && refHigh !== null && (
            <ReferenceLine
              y={refHigh}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent-sage)"
            strokeWidth={2}
            dot={{ fill: 'var(--accent-sage)', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface LabsTabProps {
  results: LabResult[]
}

export function LabsTab({ results }: LabsTabProps) {
  const [expandedTrends, setExpandedTrends] = useState<Set<string>>(() => {
    // Auto-expand Ferritin trend
    const initial = new Set<string>()
    if (results.some((r) => r.test_name === 'Ferritin')) {
      initial.add('Ferritin')
    }
    return initial
  })

  // Group by date, most recent first
  const groupedByDate = useMemo(() => {
    const groups: Record<string, LabResult[]> = {}
    for (const r of results) {
      if (!groups[r.date]) groups[r.date] = []
      groups[r.date].push(r)
    }
    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    return sortedDates.map((date) => ({
      date,
      results: groups[date],
    }))
  }, [results])

  // Tests that appear on multiple dates (eligible for trend)
  const trendEligible = useMemo(() => {
    const dateCounts: Record<string, Set<string>> = {}
    for (const r of results) {
      if (!dateCounts[r.test_name]) dateCounts[r.test_name] = new Set()
      dateCounts[r.test_name].add(r.date)
    }
    const eligible = new Set<string>()
    for (const [name, dates] of Object.entries(dateCounts)) {
      if (dates.size >= 2) eligible.add(name)
    }
    return eligible
  }, [results])

  const toggleTrend = (testName: string) => {
    setExpandedTrends((prev) => {
      const next = new Set(prev)
      if (next.has(testName)) {
        next.delete(testName)
      } else {
        next.add(testName)
      }
      return next
    })
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          No lab results yet
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Lab results will appear here once imported
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groupedByDate.map(({ date, results: dateResults }) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-px flex-1"
              style={{ background: 'var(--border-light)' }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wide px-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {formatDate(date)}
            </span>
            <div
              className="h-px flex-1"
              style={{ background: 'var(--border-light)' }}
            />
          </div>

          {/* Results for this date */}
          <div className="card overflow-hidden">
            {dateResults.map((lab, idx) => {
              const showTrendButton = trendEligible.has(lab.test_name)
              const isTrendOpen = expandedTrends.has(lab.test_name)

              return (
                <div key={lab.id}>
                  {idx > 0 && (
                    <div className="mx-4" style={{ borderTop: '1px solid var(--border-light)' }} />
                  )}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Test name */}
                      <span
                        className="text-sm font-medium flex-1 min-w-0 truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {lab.test_name}
                      </span>

                      {/* Value + unit + flag dot */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {lab.value !== null ? lab.value : '--'}
                          {lab.unit && (
                            <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                              {lab.unit}
                            </span>
                          )}
                        </span>
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: flagColor(lab.flag) }}
                          title={flagLabel(lab.flag)}
                        />
                      </div>
                    </div>

                    {/* Reference range */}
                    {(lab.reference_range_low !== null || lab.reference_range_high !== null) && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Ref: {lab.reference_range_low ?? '--'} - {lab.reference_range_high ?? '--'} {lab.unit || ''}
                      </p>
                    )}

                    {/* Trend button */}
                    {showTrendButton && (
                      <button
                        onClick={() => toggleTrend(lab.test_name)}
                        className="touch-target mt-1 text-xs font-medium rounded-md px-2 py-1"
                        style={{
                          color: 'var(--accent-sage)',
                          background: isTrendOpen ? 'var(--accent-sage-muted)' : 'transparent',
                        }}
                      >
                        {isTrendOpen ? 'Hide trend' : 'Show trend'}
                      </button>
                    )}

                    {/* Inline trend chart */}
                    {isTrendOpen && (
                      <TrendChart testName={lab.test_name} allResults={results} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
