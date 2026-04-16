'use client'

/**
 * Food-Symptom Heatmap
 *
 * Self-fetching component that queries /api/intelligence/food-symptoms
 * for computed correlations. Grid: foods on Y, symptoms on X,
 * color intensity = correlation strength.
 *
 * Visual design notes:
 * - Warm-modern palette: muted sage for helpful, warm blush for triggers
 * - Diverging color scale with clear neutral zone
 * - Loading skeleton for self-fetching case
 * - Accessible: cells have aria-labels, table has caption
 */

import { useState, useEffect } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface FoodHeatmapProps {
  correlations?: Array<{
    food: string
    symptom: string
    score: number          // -1 to +1 (negative = food helps, positive = food triggers)
    occurrences: number
  }>
}

// Warm-modern diverging palette
function getHeatColor(score: number): string {
  if (score >= 0.5) return '#B85450'    // Strong trigger (deep blush)
  if (score >= 0.3) return '#D4766B'    // Moderate trigger
  if (score >= 0.1) return '#E8B5A6'    // Mild trigger (light blush)
  if (score <= -0.3) return '#6B9080'   // Helpful (sage)
  if (score <= -0.1) return '#A6BFAE'   // Mildly helpful (light sage)
  return '#F2EDE4'                       // Neutral (warm cream)
}

function getHeatTextColor(score: number): string {
  return Math.abs(score) >= 0.3 ? '#ffffff' : '#8A7F6E'
}

export function FoodHeatmapSkeleton() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
    >
      <div className="h-4 w-32 rounded mb-4" style={{ background: 'var(--border-light)' }} />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-20 rounded" style={{ background: 'var(--border-light)' }} />
            <div className="flex gap-1 flex-1">
              {[0, 1, 2, 3, 4, 5].map(j => (
                <div key={j} className="w-9 h-9 rounded"
                     style={{ background: 'var(--bg-muted)' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FoodHeatmap({ correlations: propCorrelations }: FoodHeatmapProps) {
  const [fetchedCorrelations, setFetchedCorrelations] = useState<FoodHeatmapProps['correlations']>(undefined)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (propCorrelations && propCorrelations.length > 0) return
    setLoading(true)
    fetch('/api/intelligence/food-symptoms')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.correlations?.length > 0) {
          setFetchedCorrelations(data.correlations)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [propCorrelations])

  if (loading && !propCorrelations) {
    return <FoodHeatmapSkeleton />
  }

  const correlations = (propCorrelations && propCorrelations.length > 0)
    ? propCorrelations
    : fetchedCorrelations ?? []

  if (correlations.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
             style={{ background: 'var(--bg-muted)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          No correlations yet
        </p>
        <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          Keep logging meals with trigger flags and next-day symptoms to surface patterns.
        </p>
      </div>
    )
  }

  const foods = [...new Set(correlations.map(c => c.food))].slice(0, 10)
  const symptoms = [...new Set(correlations.map(c => c.symptom))].slice(0, 6)

  const lookup = new Map<string, number>()
  for (const c of correlations) {
    lookup.set(`${c.food}|${c.symptom}`, c.score)
  }

  const cellSize = 38

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
    >
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          Food to Symptom Patterns
        </h3>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Next-day correlations across {correlations.length} data points
        </p>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table style={{ borderCollapse: 'separate', borderSpacing: 2 }}
               role="table"
               aria-label="Food and symptom correlation heatmap">
          <caption className="sr-only">
            Heatmap showing correlations between foods logged and next-day symptoms.
            Red cells indicate triggers, green cells indicate helpful foods, neutral cells indicate no clear pattern.
          </caption>
          <thead>
            <tr>
              <th style={{ width: 84 }} scope="col">
                <span className="sr-only">Food</span>
              </th>
              {symptoms.map(s => (
                <th
                  key={s}
                  scope="col"
                  style={{
                    width: cellSize,
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    padding: '0 2px 8px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'bottom',
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    display: 'inline-block',
                    textTransform: 'capitalize',
                  }}>
                    {s}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {foods.map(food => (
              <tr key={food}>
                <th
                  scope="row"
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    paddingRight: 10,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    maxWidth: 84,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textTransform: 'capitalize',
                  }}
                >
                  {food}
                </th>
                {symptoms.map(symptom => {
                  const score = lookup.get(`${food}|${symptom}`) ?? 0
                  const magnitude = Math.abs(score)
                  const directionLabel = score > 0 ? 'increases' : score < 0 ? 'decreases' : 'no effect on'
                  const percentLabel = Math.round(magnitude * 100)
                  return (
                    <td key={symptom} style={{ padding: 0 }}>
                      <div
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 6,
                          background: getHeatColor(score),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 150ms ease, box-shadow 150ms ease',
                          cursor: magnitude >= 0.1 ? 'help' : 'default',
                        }}
                        title={`${food} ${directionLabel} ${symptom}${magnitude >= 0.1 ? ` by ${percentLabel}%` : ''}`}
                        aria-label={`${food} ${directionLabel} ${symptom}${magnitude >= 0.1 ? ` by ${percentLabel} percent` : ''}`}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'
                          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
                          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                        }}
                      >
                        {magnitude >= 0.3 && (
                          score > 0 ? (
                            <ArrowUp size={12} color={getHeatTextColor(score)} strokeWidth={2.5} />
                          ) : (
                            <ArrowDown size={12} color={getHeatTextColor(score)} strokeWidth={2.5} />
                          )
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3"
           style={{ borderTop: '1px solid var(--border-light)' }}>
        <div className="flex items-center gap-1.5">
          <div className="flex">
            <div className="w-3 h-3 rounded-l" style={{ background: '#6B9080' }} />
            <div className="w-3 h-3" style={{ background: '#A6BFAE' }} />
          </div>
          <span className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Helpful
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ background: '#F2EDE4' }} />
          <span className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Neutral
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex">
            <div className="w-3 h-3" style={{ background: '#E8B5A6' }} />
            <div className="w-3 h-3 rounded-r" style={{ background: '#B85450' }} />
          </div>
          <span className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Trigger
          </span>
        </div>
      </div>
    </div>
  )
}
