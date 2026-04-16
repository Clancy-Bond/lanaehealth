'use client'

/**
 * Intelligence Dashboard
 *
 * Aggregates all 5 intelligence engines in one view.
 * Self-fetches from each /api/intelligence/* endpoint.
 */

import { useEffect, useState } from 'react'

interface CycleIntel {
  currentPhase: string
  phaseConfidence: string
  cycleDay: number | null
  ovulation: { detected: boolean; estimatedDay: string | null; confidenceWindow: number; signals: Array<{ type: string; description: string }> }
  nextPeriod: { estimatedDay: string | null; confidenceWindow: number; confidence: string }
  fertileWindow: { isCurrentlyFertile: boolean }
  flags: Array<{ type: string; message: string; severity: string }>
  signalSummary: string
}

interface NutritionIntel {
  dailyCalories: number
  protein: number
  fat: number
  carbs: number
  tdeeEstimate: number
  weeklyAdjustment: number
  confidence: string
  explanation: string
}

interface ExerciseIntel {
  ceilings: Array<{ intensity: string; maxSafeMinutes: number | null; flareRate: number; sampleSize: number }>
  positionProgression: { currentLevel: string; progressionMessage: string; readyToProgress: boolean }
  weeklyCapacity: { estimatedMinutes: number; currentUsage: number; remaining: number }
  overallRecommendation: string
}

interface VitalsIntel {
  latestOrthostatic: { hrDelta: number; classification: string; meetsPOTSThreshold: boolean } | null
  thirtyDayTrend: { avgDelta: number | null; deltaDirection: string; meetsPOTSCount: number; totalTests: number }
  todayOutlier: { isOutlier: boolean; deviatingMetrics: string[]; severity: string } | null
  recommendations: string[]
}

interface Card {
  title: string
  subtitle?: string
  value?: string
  status?: 'good' | 'warn' | 'critical' | 'neutral'
  body?: string
  rows?: Array<{ label: string; value: string; color?: string }>
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  good: { bg: 'var(--accent-sage-muted)', border: 'var(--accent-sage)', text: 'var(--accent-sage)' },
  warn: { bg: '#FFF3E0', border: '#FFE082', text: '#E65100' },
  critical: { bg: '#FFEBEE', border: '#EF9A9A', text: '#C62828' },
  neutral: { bg: 'var(--bg-card)', border: 'var(--border-light)', text: 'var(--text-primary)' },
}

function IntelCard({ title, subtitle, value, status = 'neutral', body, rows }: Card) {
  const colors = STATUS_COLORS[status]
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: colors.text }}>{title}</h3>
        {subtitle && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: colors.border, color: '#fff' }}>
            {subtitle}
          </span>
        )}
      </div>
      {value && (
        <p className="text-xl font-bold mb-1" style={{ color: colors.text }}>{value}</p>
      )}
      {body && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      )}
      {rows && rows.length > 0 && (
        <div className="space-y-1 mt-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
              <span style={{ color: r.color ?? 'var(--text-primary)', fontWeight: 500 }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function IntelligenceDashboard() {
  const [cycle, setCycle] = useState<CycleIntel | null>(null)
  const [nutrition, setNutrition] = useState<NutritionIntel | null>(null)
  const [exercise, setExercise] = useState<ExerciseIntel | null>(null)
  const [vitals, setVitals] = useState<VitalsIntel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAll() {
      const [c, n, e, v] = await Promise.all([
        fetch('/api/intelligence/cycle').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/intelligence/nutrition?goal=maintain').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/intelligence/exercise').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/intelligence/vitals').then(r => r.ok ? r.json() : null).catch(() => null),
      ])
      setCycle(c)
      setNutrition(n)
      setExercise(e)
      setVitals(v)
      setLoading(false)
    }
    loadAll()
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px 16px 80px',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <header>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Intelligence</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          What the AI knows about your health right now
        </p>
      </header>

      {loading && (
        <div className="py-10 text-center">
          <div className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--accent-sage-muted)', borderTopColor: 'var(--accent-sage)' }} />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Analyzing your data...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Cycle Intelligence */}
          {cycle && (
            <IntelCard
              title={`${cycle.currentPhase.replace('_', ' ')} phase`}
              subtitle={cycle.phaseConfidence}
              status={cycle.fertileWindow.isCurrentlyFertile ? 'warn' : 'good'}
              value={cycle.cycleDay ? `Day ${cycle.cycleDay}` : undefined}
              body={cycle.signalSummary}
              rows={[
                ...(cycle.nextPeriod.estimatedDay ? [{
                  label: 'Next period',
                  value: `${cycle.nextPeriod.estimatedDay} (\u00B1${cycle.nextPeriod.confidenceWindow}d)`,
                }] : []),
                ...(cycle.ovulation.detected && cycle.ovulation.estimatedDay ? [{
                  label: 'Ovulation',
                  value: cycle.ovulation.estimatedDay,
                  color: 'var(--accent-sage)',
                }] : []),
                ...cycle.flags.map(f => ({
                  label: f.type.replace('_', ' '),
                  value: f.message,
                  color: f.severity === 'concern' ? '#C62828' : f.severity === 'attention' ? '#E65100' : 'var(--text-muted)',
                })),
              ]}
            />
          )}

          {/* Adaptive Nutrition */}
          {nutrition && (
            <IntelCard
              title="Daily Target"
              subtitle={nutrition.confidence}
              status="good"
              value={`${nutrition.dailyCalories} kcal`}
              body={nutrition.explanation}
              rows={[
                { label: 'Protein', value: `${nutrition.protein}g` },
                { label: 'Fat', value: `${nutrition.fat}g` },
                { label: 'Carbs', value: `${nutrition.carbs}g` },
                { label: 'TDEE estimate', value: `${nutrition.tdeeEstimate} kcal`, color: 'var(--text-muted)' },
                ...(nutrition.weeklyAdjustment !== 0 ? [{
                  label: 'Weekly adjustment',
                  value: `${nutrition.weeklyAdjustment > 0 ? '+' : ''}${nutrition.weeklyAdjustment} cal/day`,
                  color: nutrition.weeklyAdjustment > 0 ? 'var(--accent-sage)' : '#E65100',
                }] : []),
              ]}
            />
          )}

          {/* Exercise Intelligence */}
          {exercise && exercise.weeklyCapacity.estimatedMinutes > 0 && (
            <IntelCard
              title="Exercise capacity"
              subtitle={exercise.positionProgression.currentLevel}
              status={exercise.weeklyCapacity.remaining > 0 ? 'good' : 'warn'}
              value={`${exercise.weeklyCapacity.currentUsage} / ${exercise.weeklyCapacity.estimatedMinutes} min`}
              body={exercise.overallRecommendation}
              rows={exercise.ceilings
                .filter(c => c.sampleSize > 0)
                .map(c => ({
                  label: c.intensity,
                  value: c.maxSafeMinutes ? `${c.maxSafeMinutes}min safe (${c.flareRate}% flare)` : 'No data',
                  color: c.flareRate >= 40 ? '#C62828' : c.flareRate >= 20 ? '#E65100' : 'var(--accent-sage)',
                }))}
            />
          )}

          {/* Vitals Intelligence */}
          {vitals && (
            <IntelCard
              title="Vitals"
              subtitle={vitals.thirtyDayTrend.deltaDirection}
              status={
                vitals.thirtyDayTrend.deltaDirection === 'worsening' ? 'critical' :
                vitals.thirtyDayTrend.deltaDirection === 'improving' ? 'good' :
                vitals.todayOutlier?.isOutlier ? 'warn' : 'neutral'
              }
              value={vitals.latestOrthostatic ? `+${vitals.latestOrthostatic.hrDelta} bpm` : undefined}
              body={vitals.latestOrthostatic?.classification}
              rows={[
                ...(vitals.thirtyDayTrend.avgDelta !== null ? [{
                  label: '30-day avg delta',
                  value: `${vitals.thirtyDayTrend.avgDelta} bpm`,
                }] : []),
                ...(vitals.thirtyDayTrend.totalTests > 0 ? [{
                  label: 'POTS threshold met',
                  value: `${vitals.thirtyDayTrend.meetsPOTSCount} of ${vitals.thirtyDayTrend.totalTests} tests`,
                  color: vitals.thirtyDayTrend.meetsPOTSCount > vitals.thirtyDayTrend.totalTests / 2 ? '#C62828' : 'var(--text-primary)',
                }] : []),
                ...(vitals.todayOutlier?.isOutlier ? [{
                  label: 'Today outlier',
                  value: vitals.todayOutlier.deviatingMetrics.join(', '),
                  color: '#E65100',
                }] : []),
                ...vitals.recommendations.slice(0, 2).map(r => ({
                  label: 'Recommendation',
                  value: r,
                  color: 'var(--text-secondary)',
                })),
              ]}
            />
          )}

          {/* Empty state */}
          {!cycle && !nutrition && !exercise && !vitals && (
            <div className="py-10 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Keep logging your daily health data. As you do, the AI will surface
                patterns and predictions here.
              </p>
            </div>
          )}

          {/* Condition-specific reports */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Condition Reports
            </h3>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Download clinical reports formatted for specific specialists.
            </p>
            <div className="flex flex-col gap-2">
              {[
                { type: 'endometriosis', label: 'Endometriosis', doctor: 'OB/GYN or Reproductive Endocrinologist' },
                { type: 'pots', label: 'POTS / Dysautonomia', doctor: 'Cardiologist or Autonomic Specialist' },
                { type: 'ibs', label: 'IBS / Digestive', doctor: 'Gastroenterologist' },
              ].map(c => (
                <button
                  key={c.type}
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/reports/condition?type=${c.type}&days=90`)
                      if (!res.ok) return
                      const data = await res.json()
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `lanaehealth-${c.type}-report-${new Date().toISOString().slice(0, 10)}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    } catch { /* silent */ }
                  }}
                  className="text-left text-sm py-2.5 px-3 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.label}</span>
                    <span style={{ fontSize: 14, color: 'var(--accent-sage)' }}>{'\u2193'}</span>
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    For {c.doctor}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Links to deeper analysis */}
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Deeper analysis
            </h3>
            <div className="flex flex-col gap-2">
              <a href="/doctor" className="text-sm py-2 px-3 rounded-lg"
                style={{ background: 'var(--accent-sage-muted)', color: 'var(--accent-sage)' }}>
                Doctor Mode (visit prep + clinical PDF)
              </a>
              <a href="/patterns" className="text-sm py-2 px-3 rounded-lg"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                Patterns page (charts + correlations)
              </a>
              <a href="/chat" className="text-sm py-2 px-3 rounded-lg"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                Ask AI about your health data
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
