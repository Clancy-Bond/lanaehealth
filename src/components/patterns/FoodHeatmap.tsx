'use client'

/**
 * Food-Symptom Heatmap
 *
 * Self-fetching component that queries /api/intelligence/food-symptoms
 * for computed correlations. Grid: foods on Y, symptoms on X,
 * color intensity = correlation strength.
 */

import { useState, useEffect } from 'react'

interface FoodHeatmapProps {
  correlations?: Array<{
    food: string
    symptom: string
    score: number          // -1 to +1 (negative = food helps, positive = food triggers)
    occurrences: number
  }>
}

function getHeatColor(score: number): string {
  if (score >= 0.5) return '#B71C1C'    // Strong trigger
  if (score >= 0.3) return '#E53935'    // Moderate trigger
  if (score >= 0.1) return '#EF9A9A'    // Mild trigger
  if (score <= -0.3) return '#2E7D32'   // Helpful
  if (score <= -0.1) return '#81C784'   // Mildly helpful
  return 'var(--bg-elevated)'           // Neutral
}

export default function FoodHeatmap({ correlations: propCorrelations }: FoodHeatmapProps) {
  const [fetchedCorrelations, setFetchedCorrelations] = useState<FoodHeatmapProps['correlations']>(undefined)

  // Self-fetch from API if no props provided
  useEffect(() => {
    if (propCorrelations && propCorrelations.length > 0) return
    fetch('/api/intelligence/food-symptoms')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.correlations?.length > 0) {
          setFetchedCorrelations(data.correlations)
        }
      })
      .catch(() => {})
  }, [propCorrelations])

  const correlations = (propCorrelations && propCorrelations.length > 0)
    ? propCorrelations
    : fetchedCorrelations ?? []
  if (correlations.length === 0) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Food-Symptom Heatmap
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Keep logging meals with trigger flags and symptoms. Need enough data to find patterns.
        </p>
      </div>
    )
  }

  // Build unique foods and symptoms
  const foods = [...new Set(correlations.map(c => c.food))].slice(0, 10)
  const symptoms = [...new Set(correlations.map(c => c.symptom))].slice(0, 6)

  // Build lookup
  const lookup = new Map<string, number>()
  for (const c of correlations) {
    lookup.set(`${c.food}|${c.symptom}`, c.score)
  }

  const cellSize = 36

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Food-Symptom Heatmap
      </h3>

      <div className="overflow-x-auto">
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 80 }} />
              {symptoms.map(s => (
                <th
                  key={s}
                  style={{
                    width: cellSize,
                    fontSize: 9,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    padding: '0 2px 4px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', display: 'inline-block' }}>
                    {s}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {foods.map(food => (
              <tr key={food}>
                <td
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    paddingRight: 8,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    maxWidth: 80,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {food}
                </td>
                {symptoms.map(symptom => {
                  const score = lookup.get(`${food}|${symptom}`) ?? 0
                  return (
                    <td key={symptom} style={{ padding: 1 }}>
                      <div
                        style={{
                          width: cellSize - 2,
                          height: cellSize - 2,
                          borderRadius: 4,
                          background: getHeatColor(score),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={`${food} + ${symptom}: ${score > 0 ? '+' : ''}${Math.round(score * 100)}%`}
                      >
                        {Math.abs(score) >= 0.3 && (
                          <span style={{ fontSize: 10, color: 'white' }}>
                            {score > 0 ? '\u2191' : '\u2193'}
                          </span>
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
      <div className="flex items-center justify-center gap-3 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#2E7D32' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Helpful</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: 'var(--bg-elevated)' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#E53935' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Trigger</span>
        </div>
      </div>
    </div>
  )
}
