'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createServiceClient } from '@/lib/supabase'
import SaveIndicator from './SaveIndicator'

interface WorkoutCardProps {
  date: string
  onComplete?: () => void
}

type ExercisePosition = 'recumbent' | 'seated' | 'standing' | 'mixed'
type Intensity = 'gentle' | 'moderate' | 'vigorous'

const ACTIVITY_TYPES = [
  { value: 'walking', label: 'Walking', icon: '\u{1F6B6}' },
  { value: 'recumbent_bike', label: 'Recumbent Bike', icon: '\u{1F6B2}' },
  { value: 'swimming', label: 'Swimming', icon: '\u{1F3CA}' },
  { value: 'yoga', label: 'Yoga', icon: '\u{1F9D8}' },
  { value: 'pilates', label: 'Pilates', icon: '\u{1F9D8}' },
  { value: 'stretching', label: 'Stretching', icon: '\u{1F938}' },
  { value: 'strength', label: 'Strength', icon: '\u{1F4AA}' },
  { value: 'rowing', label: 'Rowing', icon: '\u{1F6A3}' },
  { value: 'elliptical', label: 'Elliptical', icon: '\u{1F3C3}' },
  { value: 'dance', label: 'Dance', icon: '\u{1F483}' },
  { value: 'other', label: 'Other', icon: '\u{2B50}' },
]

const POSITIONS: { value: ExercisePosition; label: string }[] = [
  { value: 'recumbent', label: 'Recumbent' },
  { value: 'seated', label: 'Seated' },
  { value: 'standing', label: 'Standing' },
  { value: 'mixed', label: 'Mixed' },
]

const INTENSITIES: { value: Intensity; label: string; color: string }[] = [
  { value: 'gentle', label: 'Gentle', color: 'var(--accent-sage)' },
  { value: 'moderate', label: 'Moderate', color: '#F57F17' },
  { value: 'vigorous', label: 'Vigorous', color: '#C62828' },
]

export default function WorkoutCard({ date, onComplete }: WorkoutCardProps) {
  const [activityType, setActivityType] = useState<string | null>(null)
  const [position, setPosition] = useState<ExercisePosition>('mixed')
  const [intensity, setIntensity] = useState<Intensity>('gentle')
  const [duration, setDuration] = useState('')
  const [preSymptom, setPreSymptom] = useState<number | null>(null)
  const [postSymptom, setPostSymptom] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const hasCalledComplete = useRef(false)

  useEffect(() => {
    if (!hasCalledComplete.current && activityType && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [activityType, onComplete])

  const handleSave = useCallback(async () => {
    if (!activityType || !duration) return
    setSaving(true)

    try {
      const sb = createServiceClient()

      // Store workout as timeline event with full metadata
      await sb.from('medical_timeline').insert({
        date,
        event_type: 'test', // Using 'test' as activity type
        title: `Workout: ${ACTIVITY_TYPES.find(a => a.value === activityType)?.label ?? activityType}`,
        description: [
          `${duration} min`,
          intensity,
          `position: ${position}`,
          preSymptom !== null ? `pre-symptom: ${preSymptom}/5` : null,
          postSymptom !== null ? `post-symptom: ${postSymptom}/5` : null,
          notes || null,
        ].filter(Boolean).join(' | '),
        significance: 'normal',
        source: 'daily_log',
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

      // Reset for another workout
      setTimeout(() => {
        setActivityType(null)
        setDuration('')
        setPreSymptom(null)
        setPostSymptom(null)
        setNotes('')
      }, 2000)
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [date, activityType, duration, position, intensity, preSymptom, postSymptom, notes])

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
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Activity
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Activity Type */}
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            What did you do?
          </p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map(act => {
              const isActive = activityType === act.value
              return (
                <button
                  key={act.value}
                  type="button"
                  onClick={() => setActivityType(isActive ? null : act.value)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                    color: isActive ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    border: isActive ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
                    minHeight: 32,
                  }}
                >
                  <span>{act.icon}</span>
                  {act.label}
                </button>
              )
            })}
          </div>
        </div>

        {activityType && (
          <>
            {/* Duration */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Duration
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="minutes"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  minHeight: 40,
                }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>min</span>
            </div>

            {/* Position (POTS-specific) */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Position
              </p>
              <div className="flex gap-2">
                {POSITIONS.map(pos => {
                  const isActive = position === pos.value
                  return (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setPosition(pos.value)}
                      className="flex-1 rounded-lg py-2 text-[11px] font-medium transition-all"
                      style={{
                        background: isActive ? 'var(--accent-sage-muted)' : 'var(--bg-elevated)',
                        color: isActive ? 'var(--accent-sage)' : 'var(--text-muted)',
                        border: isActive ? '1.5px solid var(--accent-sage)' : '1.5px solid transparent',
                      }}
                    >
                      {pos.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Intensity */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Intensity
              </p>
              <div className="flex gap-2">
                {INTENSITIES.map(int => {
                  const isActive = intensity === int.value
                  return (
                    <button
                      key={int.value}
                      type="button"
                      onClick={() => setIntensity(int.value)}
                      className="flex-1 rounded-lg py-2 text-xs font-medium transition-all"
                      style={{
                        background: isActive ? int.color + '20' : 'var(--bg-elevated)',
                        color: isActive ? int.color : 'var(--text-muted)',
                        border: isActive ? `1.5px solid ${int.color}` : '1.5px solid transparent',
                      }}
                    >
                      {int.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Pre/Post Symptom Check */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                How do you feel?
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Before</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={`pre-${n}`}
                        type="button"
                        onClick={() => setPreSymptom(preSymptom === n ? null : n)}
                        className="flex-1 rounded text-xs font-semibold py-1.5"
                        style={{
                          background: preSymptom === n ? 'var(--accent-sage)' : 'var(--bg-elevated)',
                          color: preSymptom === n ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>After</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={`post-${n}`}
                        type="button"
                        onClick={() => setPostSymptom(postSymptom === n ? null : n)}
                        className="flex-1 rounded text-xs font-semibold py-1.5"
                        style={{
                          background: postSymptom === n ? '#D4A0A0' : 'var(--bg-elevated)',
                          color: postSymptom === n ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                1 = great, 5 = terrible. Track to find your safe exercise ceiling.
              </p>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!duration || saving}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity"
              style={{
                background: 'var(--accent-sage)',
                opacity: !duration || saving ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Log Activity'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
