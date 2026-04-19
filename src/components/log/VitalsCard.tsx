'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import SaveIndicator from './SaveIndicator'
import TiltTableTest from './TiltTableTest'

interface VitalsIntel {
  latestOrthostatic: { hrDelta: number; classification: string; meetsPOTSThreshold: boolean } | null
  thirtyDayTrend: { avgDelta: number | null; deltaDirection: string; meetsPOTSCount: number; totalTests: number }
  todayOutlier: { isOutlier: boolean; deviatingMetrics: string[]; severity: string } | null
  recommendations: string[]
}

interface VitalsCardProps {
  date: string
  onComplete?: () => void
}

type Position = 'supine' | 'seated' | 'standing'

interface VitalReading {
  position: Position
  heartRate: number | null
  systolic: number | null
  diastolic: number | null
}

const POSITIONS: { value: Position; label: string; icon: string }[] = [
  { value: 'supine', label: 'Lying', icon: '\u{1F6CC}' },
  { value: 'seated', label: 'Seated', icon: '\u{1FA91}' },
  { value: 'standing', label: 'Standing', icon: '\u{1F9CD}' },
]

function getHrDeltaColor(delta: number): string {
  if (delta >= 30) return '#C62828' // POTS threshold
  if (delta >= 20) return '#E65100'
  if (delta >= 10) return '#F57F17'
  return 'var(--accent-sage)'
}

export default function VitalsCard({ date, onComplete }: VitalsCardProps) {
  const [readings, setReadings] = useState<VitalReading[]>([
    { position: 'supine', heartRate: null, systolic: null, diastolic: null },
    { position: 'seated', heartRate: null, systolic: null, diastolic: null },
    { position: 'standing', heartRate: null, systolic: null, diastolic: null },
  ])
  const [activePosition, setActivePosition] = useState<Position>('supine')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showTiltTest, setShowTiltTest] = useState(false)
  const [vitalsIntel, setVitalsIntel] = useState<VitalsIntel | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch vitals intelligence on mount
  useEffect(() => {
    fetch('/api/intelligence/vitals')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setVitalsIntel(data) })
      .catch(() => {})
  }, [])
  const hasCalledComplete = useRef(false)

  const activeReading = readings.find(r => r.position === activePosition)!
  const activeIdx = readings.findIndex(r => r.position === activePosition)

  // Calculate deltas for POTS display
  const supineHr = readings[0].heartRate
  const standingHr = readings[2].heartRate
  const hrDelta = supineHr !== null && standingHr !== null ? standingHr - supineHr : null

  useEffect(() => {
    const hasAny = readings.some(r => r.heartRate !== null || r.systolic !== null)
    if (!hasCalledComplete.current && hasAny && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [readings, onComplete])

  const debouncedSave = useCallback(
    (updatedReadings: VitalReading[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          const res = await fetch('/api/log/vitals-snapshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ date, readings: updatedReadings }),
          })
          if (!res.ok) return

          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail (offline, network error)
        } finally {
          setSaving(false)
        }
      }, 800)
    },
    [date],
  )

  const updateReading = useCallback(
    (field: 'heartRate' | 'systolic' | 'diastolic', value: string) => {
      const num = value === '' ? null : parseInt(value, 10)
      if (value !== '' && isNaN(num as number)) return

      setReadings(prev => {
        const next = [...prev]
        next[activeIdx] = { ...next[activeIdx], [field]: num }
        debouncedSave(next)
        return next
      })
    },
    [activeIdx, debouncedSave],
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        borderRadius: '1rem',
      }}
    >
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Vitals (Positional)
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Vitals Intelligence Banner */}
        {vitalsIntel && (
          <div className="space-y-2">
            {/* 30-day trend */}
            {vitalsIntel.thirtyDayTrend.totalTests > 0 && (
              <div className="rounded-lg p-3" style={{
                background: vitalsIntel.thirtyDayTrend.deltaDirection === 'worsening' ? '#FFEBEE' :
                  vitalsIntel.thirtyDayTrend.deltaDirection === 'improving' ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                border: `1px solid ${vitalsIntel.thirtyDayTrend.deltaDirection === 'worsening' ? '#EF9A9A' :
                  vitalsIntel.thirtyDayTrend.deltaDirection === 'improving' ? 'var(--accent-sage)' : 'var(--border-light)'}`,
              }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    30-Day Orthostatic Trend
                  </span>
                  <span className="text-xs font-bold" style={{
                    color: vitalsIntel.thirtyDayTrend.deltaDirection === 'improving' ? 'var(--accent-sage)' :
                      vitalsIntel.thirtyDayTrend.deltaDirection === 'worsening' ? '#C62828' : 'var(--text-muted)',
                  }}>
                    {vitalsIntel.thirtyDayTrend.deltaDirection === 'improving' ? '\u2193 Improving' :
                      vitalsIntel.thirtyDayTrend.deltaDirection === 'worsening' ? '\u2191 Worsening' : 'Stable'}
                  </span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Avg delta: {vitalsIntel.thirtyDayTrend.avgDelta ?? '--'} bpm |
                  {' '}{vitalsIntel.thirtyDayTrend.meetsPOTSCount}/{vitalsIntel.thirtyDayTrend.totalTests} met POTS threshold
                </p>
              </div>
            )}

            {/* Multi-vital outlier alert */}
            {vitalsIntel.todayOutlier?.isOutlier && (
              <div className="rounded-lg p-3" style={{ background: '#FFF3E0', border: '1px solid #FFE082' }}>
                <p className="text-xs font-semibold" style={{ color: '#E65100' }}>
                  Multiple vitals outside typical range today
                </p>
                <p className="text-[10px]" style={{ color: '#F57F17' }}>
                  {vitalsIntel.todayOutlier.deviatingMetrics.join(', ')} -- take it easy and monitor symptoms
                </p>
              </div>
            )}

            {/* Recommendations */}
            {vitalsIntel.recommendations.length > 0 && (
              <div className="space-y-0.5">
                {vitalsIntel.recommendations.map((rec, i) => (
                  <p key={i} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {rec}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Position Selector */}
        <div className="flex gap-2">
          {POSITIONS.map(pos => {
            const isActive = activePosition === pos.value
            const reading = readings.find(r => r.position === pos.value)
            const hasData = reading?.heartRate !== null || reading?.systolic !== null
            return (
              <button
                key={pos.value}
                type="button"
                onClick={() => setActivePosition(pos.value)}
                className="flex-1 flex flex-col items-center gap-1 rounded-lg py-2 transition-all"
                style={{
                  background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                  border: isActive ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
                }}
              >
                <span className="text-lg">{pos.icon}</span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isActive ? 'var(--accent-sage)' : 'var(--text-muted)' }}
                >
                  {pos.label}
                </span>
                {hasData && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent-sage)' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Input Fields */}
        <div className="space-y-3">
          {/* Heart Rate */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium w-8" style={{ color: 'var(--text-secondary)' }}>
              HR
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="bpm"
              value={activeReading.heartRate ?? ''}
              onChange={e => updateReading('heartRate', e.target.value)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                minHeight: 44,
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>bpm</span>
          </div>

          {/* Blood Pressure */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium w-8" style={{ color: 'var(--text-secondary)' }}>
              BP
            </label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="sys"
              value={activeReading.systolic ?? ''}
              onChange={e => updateReading('systolic', e.target.value)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                minHeight: 44,
              }}
            />
            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>/</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="dia"
              value={activeReading.diastolic ?? ''}
              onChange={e => updateReading('diastolic', e.target.value)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                minHeight: 44,
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>mmHg</span>
          </div>
        </div>

        {/* POTS Delta Display */}
        {hrDelta !== null && (
          <div
            className="rounded-lg p-3"
            style={{
              background: hrDelta >= 30 ? '#FFEBEE' : 'var(--accent-sage-muted)',
              border: `1px solid ${hrDelta >= 30 ? '#EF9A9A' : 'var(--accent-sage)'}`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Orthostatic HR Change
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {supineHr} bpm lying {'\u2192'} {standingHr} bpm standing
                </p>
              </div>
              <div className="text-right">
                <p
                  className="text-lg font-bold"
                  style={{ color: getHrDeltaColor(hrDelta) }}
                >
                  +{hrDelta} bpm
                </p>
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: getHrDeltaColor(hrDelta) }}
                >
                  {hrDelta >= 30 ? 'POTS Threshold Met' : hrDelta >= 20 ? 'Elevated' : 'Normal'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Help */}
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          Tip: Record lying HR first, rest 5 min, then stand and record standing HR after 1-2 min for orthostatic comparison.
        </p>

        {/* Tilt Table Test Toggle */}
        {showTiltTest ? (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
            <TiltTableTest date={date} />
            <button
              type="button"
              onClick={() => setShowTiltTest(false)}
              className="w-full mt-2 py-2 text-xs font-medium rounded-lg"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
            >
              Hide Tilt Table Test
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTiltTest(true)}
            className="w-full mt-2 py-2.5 text-xs font-semibold rounded-lg"
            style={{ color: 'var(--accent-sage)', background: 'var(--accent-sage-muted)' }}
          >
            Start Tilt Table Test (POTS)
          </button>
        )}

        {saving && (
          <span className="sr-only" role="status">Saving vitals...</span>
        )}
      </div>
    </div>
  )
}
