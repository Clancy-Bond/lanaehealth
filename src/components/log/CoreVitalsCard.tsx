'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { updateDailyLog } from '@/lib/api/logs'
import SaveIndicator from './SaveIndicator'

interface CoreVitalsCardProps {
  logId: string
  initialPain: number | null
  initialFatigue: number | null
  initialStress: number | null
  onComplete?: () => void
}

// Color scale shared between Pain and Stress (high = bad)
function getBadHighColor(value: number): string {
  if (value === 0) return 'var(--pain-none)'
  if (value <= 2) return 'var(--pain-low)'
  if (value <= 4) return 'var(--pain-mild)'
  if (value <= 6) return 'var(--pain-moderate)'
  if (value <= 8) return 'var(--pain-severe)'
  return 'var(--pain-extreme)'
}

// Energy uses inverse colors (high = good)
function getEnergyColor(value: number): string {
  if (value >= 10) return 'var(--pain-none)'
  if (value >= 8) return 'var(--pain-low)'
  if (value >= 6) return 'var(--pain-mild)'
  if (value >= 4) return 'var(--pain-moderate)'
  if (value >= 2) return 'var(--pain-severe)'
  return 'var(--pain-extreme)'
}

function getSeverityLabel(value: number, isEnergy: boolean): string {
  if (isEnergy) {
    // Energy: 10 = great, 0 = exhausted
    if (value >= 9) return 'Great'
    if (value >= 7) return 'Good'
    if (value >= 5) return 'Moderate'
    if (value >= 3) return 'Low'
    if (value >= 1) return 'Very low'
    return 'Exhausted'
  }
  // Pain / Stress: 0 = none, 10 = extreme
  if (value === 0) return 'None'
  if (value <= 2) return 'Mild'
  if (value <= 4) return 'Moderate'
  if (value <= 6) return 'Severe'
  if (value <= 8) return 'Very severe'
  return 'Extreme'
}

type VitalRow = {
  key: 'pain' | 'energy' | 'stress'
  label: string
  dbField: 'overall_pain' | 'fatigue' | 'stress'
  getColor: (v: number) => string
  isEnergy: boolean
}

const VITAL_ROWS: VitalRow[] = [
  {
    key: 'pain',
    label: 'Pain',
    dbField: 'overall_pain',
    getColor: getBadHighColor,
    isEnergy: false,
  },
  {
    key: 'energy',
    label: 'Energy',
    dbField: 'fatigue',
    getColor: getEnergyColor,
    isEnergy: true,
  },
  {
    key: 'stress',
    label: 'Stress',
    dbField: 'stress',
    getColor: getBadHighColor,
    isEnergy: false,
  },
]

const SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function CoreVitalsCard({
  logId,
  initialPain,
  initialFatigue,
  initialStress,
  onComplete,
}: CoreVitalsCardProps) {
  // Convert DB fatigue (where 10=exhausted) to display energy (where 10=great)
  const initialEnergy = initialFatigue !== null ? 10 - initialFatigue : null

  const [values, setValues] = useState<Record<string, number | null>>({
    pain: initialPain,
    energy: initialEnergy,
    stress: initialStress,
  })
  const [savedRow, setSavedRow] = useState<string | null>(null)
  const [savingRow, setSavingRow] = useState<string | null>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const hasCalledComplete = useRef(
    !!(initialPain !== null || initialFatigue !== null || initialStress !== null)
  )

  // Trigger onComplete when first data is entered
  useEffect(() => {
    const hasAnyValue = Object.values(values).some((v) => v !== null)
    if (!hasCalledComplete.current && hasAnyValue && onComplete) {
      hasCalledComplete.current = true
      onComplete()
    }
  }, [values, onComplete])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout)
    }
  }, [])

  const handleSelect = useCallback(
    (row: VitalRow, value: number) => {
      setValues((prev) => ({ ...prev, [row.key]: value }))

      // Clear any pending save for this row
      if (saveTimers.current[row.key]) {
        clearTimeout(saveTimers.current[row.key])
      }

      // Debounced save (400ms)
      saveTimers.current[row.key] = setTimeout(async () => {
        setSavingRow(row.key)
        try {
          // Energy is stored inverted as fatigue in DB
          const dbValue = row.isEnergy ? 10 - value : value
          await updateDailyLog(logId, { [row.dbField]: dbValue })
          setSavedRow(row.key)
          setTimeout(() => setSavedRow(null), 1600)
        } catch {
          // Silently fail, user can retry
        } finally {
          setSavingRow(null)
        }
      }, 400)
    },
    [logId]
  )

  return (
    <div className="space-y-4">
      {/* No inner card wrapper -- the carousel card provides the container */}

        {/* Vital rows */}
        {VITAL_ROWS.map((row) => {
          const selected = values[row.key]
          return (
            <div key={row.key} className="space-y-1.5">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {row.label}
                </span>
                <div className="flex items-center gap-2">
                  {selected !== null && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: row.getColor(selected) }}
                    >
                      {getSeverityLabel(selected, row.isEnergy)}
                    </span>
                  )}
                  {savedRow === row.key && <SaveIndicator show />}
                </div>
              </div>

              {/* Number buttons -- flex to fit any screen width */}
              <div
                className="flex gap-[2px] justify-between"
                role="radiogroup"
                aria-label={`${row.label} level, 0 to 10`}
              >
                {SCALE.map((num) => {
                  const isSelected = selected === num
                  const bgColor = isSelected ? row.getColor(num) : 'var(--bg-elevated)'
                  const textColor = isSelected ? '#FFFFFF' : 'var(--text-muted)'

                  return (
                    <button
                      key={num}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${row.label} ${num}`}
                      onClick={() => handleSelect(row, num)}
                      className="flex-1 flex items-center justify-center rounded-full text-[11px] font-semibold transition-all aspect-square"
                      style={{
                        maxWidth: 32,
                        minHeight: 28,
                        background: bgColor,
                        color: textColor,
                        border: isSelected
                          ? 'none'
                          : '1px solid var(--border-light)',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: isSelected
                          ? '0 2px 8px rgba(0,0,0,0.15)'
                          : 'none',
                      }}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

      {/* Screen reader saving status */}
      {savingRow && (
        <span className="sr-only" role="status">
          Saving {savingRow}...
        </span>
      )}
    </div>
  )
}
