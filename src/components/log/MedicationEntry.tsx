'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { MEDICATION_CATEGORIES } from '@/lib/medication-options'
import SaveIndicator from './SaveIndicator'

interface MedicationObject {
  name: string
  time: string // ISO timestamp when it was logged
}

interface MedicationEntryProps {
  initialMedications: MedicationObject[]
  onSave: (medications: MedicationObject[]) => Promise<void>
}

const SHORTCUT_KEY = 'lanaehealth_med_shortcuts'

function getShortcuts(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SHORTCUT_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveShortcuts(shortcuts: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SHORTCUT_KEY, JSON.stringify(shortcuts))
}

export default function MedicationEntry({
  initialMedications,
  onSave,
}: MedicationEntryProps) {
  const [medications, setMedications] =
    useState<MedicationObject[]>(initialMedications)
  const [shortcuts, setShortcuts] = useState<string[]>([])
  const [newMed, setNewMed] = useState('')
  const [showBrowse, setShowBrowse] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load shortcuts from localStorage on mount
  useEffect(() => {
    setShortcuts(getShortcuts())
  }, [])

  const debouncedSave = useCallback(
    (meds: MedicationObject[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await onSave(meds)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 500)
    },
    [onSave]
  )

  const addMedication = useCallback(
    (name: string) => {
      if (!name.trim()) return
      const trimmed = name.trim()

      // Add to shortcuts if not already there
      setShortcuts((prev) => {
        if (!prev.includes(trimmed)) {
          const next = [trimmed, ...prev].slice(0, 20)
          saveShortcuts(next)
          return next
        }
        return prev
      })

      const newEntry: MedicationObject = {
        name: trimmed,
        time: new Date().toISOString(),
      }
      setMedications((prev) => {
        const next = [...prev, newEntry]
        debouncedSave(next)
        return next
      })
      setNewMed('')
    },
    [debouncedSave]
  )

  const removeMedication = useCallback(
    (index: number) => {
      setMedications((prev) => {
        const next = prev.filter((_, i) => i !== index)
        debouncedSave(next)
        return next
      })
    },
    [debouncedSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const isTaken = (name: string) =>
    medications.some((m) => m.name.toLowerCase() === name.toLowerCase())

  return (
    <div className="space-y-3">
      {/* Save indicator */}
      <div className="flex justify-end">
        <SaveIndicator show={saved} />
      </div>

      {/* Shortcut pills */}
      {shortcuts.length > 0 && (
        <div>
          <span
            className="mb-1.5 block text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Quick add
          </span>
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((med) => {
              const taken = isTaken(med)
              return (
                <button
                  key={med}
                  type="button"
                  onClick={() => {
                    if (!taken) addMedication(med)
                  }}
                  disabled={taken}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: taken
                      ? 'var(--accent-sage-muted)'
                      : 'var(--bg-elevated)',
                    color: taken
                      ? 'var(--accent-sage)'
                      : 'var(--text-secondary)',
                    border: taken
                      ? '1px solid var(--accent-sage)'
                      : '1px solid transparent',
                    opacity: taken ? 0.7 : 1,
                    minHeight: 36,
                  }}
                >
                  {taken ? '\u2713 ' : '+ '}
                  {med}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Add new medication */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMed}
          onChange={(e) => setNewMed(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addMedication(newMed)
          }}
          placeholder="Add medication..."
          className="flex-1 rounded-xl border px-3 py-2.5 text-sm"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          onClick={() => addMedication(newMed)}
          disabled={!newMed.trim()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: 'var(--accent-sage)',
            color: '#fff',
            minHeight: 44,
          }}
        >
          Add
        </button>
      </div>

      {/* Browse medications */}
      <button
        type="button"
        onClick={() => setShowBrowse((prev) => !prev)}
        className="text-xs font-medium"
        style={{ color: 'var(--accent-sage)' }}
      >
        {showBrowse ? 'Hide list' : 'Browse medications'}
      </button>

      {showBrowse && (
        <div className="space-y-3 pt-1">
          {MEDICATION_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <span
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {cat.name}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cat.medications.map((med) => {
                  const taken = isTaken(med)
                  return (
                    <button
                      key={med}
                      type="button"
                      onClick={() => {
                        if (!taken) addMedication(med)
                      }}
                      disabled={taken}
                      className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: taken
                          ? 'var(--accent-sage-muted)'
                          : 'var(--bg-elevated)',
                        color: taken
                          ? 'var(--accent-sage)'
                          : 'var(--text-secondary)',
                        minHeight: 32,
                      }}
                    >
                      {taken ? '\u2713 ' : '+ '}
                      {med}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's medications */}
      {medications.length > 0 && (
        <div className="space-y-1.5">
          <span
            className="block text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Today&apos;s medications
          </span>
          {medications.map((med, idx) => (
            <div
              key={`${med.name}-${idx}`}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {med.name}
              </span>
              <button
                type="button"
                onClick={() => removeMedication(idx)}
                className="flex items-center justify-center"
                style={{
                  color: 'var(--text-muted)',
                  minWidth: 44,
                  minHeight: 44,
                }}
                title="Remove"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 3L11 11M3 11L11 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
