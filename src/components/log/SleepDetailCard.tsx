'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { saveSleepDetails } from '@/lib/api/sleep-details'
import type { SleepDetail, SleepQualityFactor } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface SleepDetailCardProps {
  logId: string
  initialSleepDetail: SleepDetail | null
  onComplete?: () => void
}

const LATENCY_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: 60 },
]

const QUALITY_FACTORS: { label: string; value: SleepQualityFactor }[] = [
  { label: 'Nightmares', value: 'nightmares' },
  { label: 'Restless', value: 'restless' },
  { label: 'Snoring', value: 'snoring' },
  { label: 'Hot', value: 'hot' },
  { label: 'Cold', value: 'cold' },
  { label: 'Noise', value: 'noise' },
  { label: 'Pain', value: 'pain' },
  { label: 'Anxiety', value: 'anxiety' },
  { label: 'Bathroom', value: 'bathroom' },
  { label: 'Partner', value: 'partner' },
]

export default function SleepDetailCard({
  logId,
  initialSleepDetail,
  onComplete,
}: SleepDetailCardProps) {
  const [bedtime, setBedtime] = useState<string>(
    initialSleepDetail?.bedtime ?? ''
  )
  const [wakeTime, setWakeTime] = useState<string>(
    initialSleepDetail?.wake_time ?? ''
  )
  const [latency, setLatency] = useState<number | null>(
    initialSleepDetail?.sleep_latency_min ?? null
  )
  const [wakeUps, setWakeUps] = useState<number>(
    initialSleepDetail?.wake_episodes?.length ?? 0
  )
  const [qualityFactors, setQualityFactors] = useState<SleepQualityFactor[]>(
    initialSleepDetail?.sleep_quality_factors ?? []
  )

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCalledComplete = useRef(!!initialSleepDetail)

  // Trigger onComplete when first data is entered
  useEffect(() => {
    const hasData = bedtime !== '' || wakeTime !== '' || latency !== null || wakeUps > 0 || qualityFactors.length > 0
    if (!hasCalledComplete.current && hasData && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [bedtime, wakeTime, latency, wakeUps, qualityFactors, onComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const debouncedSave = useCallback(
    (data: {
      bedtime: string
      wakeTime: string
      latency: number | null
      wakeUps: number
      factors: SleepQualityFactor[]
    }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          // Build wake_episodes as simple array with count
          const wakeEpisodes = Array.from({ length: data.wakeUps }, (_, i) => ({
            time: '',
            duration_min: 0,
          }))

          await saveSleepDetails(logId, {
            bedtime: data.bedtime || null,
            wake_time: data.wakeTime || null,
            sleep_latency_min: data.latency,
            wake_episodes: wakeEpisodes,
            sleep_quality_factors: data.factors,
            naps: [],
          })
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail, user can retry
        } finally {
          setSaving(false)
        }
      }, 600)
    },
    [logId]
  )

  const triggerSave = useCallback(
    (overrides?: Partial<{
      bedtime: string
      wakeTime: string
      latency: number | null
      wakeUps: number
      factors: SleepQualityFactor[]
    }>) => {
      debouncedSave({
        bedtime: overrides?.bedtime ?? bedtime,
        wakeTime: overrides?.wakeTime ?? wakeTime,
        latency: overrides?.latency !== undefined ? overrides.latency : latency,
        wakeUps: overrides?.wakeUps ?? wakeUps,
        factors: overrides?.factors ?? qualityFactors,
      })
    },
    [bedtime, wakeTime, latency, wakeUps, qualityFactors, debouncedSave]
  )

  const handleBedtimeChange = useCallback(
    (value: string) => {
      setBedtime(value)
      triggerSave({ bedtime: value })
    },
    [triggerSave]
  )

  const handleWakeTimeChange = useCallback(
    (value: string) => {
      setWakeTime(value)
      triggerSave({ wakeTime: value })
    },
    [triggerSave]
  )

  const handleLatencySelect = useCallback(
    (value: number) => {
      const newVal = latency === value ? null : value
      setLatency(newVal)
      triggerSave({ latency: newVal })
    },
    [latency, triggerSave]
  )

  const handleWakeUpsChange = useCallback(
    (delta: number) => {
      setWakeUps((prev) => {
        const next = Math.max(0, prev + delta)
        triggerSave({ wakeUps: next })
        return next
      })
    },
    [triggerSave]
  )

  const handleFactorToggle = useCallback(
    (factor: SleepQualityFactor) => {
      setQualityFactors((prev) => {
        const next = prev.includes(factor)
          ? prev.filter((f) => f !== factor)
          : [...prev, factor]
        triggerSave({ factors: next })
        return next
      })
    },
    [triggerSave]
  )

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        borderRadius: '1rem',
      }}
    >
      <div className="px-4 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Sleep Details
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Bedtime & Wake time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="bedtime-input"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Bedtime
            </label>
            <input
              id="bedtime-input"
              type="time"
              value={bedtime}
              onChange={(e) => handleBedtimeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                minHeight: 44,
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="wake-input"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Wake up
            </label>
            <input
              id="wake-input"
              type="time"
              value={wakeTime}
              onChange={(e) => handleWakeTimeChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                minHeight: 44,
              }}
            />
          </div>
        </div>

        {/* Sleep latency */}
        <div className="space-y-2">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            How long to fall asleep?
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Time to fall asleep"
          >
            {LATENCY_OPTIONS.map((opt) => {
              const isSelected = latency === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={opt.label}
                  onClick={() => handleLatencySelect(opt.value)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                  style={{
                    background: isSelected
                      ? 'var(--accent-sage-muted)'
                      : 'var(--bg-elevated)',
                    color: isSelected
                      ? 'var(--accent-sage)'
                      : 'var(--text-secondary)',
                    border: isSelected
                      ? '1.5px solid var(--accent-sage)'
                      : '1.5px solid transparent',
                    minHeight: 36,
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Night wake-ups stepper */}
        <div className="space-y-2">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Night wake-ups
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Decrease wake-ups"
              onClick={() => handleWakeUpsChange(-1)}
              disabled={wakeUps === 0}
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: 44,
                height: 44,
                background: wakeUps === 0
                  ? 'var(--bg-elevated)'
                  : 'var(--accent-sage-muted)',
                color: wakeUps === 0
                  ? 'var(--text-muted)'
                  : 'var(--accent-sage)',
                border: '1px solid var(--border-light)',
                opacity: wakeUps === 0 ? 0.5 : 1,
                cursor: wakeUps === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 10H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <span
              className="text-2xl font-semibold tabular-nums"
              style={{
                color: 'var(--text-primary)',
                minWidth: 40,
                textAlign: 'center',
              }}
              aria-live="polite"
              aria-label={`${wakeUps} wake-ups`}
            >
              {wakeUps}
            </span>

            <button
              type="button"
              aria-label="Increase wake-ups"
              onClick={() => handleWakeUpsChange(1)}
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: 44,
                height: 44,
                background: 'var(--accent-sage-muted)',
                color: 'var(--accent-sage)',
                border: '1px solid var(--border-light)',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 5V15M5 10H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Sleep quality factors */}
        <div className="space-y-2">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            What affected your sleep?
          </p>
          <div className="flex flex-wrap gap-2">
            {QUALITY_FACTORS.map(({ label, value }) => {
              const isActive = qualityFactors.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleFactorToggle(value)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                  style={{
                    background: isActive
                      ? 'var(--accent-sage-muted)'
                      : 'var(--bg-elevated)',
                    color: isActive
                      ? 'var(--accent-sage)'
                      : 'var(--text-secondary)',
                    border: isActive
                      ? '1.5px solid var(--accent-sage)'
                      : '1.5px solid transparent',
                    minHeight: 36,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Screen reader saving status */}
        {saving && (
          <span className="sr-only" role="status">
            Saving sleep details...
          </span>
        )}
      </div>
    </div>
  )
}
