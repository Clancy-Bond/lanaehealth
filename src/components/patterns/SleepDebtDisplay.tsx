'use client'

/**
 * Sleep Debt & Consistency Display
 *
 * Shows derived sleep metrics that no single wearable provides:
 * - Sleep Debt accumulation with trend indicator
 * - Sleep Consistency score with bed/wake variability
 * - Unrefreshing Sleep Index
 * - Dynamic Sleep Need estimate
 */

import { useMemo } from 'react'
import { calculateSleepMetrics, type SleepDayData } from '@/lib/api/sleep-metrics'

interface SleepDebtDisplayProps {
  sleepData: SleepDayData[]
  cyclePhase?: string | null
  activityLevel?: 'low' | 'moderate' | 'high'
  isRecovering?: boolean
}

function getDebtColor(minutes: number): string {
  if (minutes <= 60) return 'var(--accent-sage)'
  if (minutes <= 180) return '#F57F17'
  return '#C62828'
}

function getConsistencyColor(score: number): string {
  if (score >= 80) return 'var(--accent-sage)'
  if (score >= 60) return '#6B9080'
  if (score >= 40) return '#F57F17'
  return '#C62828'
}

function formatDebt(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function SleepDebtDisplay({
  sleepData,
  cyclePhase,
  activityLevel,
  isRecovering,
}: SleepDebtDisplayProps) {
  const metrics = useMemo(() => {
    if (sleepData.length < 3) return null
    return calculateSleepMetrics(sleepData, {
      cyclePhase: cyclePhase ?? undefined,
      activityLevel,
      isRecovering,
    })
  }, [sleepData, cyclePhase, activityLevel, isRecovering])

  if (!metrics) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Sleep Intelligence
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Need at least 3 nights of sleep data to calculate.
        </p>
      </div>
    )
  }

  const { sleepDebt, consistency, unrefreshingIndex, sleepNeed } = metrics

  return (
    <div className="space-y-3">
      {/* Top metrics row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sleep Debt */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Sleep Debt (14d)
          </p>
          <p className="text-xl font-bold mt-1" style={{ color: getDebtColor(sleepDebt.currentDebtMinutes) }}>
            {formatDebt(sleepDebt.currentDebtMinutes)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px]" style={{
              color: sleepDebt.debtTrend === 'recovering' ? 'var(--accent-sage)'
                : sleepDebt.debtTrend === 'accumulating' ? '#C62828'
                : 'var(--text-muted)',
            }}>
              {sleepDebt.debtTrend === 'recovering' ? '\u2193 Recovering'
                : sleepDebt.debtTrend === 'accumulating' ? '\u2191 Growing'
                : '\u2194 Stable'}
            </span>
          </div>
          {sleepDebt.daysToRecover !== null && (
            <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              ~{sleepDebt.daysToRecover}d to recover at current rate
            </p>
          )}
        </div>

        {/* Consistency */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Consistency (7d)
          </p>
          <p className="text-xl font-bold mt-1" style={{ color: getConsistencyColor(consistency.score) }}>
            {consistency.score}%
          </p>
          {consistency.avgBedtime && consistency.avgWakeTime && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Avg bed: {consistency.avgBedtime}
            </p>
          )}
          {consistency.avgWakeTime && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Avg wake: {consistency.avgWakeTime}
            </p>
          )}
        </div>
      </div>

      {/* Bottom metrics row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Unrefreshing Sleep */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Unrefreshing Index
          </p>
          <p className="text-xl font-bold mt-1" style={{
            color: unrefreshingIndex.score >= 5 ? '#C62828' : unrefreshingIndex.score >= 3 ? '#F57F17' : 'var(--accent-sage)',
          }}>
            {unrefreshingIndex.score}/10
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {unrefreshingIndex.daysWithUnrefreshingSleep} of {unrefreshingIndex.totalDays} nights
          </p>
          {unrefreshingIndex.score >= 5 && (
            <p className="text-[9px] mt-0.5" style={{ color: '#C62828' }}>
              Common in dysautonomia
            </p>
          )}
        </div>

        {/* Sleep Need */}
        <div className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Tonight's Need
          </p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            {Math.floor(sleepNeed.estimatedMinutes / 60)}h {sleepNeed.estimatedMinutes % 60}m
          </p>
          <div className="mt-1 space-y-0.5">
            {sleepNeed.factors.map((factor, i) => (
              <p key={i} className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                {factor}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
