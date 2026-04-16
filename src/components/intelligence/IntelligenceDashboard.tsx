'use client'

/**
 * Intelligence Dashboard
 *
 * Aggregates all 5 intelligence engines in one view.
 * Self-fetches from each /api/intelligence/* endpoint.
 */

import { useEffect, useState } from 'react'
import { Download, ChevronRight } from 'lucide-react'

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
      className="rounded-2xl transition-shadow hover:shadow-md"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        padding: '18px 20px',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: colors.text, letterSpacing: '0.04em' }}>
          {title}
        </h3>
        {subtitle && (
          <span
            className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider shrink-0"
            style={{
              background: colors.border,
              color: '#fff',
              letterSpacing: '0.05em',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {value && (
        <p
          className="font-bold leading-none mb-2.5"
          style={{
            color: colors.text,
            fontSize: 28,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </p>
      )}
      {body && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      )}
      {rows && rows.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${colors.border}` }}>
          {rows.map((r, i) => (
            <div key={i} className="flex items-start justify-between text-xs gap-3">
              <span
                className="capitalize shrink-0"
                style={{ color: 'var(--text-muted)', minWidth: 80 }}
              >
                {r.label}
              </span>
              <span
                className="text-right"
                style={{ color: r.color ?? 'var(--text-primary)', fontWeight: 500 }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IntelCardSkeleton() {
  return (
    <div
      className="rounded-2xl animate-pulse"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: '18px 20px',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: 100 }} />
        <div className="h-4 rounded-full" style={{ background: 'var(--bg-elevated)', width: 56 }} />
      </div>
      <div className="h-7 rounded mb-3" style={{ background: 'var(--bg-elevated)', width: 120 }} />
      <div className="h-3 rounded mb-2" style={{ background: 'var(--bg-elevated)', width: '80%' }} />
      <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: '60%' }} />
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
        gap: 14,
        padding: '20px 16px 96px',
        maxWidth: 680,
        margin: '0 auto',
      }}
    >
      <header className="mb-1">
        <div className="flex items-center gap-2 mb-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2 L13.2 8.8 L20 10 L13.2 11.2 L12 18 L10.8 11.2 L4 10 L10.8 8.8 Z"
              fill="var(--accent-sage)"
              opacity="0.9"
            />
          </svg>
          <h1 className="font-bold" style={{ color: 'var(--text-primary)', fontSize: 26, letterSpacing: '-0.02em' }}>
            Intelligence
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          What the AI knows about your health right now
        </p>
      </header>

      {loading && (
        <>
          <IntelCardSkeleton />
          <IntelCardSkeleton />
          <IntelCardSkeleton />
          <IntelCardSkeleton />
        </>
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
          <div
            className="rounded-2xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              padding: '18px 20px',
            }}
          >
            <h3
              className="text-[13px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}
            >
              Condition Reports
            </h3>
            <p className="text-[11px] mb-3.5" style={{ color: 'var(--text-muted)' }}>
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
                  aria-label={`Download ${c.label} condition report for ${c.doctor}`}
                  className="group text-left py-3 px-3.5 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    border: '1px solid transparent',
                    outlineColor: 'var(--accent-sage)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-sage)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(107, 144, 128, 0.12)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-sage)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        For {c.doctor}
                      </p>
                    </div>
                    <Download
                      size={18}
                      strokeWidth={2}
                      className="transition-transform group-hover:translate-y-0.5"
                      style={{ color: 'var(--accent-sage)', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Links to deeper analysis */}
          <div
            className="rounded-2xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              padding: '18px 20px',
            }}
          >
            <h3
              className="text-[13px] font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}
            >
              Deeper Analysis
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { href: '/doctor', label: 'Doctor Mode', sub: 'Visit prep + clinical PDF', primary: true },
                { href: '/patterns', label: 'Patterns', sub: 'Charts + correlations' },
                { href: '/chat', label: 'AI Research', sub: 'Ask about your health data' },
              ].map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  aria-label={`${link.label}: ${link.sub}`}
                  className="group flex items-center justify-between py-3 px-3.5 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
                  style={{
                    background: link.primary ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                    color: link.primary ? 'var(--accent-sage)' : 'var(--text-primary)',
                    border: '1px solid transparent',
                    textDecoration: 'none',
                    outlineColor: 'var(--accent-sage)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-sage)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <div>
                    <p className="font-medium text-sm">{link.label}</p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: link.primary ? 'var(--accent-sage)' : 'var(--text-muted)', opacity: link.primary ? 0.8 : 1 }}
                    >
                      {link.sub}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    strokeWidth={2}
                    className="transition-transform group-hover:translate-x-0.5"
                    style={{ flexShrink: 0, opacity: 0.7 }}
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
