'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import SaveIndicator from './SaveIndicator'

interface EnergySliderProps {
  /** Initial fatigue value (0-10) from the database. Energy is displayed as 10 - fatigue. */
  initialFatigue: number | null
  /** Called with the fatigue value (10 - energy) to save to the database. */
  onSave: (fatigue: number) => Promise<void>
}

const LABELS: Record<number, string> = {
  0: 'Exhausted',
  5: 'OK',
  10: 'Energized',
}

function getEnergyColor(energy: number): string {
  if (energy >= 8) return 'var(--pain-none)' // sage - great
  if (energy >= 6) return 'var(--pain-low)' // green
  if (energy >= 4) return 'var(--pain-mild)' // amber
  if (energy >= 2) return 'var(--pain-moderate)' // orange
  return 'var(--pain-severe)' // red - exhausted
}

export default function EnergySlider({
  initialFatigue,
  onSave,
}: EnergySliderProps) {
  // Display as energy (inverted), save as fatigue
  const [energy, setEnergy] = useState(
    initialFatigue != null ? 10 - initialFatigue : 5
  )
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (newEnergy: number) => {
      setEnergy(newEnergy)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          const fatigue = 10 - newEnergy
          await onSave(fatigue)
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

  const percentage = (energy / 10) * 100

  return (
    <div className="space-y-3">
      {/* Current value display */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-bold"
            style={{ color: getEnergyColor(energy) }}
          >
            {energy}
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {LABELS[energy] ?? ''}
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
                i === energy ? getEnergyColor(i) : 'var(--bg-elevated)',
              color: i === energy ? '#fff' : 'var(--text-secondary)',
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
          value={energy}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="energy-slider w-full"
          style={
            {
              '--slider-pct': `${percentage}%`,
              '--slider-color': getEnergyColor(energy),
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
                Number(num) === energy
                  ? getEnergyColor(energy)
                  : 'var(--text-muted)',
              fontWeight: Number(num) === energy ? 600 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
