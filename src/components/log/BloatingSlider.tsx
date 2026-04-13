'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import SaveIndicator from './SaveIndicator'

interface BloatingSliderProps {
  initialValue: number | null
  onSave: (value: number) => Promise<void>
}

const LABELS: Record<number, string> = {
  0: 'None',
  3: 'Mild',
  5: 'Moderate',
  7: 'Severe',
  10: 'Extreme',
}

function getBloatingColor(value: number): string {
  if (value === 0) return 'var(--pain-none)'
  if (value <= 2) return '#D4A76A' // light amber
  if (value <= 4) return '#C49A52'
  if (value <= 6) return '#B8860B' // dark goldenrod
  if (value <= 8) return '#D97706' // amber-600
  return '#B45309' // amber-700
}

export default function BloatingSlider({
  initialValue,
  onSave,
}: BloatingSliderProps) {
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
            style={{ color: getBloatingColor(value) }}
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
                i === value ? getBloatingColor(i) : 'var(--bg-elevated)',
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
          className="bloating-slider w-full"
          style={
            {
              '--slider-pct': `${percentage}%`,
              '--slider-color': getBloatingColor(value),
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
                  ? getBloatingColor(value)
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
