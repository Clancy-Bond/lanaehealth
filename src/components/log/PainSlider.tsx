'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import SaveIndicator from './SaveIndicator'

interface PainSliderProps {
  initialValue: number | null
  onSave: (value: number) => Promise<void>
}

const LABELS: Record<number, string> = {
  0: 'None',
  2: 'Mild',
  5: 'Moderate',
  7: 'Severe',
  10: 'Worst',
}

function getPainColor(value: number): string {
  if (value === 0) return 'var(--pain-none)'
  if (value <= 2) return 'var(--pain-low)'
  if (value <= 4) return 'var(--pain-mild)'
  if (value <= 6) return 'var(--pain-moderate)'
  if (value <= 8) return 'var(--pain-severe)'
  return 'var(--pain-extreme)'
}

export default function PainSlider({ initialValue, onSave }: PainSliderProps) {
  const [value, setValue] = useState(initialValue ?? 0)
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveCountRef = useRef(0)

  const handleChange = useCallback(
    (newVal: number) => {
      setValue(newVal)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await onSave(newVal)
          saveCountRef.current += 1
          setSaved(true)
          // Reset saved flag after indicator fades
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail, user can retry
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
            style={{ color: getPainColor(value) }}
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
              background: i === value ? getPainColor(i) : 'var(--bg-elevated)',
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
          className="pain-slider w-full"
          style={
            {
              '--slider-pct': `${percentage}%`,
              '--slider-color': getPainColor(value),
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
                  ? getPainColor(value)
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
