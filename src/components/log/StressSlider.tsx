'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import SaveIndicator from './SaveIndicator'

interface StressSliderProps {
  initialValue: number | null
  onSave: (value: number) => Promise<void>
}

const LABELS: Record<number, string> = {
  0: 'Calm',
  3: 'Mild',
  5: 'Moderate',
  7: 'High',
  10: 'Extreme',
}

function getStressColor(value: number): string {
  if (value === 0) return 'var(--pain-none)'
  if (value <= 2) return '#A78BFA' // violet-400
  if (value <= 4) return '#8B5CF6' // violet-500
  if (value <= 6) return '#7C3AED' // violet-600
  if (value <= 8) return '#6D28D9' // violet-700
  return '#5B21B6' // violet-800
}

export default function StressSlider({
  initialValue,
  onSave,
}: StressSliderProps) {
  const [value, setValue] = useState(initialValue ?? 0)
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (newVal: number) => {
      setValue(newVal)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await onSave(newVal)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 500)
    },
    [onSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const percentage = (value / 10) * 100

  return (
    <div className="space-y-3">
      {/* Current value display */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-bold"
            style={{ color: getStressColor(value) }}
          >
            {value}
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {LABELS[value] ?? ''}
          </span>
        </div>
        <SaveIndicator show={saved} />
      </div>

      {/* Number buttons row */}
      <div className="flex justify-between">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleChange(i)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all"
            style={{
              background:
                i === value ? getStressColor(i) : 'var(--bg-elevated)',
              color: i === value ? '#fff' : 'var(--text-secondary)',
              minWidth: 28,
              minHeight: 28,
            }}
          >
            {i}
          </button>
        ))}
      </div>

      {/* Slider track */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="stress-slider w-full"
          style={
            {
              '--slider-pct': `${percentage}%`,
              '--slider-color': getStressColor(value),
            } as React.CSSProperties
          }
        />
      </div>

      {/* Label markers */}
      <div className="flex justify-between px-0.5">
        {Object.entries(LABELS).map(([num, label]) => (
          <span
            key={num}
            className="text-[10px]"
            style={{
              color:
                Number(num) === value
                  ? getStressColor(value)
                  : 'var(--text-muted)',
              fontWeight: Number(num) === value ? 600 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
