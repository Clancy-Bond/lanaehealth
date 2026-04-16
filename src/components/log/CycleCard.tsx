'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { updateCycleEntry } from '@/lib/api/cycle'
import type { CycleEntry, FlowLevel } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface CycleIntelligenceData {
  currentPhase: string
  phaseConfidence: string
  cycleDay: number | null
  ovulation: { detected: boolean; estimatedDay: string | null; confidenceWindow: number; signals: Array<{ type: string; description: string }> }
  nextPeriod: { estimatedDay: string | null; confidenceWindow: number; confidence: string }
  fertileWindow: { isCurrentlyFertile: boolean }
  flags: Array<{ type: string; message: string; severity: string }>
  signalSummary: string
}

interface CycleCardProps {
  date: string
  initialEntry: CycleEntry | null
  ouraTemp: number | null       // Temperature deviation from Oura
  ouraHrv: number | null        // HRV from Oura
  ouraRhr: number | null        // Resting heart rate from Oura
  onComplete?: () => void
}

const FLOW_OPTIONS: { level: FlowLevel; label: string; color: string; size: number }[] = [
  { level: 'none', label: 'None', color: 'var(--text-muted)', size: 10 },
  { level: 'spotting', label: 'Spotting', color: '#D4A0A0', size: 14 },
  { level: 'light', label: 'Light', color: '#C47F7F', size: 18 },
  { level: 'medium', label: 'Medium', color: '#B05E5E', size: 24 },
  { level: 'heavy', label: 'Heavy', color: '#8B3A3A', size: 30 },
]

const MUCUS_OPTIONS = [
  { value: 'dry', label: 'Dry', emoji: '' },
  { value: 'sticky', label: 'Sticky', emoji: '' },
  { value: 'creamy', label: 'Creamy', emoji: '' },
  { value: 'egg-white', label: 'Egg white', emoji: '' },
  { value: 'watery', label: 'Watery', emoji: '' },
]

const LH_OPTIONS = [
  { value: 'negative', label: 'Negative' },
  { value: 'positive', label: 'Positive' },
  { value: 'peak', label: 'Peak' },
]

const CYCLE_SYMPTOMS = [
  'cramps', 'bloating', 'breast tenderness', 'headache',
  'back pain', 'fatigue', 'nausea', 'mood swings',
  'acne', 'cravings', 'dizziness', 'clots',
]

export default function CycleCard({
  date,
  initialEntry,
  ouraTemp,
  ouraHrv,
  ouraRhr,
  onComplete,
}: CycleCardProps) {
  const [flow, setFlow] = useState<FlowLevel | null>(initialEntry?.flow_level ?? null)
  const [menstruating, setMenstruating] = useState(initialEntry?.menstruation ?? false)
  const [mucus, setMucus] = useState<string | null>(initialEntry?.cervical_mucus_consistency ?? null)
  const [lhTest, setLhTest] = useState<string | null>(initialEntry?.lh_test_result ?? null)
  const [symptoms, setSymptoms] = useState<string[]>(
    initialEntry?.ovulation_signs?.split(',').filter(Boolean) ?? []
  )
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [intelligence, setIntelligence] = useState<CycleIntelligenceData | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCalledComplete = useRef(!!initialEntry?.flow_level)

  // Fetch cycle intelligence on mount
  useEffect(() => {
    fetch('/api/intelligence/cycle')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setIntelligence(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasCalledComplete.current && flow !== null && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [flow, onComplete])

  const debouncedSave = useCallback(
    (updates: Partial<CycleEntry>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          await updateCycleEntry(date, updates)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        } finally {
          setSaving(false)
        }
      }, 500)
    },
    [date],
  )

  const handleFlowSelect = useCallback(
    (level: FlowLevel) => {
      const isMenstruating = level !== 'none'
      setFlow(level)
      setMenstruating(isMenstruating)
      debouncedSave({ flow_level: level, menstruation: isMenstruating })
    },
    [debouncedSave],
  )

  const handleMucusSelect = useCallback(
    (value: string) => {
      const newVal = mucus === value ? null : value
      setMucus(newVal)
      debouncedSave({ cervical_mucus_consistency: newVal })
    },
    [mucus, debouncedSave],
  )

  const handleLhSelect = useCallback(
    (value: string) => {
      const newVal = lhTest === value ? null : value
      setLhTest(newVal)
      debouncedSave({ lh_test_result: newVal })
    },
    [lhTest, debouncedSave],
  )

  const handleSymptomToggle = useCallback(
    (symptom: string) => {
      setSymptoms(prev => {
        const next = prev.includes(symptom)
          ? prev.filter(s => s !== symptom)
          : [...prev, symptom]
        debouncedSave({ ovulation_signs: next.join(',') })
        return next
      })
    },
    [debouncedSave],
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
            Cycle Tracking
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Intelligence Banner */}
        {intelligence && (
          <div
            className="rounded-lg p-3 space-y-1"
            style={{
              background: intelligence.fertileWindow.isCurrentlyFertile
                ? '#FFF3E0'
                : 'var(--accent-sage-muted)',
              border: `1px solid ${intelligence.fertileWindow.isCurrentlyFertile ? '#FFE082' : 'var(--accent-sage)'}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold capitalize" style={{ color: 'var(--accent-sage)' }}>
                {intelligence.currentPhase.replace('_', ' ')} Phase
                {intelligence.cycleDay ? ` (Day ${intelligence.cycleDay})` : ''}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                background: intelligence.phaseConfidence === 'high' ? 'var(--accent-sage)' :
                  intelligence.phaseConfidence === 'moderate' ? '#F57F17' : 'var(--text-muted)',
                color: '#fff',
              }}>
                {intelligence.phaseConfidence}
              </span>
            </div>
            {intelligence.nextPeriod.estimatedDay && (
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                Period expected: {intelligence.nextPeriod.estimatedDay}
                {' '}({'\u00B1'}{intelligence.nextPeriod.confidenceWindow}d)
              </p>
            )}
            {intelligence.fertileWindow.isCurrentlyFertile && (
              <p className="text-[11px] font-semibold" style={{ color: '#E65100' }}>
                Currently in fertile window
              </p>
            )}
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {intelligence.signalSummary}
            </p>
            {intelligence.flags.map((flag, i) => (
              <p key={i} className="text-[10px]" style={{
                color: flag.severity === 'concern' ? '#C62828' : flag.severity === 'attention' ? '#E65100' : 'var(--text-muted)',
              }}>
                {flag.message}
              </p>
            ))}
          </div>
        )}

        {/* Flow Level */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Flow
          </p>
          <div className="flex gap-2 justify-between" role="radiogroup" aria-label="Flow level">
            {FLOW_OPTIONS.map(opt => {
              const isSelected = flow === opt.level
              return (
                <button
                  key={opt.level}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleFlowSelect(opt.level)}
                  className="flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg transition-all"
                  style={{
                    background: isSelected ? 'var(--accent-sage-muted)' : 'transparent',
                    border: isSelected ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
                  }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: opt.size,
                      height: opt.size,
                      background: isSelected ? opt.color : 'var(--bg-elevated)',
                      border: `2px solid ${isSelected ? opt.color : 'var(--border-light)'}`,
                    }}
                  />
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: isSelected ? opt.color : 'var(--text-muted)' }}
                  >
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cervical Mucus */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Cervical mucus
          </p>
          <div className="flex flex-wrap gap-2">
            {MUCUS_OPTIONS.map(opt => {
              const isActive = mucus === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleMucusSelect(opt.value)}
                  aria-pressed={isActive}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                    color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    border: isActive ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
                    minHeight: 32,
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* LH Test */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            LH ovulation test
          </p>
          <div className="flex gap-2">
            {LH_OPTIONS.map(opt => {
              const isActive = lhTest === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleLhSelect(opt.value)}
                  aria-pressed={isActive}
                  className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
                  style={{
                    background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                    color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    border: isActive ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
                    minHeight: 36,
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Oura Biometrics (auto-populated, read-only) */}
        {(ouraTemp !== null || ouraHrv !== null || ouraRhr !== null) && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              From Oura Ring (auto)
            </p>
            <div className="flex gap-3">
              {ouraTemp !== null && (
                <div className="flex-1 rounded-lg px-3 py-2" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Temp</p>
                  <p className="text-sm font-semibold" style={{ color: ouraTemp > 0 ? '#D4A0A0' : 'var(--accent-sage)' }}>
                    {ouraTemp > 0 ? '+' : ''}{ouraTemp.toFixed(2)}&deg;
                  </p>
                </div>
              )}
              {ouraHrv !== null && (
                <div className="flex-1 rounded-lg px-3 py-2" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>HRV</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {Math.round(ouraHrv)} ms
                  </p>
                </div>
              )}
              {ouraRhr !== null && (
                <div className="flex-1 rounded-lg px-3 py-2" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>RHR</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {Math.round(ouraRhr)} bpm
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cycle Symptoms */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Symptoms
          </p>
          <div className="flex flex-wrap gap-2">
            {CYCLE_SYMPTOMS.map(symptom => {
              const isActive = symptoms.includes(symptom)
              return (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => handleSymptomToggle(symptom)}
                  aria-pressed={isActive}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: isActive ? '#D4A0A0' + '20' : 'var(--bg-elevated)',
                    color: isActive ? '#D4A0A0' : 'var(--text-secondary)',
                    border: isActive ? '1.5px solid #D4A0A0' : '1.5px solid transparent',
                    minHeight: 32,
                  }}
                >
                  {symptom}
                </button>
              )
            })}
          </div>
        </div>

        {saving && (
          <span className="sr-only" role="status">Saving cycle data...</span>
        )}
      </div>
    </div>
  )
}
