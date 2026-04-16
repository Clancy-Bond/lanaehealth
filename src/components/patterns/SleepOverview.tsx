'use client'

import { useMemo } from 'react'

interface SleepDay {
  date: string
  sleep_score: number | null
  sleep_total: number | null
  sleep_deep: number | null
  sleep_rem: number | null
  sleep_light: number | null
  sleep_efficiency: number | null
  hr_lowest: number | null
  hrv_avg: number | null
  breath_rate: number | null
  temp_deviation: number | null
}

interface SleepOverviewProps {
  data: SleepDay[]
  painScores?: Map<string, number> // date -> pain score for correlation
  cyclePhases?: Map<string, string> // date -> phase for overlay
}

function formatMinutes(mins: number | null): string {
  if (mins === null) return '--'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)'
  if (score >= 85) return 'var(--accent-sage)'
  if (score >= 70) return '#6B9080'
  if (score >= 50) return '#F57F17'
  return '#C62828'
}

function getScoreLabel(score: number | null): string {
  if (score === null) return 'No data'
  if (score >= 85) return 'Optimal'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

// Phase colors for cycle overlay
const PHASE_COLORS: Record<string, string> = {
  menstrual: '#D4A0A0',
  follicular: 'var(--accent-sage)',
  ovulatory: '#6B9080',
  luteal: '#E6C899',
}

export default function SleepOverview({ data, painScores, cyclePhases }: SleepOverviewProps) {
  // Compute 7-day and 30-day rolling averages (trend-first)
  const stats = useMemo(() => {
    if (data.length === 0) return null

    const last7 = data.slice(-7)
    const last30 = data.slice(-30)

    const avg = (arr: (number | null)[]) => {
      const valid = arr.filter((v): v is number => v !== null)
      return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null
    }

    return {
      score7: avg(last7.map(d => d.sleep_score)),
      score30: avg(last30.map(d => d.sleep_score)),
      total7: avg(last7.map(d => d.sleep_total)),
      total30: avg(last30.map(d => d.sleep_total)),
      deep7: avg(last7.map(d => d.sleep_deep)),
      rem7: avg(last7.map(d => d.sleep_rem)),
      efficiency7: avg(last7.map(d => d.sleep_efficiency)),
      hrv7: avg(last7.map(d => d.hrv_avg)),
      rhr7: avg(last7.map(d => d.hr_lowest)),
    }
  }, [data])

  // Pain-sleep correlation (chronic illness specific)
  const painCorrelation = useMemo(() => {
    if (!painScores || painScores.size === 0 || data.length < 7) return null

    let highPainNights = 0
    let highPainSleepTotal = 0
    let lowPainNights = 0
    let lowPainSleepTotal = 0

    for (const day of data) {
      const pain = painScores.get(day.date)
      const sleep = day.sleep_score
      if (pain === undefined || sleep === null) continue

      if (pain >= 6) {
        highPainNights++
        highPainSleepTotal += sleep
      } else if (pain <= 3) {
        lowPainNights++
        lowPainSleepTotal += sleep
      }
    }

    if (highPainNights < 3 || lowPainNights < 3) return null

    const highPainAvg = Math.round(highPainSleepTotal / highPainNights)
    const lowPainAvg = Math.round(lowPainSleepTotal / lowPainNights)

    return {
      highPainAvg,
      lowPainAvg,
      difference: lowPainAvg - highPainAvg,
      highPainNights,
      lowPainNights,
    }
  }, [data, painScores])

  const lastNight = data[data.length - 1]
  const lastPhase = cyclePhases?.get(lastNight?.date ?? '')

  if (!stats || !lastNight) {
    return (
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
        <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
          No sleep data yet. Connect Oura Ring or log sleep manually.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Trend-First: 7-Day Average (prominent) */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            7-Day Sleep Trend
          </p>
          {lastPhase && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: (PHASE_COLORS[lastPhase] ?? 'var(--text-muted)') + '20', color: PHASE_COLORS[lastPhase] }}
            >
              {lastPhase} phase
            </span>
          )}
        </div>

        <div className="flex items-end gap-4">
          <div>
            <p className="text-3xl font-bold" style={{ color: getScoreColor(stats.score7) }}>
              {stats.score7 !== null ? Math.round(stats.score7) : '--'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              avg sleep score ({getScoreLabel(stats.score7)})
            </p>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatMinutes(stats.total7 !== null ? Math.round(stats.total7) : null)}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>avg total</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {stats.efficiency7 !== null ? Math.round(stats.efficiency7) + '%' : '--'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>efficiency</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {stats.hrv7 !== null ? Math.round(stats.hrv7) + ' ms' : '--'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>avg HRV</p>
            </div>
          </div>
        </div>
      </div>

      {/* Last Night Detail */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
      >
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
          Last Night
        </p>

        {/* Sleep stages bar */}
        <div className="mb-3">
          {(() => {
            const deep = lastNight.sleep_deep ?? 0
            const rem = lastNight.sleep_rem ?? 0
            const light = lastNight.sleep_light ?? 0
            const total = deep + rem + light
            if (total === 0) return null

            return (
              <div className="flex rounded-full overflow-hidden h-3" style={{ background: 'var(--bg-elevated)' }}>
                <div style={{ width: `${(deep / total) * 100}%`, background: '#1A237E' }} title={`Deep: ${formatMinutes(deep)}`} />
                <div style={{ width: `${(rem / total) * 100}%`, background: '#00897B' }} title={`REM: ${formatMinutes(rem)}`} />
                <div style={{ width: `${(light / total) * 100}%`, background: '#90CAF9' }} title={`Light: ${formatMinutes(light)}`} />
              </div>
            )
          })()}
          <div className="flex justify-between mt-1">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#1A237E' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Deep {formatMinutes(lastNight.sleep_deep)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#00897B' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                REM {formatMinutes(lastNight.sleep_rem)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: '#90CAF9' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Light {formatMinutes(lastNight.sleep_light)}
              </span>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <p className="text-xs font-bold" style={{ color: getScoreColor(lastNight.sleep_score) }}>
              {lastNight.sleep_score ?? '--'}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Score</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatMinutes(lastNight.sleep_total)}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Total</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {lastNight.hr_lowest ?? '--'}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Low HR</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: 'var(--bg-elevated)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {lastNight.temp_deviation !== null
                ? `${lastNight.temp_deviation > 0 ? '+' : ''}${lastNight.temp_deviation.toFixed(1)}\u00B0`
                : '--'}
            </p>
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Temp</p>
          </div>
        </div>
      </div>

      {/* Pain-Sleep Correlation (chronic illness intelligence) */}
      {painCorrelation && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#D4A0A0' + '10', border: '1px solid #D4A0A0' + '30' }}
        >
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#D4A0A0' }}>
            Pain-Sleep Connection
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                High pain nights: avg sleep score <strong>{painCorrelation.highPainAvg}</strong>
              </p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Low pain nights: avg sleep score <strong>{painCorrelation.lowPainAvg}</strong>
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: '#D4A0A0' }}>
                -{painCorrelation.difference} pts
              </p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                sleep impact
              </p>
            </div>
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Based on {painCorrelation.highPainNights} high-pain and {painCorrelation.lowPainNights} low-pain nights
          </p>
        </div>
      )}
    </div>
  )
}
