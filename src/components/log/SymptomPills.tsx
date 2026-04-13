'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  SYMPTOM_OPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/lib/symptom-options'
import type { Symptom, SymptomCategory, Severity } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface SymptomPillsProps {
  logId: string
  initialSymptoms: Symptom[]
  onSaveBatch: (
    logId: string,
    symptoms: { category: SymptomCategory; symptom: string; severity: Severity }[]
  ) => Promise<void>
}

interface ActiveSymptom {
  category: SymptomCategory
  symptom: string
  severity: Severity
}

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'mild', label: 'Mild', color: 'var(--pain-mild)' },
  { value: 'moderate', label: 'Mod', color: 'var(--pain-moderate)' },
  { value: 'severe', label: 'Sev', color: 'var(--pain-severe)' },
]

export default function SymptomPills({
  logId,
  initialSymptoms,
  onSaveBatch,
}: SymptomPillsProps) {
  const [activeTab, setActiveTab] = useState<SymptomCategory>(CATEGORY_ORDER[0])
  const [activeSymptoms, setActiveSymptoms] = useState<ActiveSymptom[]>(() =>
    initialSymptoms.map((s) => ({
      category: s.category,
      symptom: s.symptom,
      severity: s.severity ?? 'moderate',
    }))
  )
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Count of symptoms per category for badges
  const countByCategory = useCallback(
    (cat: SymptomCategory) =>
      activeSymptoms.filter((s) => s.category === cat).length,
    [activeSymptoms]
  )

  const isActive = useCallback(
    (symptom: string, category: SymptomCategory) =>
      activeSymptoms.some(
        (s) => s.symptom === symptom && s.category === category
      ),
    [activeSymptoms]
  )

  const getActiveSeverity = useCallback(
    (symptom: string, category: SymptomCategory): Severity | null => {
      const found = activeSymptoms.find(
        (s) => s.symptom === symptom && s.category === category
      )
      return found?.severity ?? null
    },
    [activeSymptoms]
  )

  const debouncedSave = useCallback(
    (symptoms: ActiveSymptom[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await onSaveBatch(logId, symptoms)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 600)
    },
    [logId, onSaveBatch]
  )

  const toggleSymptom = useCallback(
    (symptom: string, category: SymptomCategory) => {
      setActiveSymptoms((prev) => {
        const exists = prev.some(
          (s) => s.symptom === symptom && s.category === category
        )
        let next: ActiveSymptom[]
        if (exists) {
          next = prev.filter(
            (s) => !(s.symptom === symptom && s.category === category)
          )
        } else {
          next = [...prev, { category, symptom, severity: 'moderate' }]
        }
        debouncedSave(next)
        return next
      })
    },
    [debouncedSave]
  )

  const setSeverity = useCallback(
    (symptom: string, category: SymptomCategory, severity: Severity) => {
      setActiveSymptoms((prev) => {
        const next = prev.map((s) =>
          s.symptom === symptom && s.category === category
            ? { ...s, severity }
            : s
        )
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

  return (
    <div className="space-y-3">
      {/* Save indicator */}
      <div className="flex justify-end">
        <SaveIndicator show={saved} />
      </div>

      {/* Category tabs */}
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_ORDER.map((cat) => {
          const count = countByCategory(cat)
          const isSelected = cat === activeTab
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: isSelected
                  ? 'var(--accent-sage)'
                  : 'var(--bg-elevated)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                minHeight: 36,
              }}
            >
              {CATEGORY_LABELS[cat]}
              {count > 0 && (
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: isSelected
                      ? 'rgba(255,255,255,0.3)'
                      : 'var(--accent-sage-muted)',
                    color: isSelected ? '#fff' : 'var(--accent-sage)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Symptom pills for active tab */}
      <div className="flex flex-wrap gap-2">
        {SYMPTOM_OPTIONS[activeTab].map((symptom) => {
          const active = isActive(symptom, activeTab)
          const severity = getActiveSeverity(symptom, activeTab)

          return (
            <div key={symptom} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => toggleSymptom(symptom, activeTab)}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: active
                    ? 'var(--accent-sage-muted)'
                    : 'var(--bg-elevated)',
                  color: active
                    ? 'var(--accent-sage)'
                    : 'var(--text-secondary)',
                  border: active
                    ? '1.5px solid var(--accent-sage)'
                    : '1.5px solid transparent',
                  minHeight: 36,
                }}
              >
                {symptom}
              </button>

              {/* Severity dots (only shown when active) */}
              {active && (
                <div className="flex gap-1.5">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setSeverity(symptom, activeTab, opt.value)
                      }
                      title={opt.label}
                      className="rounded-full transition-transform"
                      style={{
                        width: severity === opt.value ? 12 : 8,
                        height: severity === opt.value ? 12 : 8,
                        background:
                          severity === opt.value
                            ? opt.color
                            : 'var(--border)',
                        minWidth: 20,
                        minHeight: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        className="rounded-full"
                        style={{
                          width: severity === opt.value ? 12 : 8,
                          height: severity === opt.value ? 12 : 8,
                          background:
                            severity === opt.value
                              ? opt.color
                              : 'var(--border)',
                          display: 'block',
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
