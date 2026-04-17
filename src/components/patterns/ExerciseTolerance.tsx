'use client'

/**
 * Exercise Tolerance Trend
 *
 * Self-fetching component that queries /api/intelligence/exercise
 * for chronic illness exercise analysis. Shows safe ceilings,
 * position progression, and weekly capacity.
 *
 * Unique to LanaeHealth -- no competitor tracks this.
 */

import { useMemo, useState, useEffect } from 'react'

interface WorkoutEntry {
  date: string
  type: string
  duration: number
  intensity: 'gentle' | 'moderate' | 'vigorous'
  position: 'recumbent' | 'seated' | 'standing' | 'mixed'
  preSymptom: number | null
  postSymptom: number | null
}

interface ExerciseIntelData {
  ceilings: Array<{ intensity: string; maxSafeMinutes: number | null; flareRate: number; sampleSize: number; recommendation: string }>
  positionProgression: { recumbent: { count: number }; seated: { count: number }; standing: { count: number }; currentLevel: string; readyToProgress: boolean; progressionMessage: string }
  bestActivityTypes: Array<{ type: string; avgFlareRate: number; count: number }>
  worstActivityTypes: Array<{ type: string; avgFlareRate: number; count: number }>
  weeklyCapacity: { estimatedMinutes: number; currentUsage: number; remaining: number }
  overallRecommendation: string
}

interface ExerciseToleranceProps {
  workouts?: WorkoutEntry[]
}

function getIntensityColor(intensity: string): string {
  switch (intensity) {
    case 'gentle': return 'var(--accent-sage)'
    case 'moderate': return '#F57F17'
    case 'vigorous': return '#C62828'
    default: return 'var(--text-muted)'
  }
}

function getPositionLabel(pos: string): string {
  switch (pos) {
    case 'recumbent': return 'Lying/recumbent'
    case 'seated': return 'Seated'
    case 'standing': return 'Standing/upright'
    case 'mixed': return 'Mixed positions'
    default: return pos
  }
}

export function ExerciseToleranceSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4 animate-pulse"
           style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <div className="h-4 w-40 rounded mb-4" style={{ background: 'var(--border-light)' }} />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="text-center space-y-2">
              <div className="h-6 w-10 mx-auto rounded" style={{ background: 'var(--border-light)' }} />
              <div className="h-3 w-12 mx-auto rounded" style={{ background: 'var(--border-light)' }} />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex justify-between py-1">
              <div className="h-3 w-16 rounded" style={{ background: 'var(--border-light)' }} />
              <div className="h-3 w-24 rounded" style={{ background: 'var(--border-light)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ExerciseTolerance({ workouts = [] }: ExerciseToleranceProps) {
  const [intelData, setIntelData] = useState<ExerciseIntelData | null>(null)
  const [loading, setLoading] = useState(false)

  // Self-fetch from intelligence API
  useEffect(() => {
    setLoading(true)
    fetch('/api/intelligence/exercise')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setIntelData(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // HOOKS MUST RUN UNCONDITIONALLY. Compute prop-based analysis upfront so the
  // hook order stays stable regardless of which branch renders below.
  const analysis = useMemo(() => {
    if (workouts.length < 3) return null

    const last30 = workouts.filter(w => {
      const d = new Date(w.date)
      return d >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    })

    // Total workouts
    const totalWorkouts = last30.length
    const avgDuration = Math.round(last30.reduce((s, w) => s + w.duration, 0) / last30.length)

    // Post-exercise symptom flare rate
    const withPostSymptom = last30.filter(w => w.postSymptom !== null)
    const flareWorkouts = withPostSymptom.filter(w => (w.postSymptom ?? 0) >= 4)
    const flareRate = withPostSymptom.length > 0
      ? Math.round(flareWorkouts.length / withPostSymptom.length * 100)
      : null

    // Position breakdown
    const positionCounts = { recumbent: 0, seated: 0, standing: 0, mixed: 0 }
    for (const w of last30) {
      positionCounts[w.position] = (positionCounts[w.position] ?? 0) + 1
    }

    // Safe ceiling estimate (max duration at each intensity without flare)
    const safeCeiling: Record<string, number> = {}
    for (const intensity of ['gentle', 'moderate', 'vigorous']) {
      const atIntensity = last30.filter(w => w.intensity === intensity && w.postSymptom !== null)
      const noFlare = atIntensity.filter(w => (w.postSymptom ?? 0) <= 3)
      if (noFlare.length > 0) {
        safeCeiling[intensity] = Math.max(...noFlare.map(w => w.duration))
      }
    }

    // Trend: are workouts getting longer/harder over time?
    const firstHalf = last30.slice(0, Math.floor(last30.length / 2))
    const secondHalf = last30.slice(Math.floor(last30.length / 2))
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, w) => s + w.duration, 0) / firstHalf.length : 0
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, w) => s + w.duration, 0) / secondHalf.length : 0
    const durationTrend = secondAvg - firstAvg

    return {
      totalWorkouts,
      avgDuration,
      flareRate,
      positionCounts,
      safeCeiling,
      durationTrend,
    }
  }, [workouts])

  // ── All hooks above this line. Branch-render below. ──

  if (loading && !intelData && workouts.length === 0) {
    return <ExerciseToleranceSkeleton />
  }

  // If we have API data and it has real content, show that instead of prop-based analysis
  if (intelData && intelData.weeklyCapacity.estimatedMinutes > 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <h3 className="text-[13px] font-semibold uppercase tracking-wide mb-3"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            Exercise Tolerance
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <p className="tabular text-lg font-bold" style={{ color: 'var(--accent-sage)' }}>
                {intelData.weeklyCapacity.currentUsage}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>min this week</p>
            </div>
            <div className="text-center">
              <p className="tabular text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {intelData.weeklyCapacity.estimatedMinutes}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>min capacity</p>
            </div>
            <div className="text-center">
              <p className="tabular text-lg font-bold" style={{ color: intelData.weeklyCapacity.remaining > 0 ? 'var(--accent-sage)' : '#C62828' }}>
                {intelData.weeklyCapacity.remaining}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>remaining</p>
            </div>
          </div>
          {intelData.ceilings.filter(c => c.sampleSize > 0).map(c => (
            <div key={c.intensity} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border-light)' }}>
              <span className="text-xs font-medium capitalize" style={{ color: getIntensityColor(c.intensity) }}>
                {c.intensity}
              </span>
              <span className="tabular text-xs" style={{ color: 'var(--text-secondary)' }}>
                {c.maxSafeMinutes ? `${c.maxSafeMinutes}min safe` : 'Not enough data yet'} ({c.flareRate}% flare rate)
              </span>
            </div>
          ))}
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            {intelData.overallRecommendation}
          </p>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="empty-state" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
        <h3 className="empty-state__title">Exercise tolerance is waiting for a few sessions.</h3>
        <p className="empty-state__hint">
          Log at least 3 workouts with pre and post symptom checks, and we will start showing your tolerance trends here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Overview */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Exercise Tolerance (30 days)
        </h3>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: 'var(--accent-sage)' }}>
              {analysis.totalWorkouts}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>workouts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {analysis.avgDuration}m
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>avg duration</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{
              color: (analysis.flareRate ?? 0) > 30 ? '#C62828' : 'var(--accent-sage)',
            }}>
              {analysis.flareRate !== null ? `${analysis.flareRate}%` : '--'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>flare rate</p>
          </div>
        </div>

        {/* Duration trend */}
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Duration trend:</span>
          <span className="text-xs font-semibold" style={{
            color: analysis.durationTrend > 0 ? 'var(--accent-sage)' : analysis.durationTrend < 0 ? '#C62828' : 'var(--text-muted)',
          }}>
            {analysis.durationTrend > 0 ? '+' : ''}{Math.round(analysis.durationTrend)}min/workout
            {analysis.durationTrend > 0 ? ' (improving!)' : analysis.durationTrend < 0 ? ' (decreasing)' : ' (stable)'}
          </span>
        </div>
      </div>

      {/* Safe Ceiling */}
      {Object.keys(analysis.safeCeiling).length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Safe Exercise Ceiling
          </h3>
          <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
            Max duration without post-exercise symptom flare
          </p>
          <div className="space-y-2">
            {Object.entries(analysis.safeCeiling).map(([intensity, maxDur]) => (
              <div key={intensity} className="flex items-center justify-between">
                <span
                  className="text-xs font-medium capitalize"
                  style={{ color: getIntensityColor(intensity) }}
                >
                  {intensity}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full" style={{
                    width: `${Math.min(maxDur, 60) * 1.5}px`,
                    background: getIntensityColor(intensity),
                    opacity: 0.3,
                  }} />
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {maxDur} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Position Progression */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Position Breakdown
        </h3>
        <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          POTS protocol: progress from recumbent to standing over time
        </p>
        <div className="space-y-1.5">
          {(['recumbent', 'seated', 'standing', 'mixed'] as const).map(pos => {
            const count = analysis.positionCounts[pos]
            if (count === 0) return null
            const pct = Math.round(count / analysis.totalWorkouts * 100)
            return (
              <div key={pos} className="flex items-center gap-2">
                <span className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>
                  {getPositionLabel(pos)}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: 'var(--accent-sage)' }}
                  />
                </div>
                <span className="text-xs font-medium w-8 text-right" style={{ color: 'var(--text-primary)' }}>
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
