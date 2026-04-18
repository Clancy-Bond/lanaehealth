'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  SYMPTOM_OPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/lib/symptom-options'
import type { Symptom, SymptomCategory, Severity } from '@/lib/types'
import type { ActiveProblemOption } from '@/app/log/page'
import SaveIndicator from './SaveIndicator'
import ConditionTagSelector from './ConditionTagSelector'
import { tagSymptomWithConditions } from '@/lib/api/symptom-conditions'

interface SymptomPillsProps {
  logId: string
  initialSymptoms: Symptom[]
  /**
   * Persist the current batch. Backwards-compatible: the callback may return
   * either `Promise<void>` (legacy) or `Promise<Symptom[]>`. When the
   * returned list is present, the component uses the stable ids to drive
   * ConditionTagSelector; otherwise tagging stays inert until the next
   * server-rendered pass refreshes `initialSymptoms`.
   */
  onSaveBatch: (
    logId: string,
    symptoms: { category: SymptomCategory; symptom: string; severity: Severity }[]
  ) => Promise<void | Symptom[]>
  /**
   * Wave 2d D5: condition tag options. Empty or missing = tag UI hidden,
   * matching the "optional, non-scolding" voice rule in ConditionTagSelector.
   */
  activeProblems?: ActiveProblemOption[]
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

/**
 * Stable key for an active symptom row. `(category, symptom)` is the
 * natural key inside one log, so we key both tag selections and the id
 * map by it - the row id can rotate across delete-insert batch saves.
 */
function symptomKey(category: SymptomCategory, symptom: string): string {
  return `${category}::${symptom}`
}

export default function SymptomPills({
  logId,
  initialSymptoms,
  onSaveBatch,
  activeProblems,
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

  // Wave 2d D5: natural key -> persisted symptom id. Seeded from
  // initialSymptoms and refreshed every successful batch save, because
  // saveSymptomsBatch() delete-inserts rows so ids rotate on each round.
  const [idByKey, setIdByKey] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const s of initialSymptoms) {
      m.set(symptomKey(s.category, s.symptom), s.id)
    }
    return m
  })

  // Per-symptom condition selections, keyed by the natural key so the
  // selection survives id rotation across saves.
  const [tagsByKey, setTagsByKey] = useState<Map<string, string[]>>(
    () => new Map()
  )

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
          const result = await onSaveBatch(logId, symptoms)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
          // Wave 2d D5: refresh the id map when the save callback returned
          // the persisted rows. If it returned void we leave the old ids
          // untouched, which means tagging is inert until the next mount
          // but the symptom save itself is fully unaffected.
          if (Array.isArray(result)) {
            const next = new Map<string, string>()
            for (const row of result) {
              next.set(symptomKey(row.category, row.symptom), row.id)
            }
            setIdByKey(next)
          }
        } catch {
          // Silently fail
        }
      }, 600)
    },
    [logId, onSaveBatch]
  )

  const handleTagChange = useCallback(
    async (
      category: SymptomCategory,
      symptom: string,
      nextConditionIds: string[]
    ) => {
      const key = symptomKey(category, symptom)
      setTagsByKey((prev) => {
        const next = new Map(prev)
        next.set(key, nextConditionIds)
        return next
      })
      const id = idByKey.get(key)
      if (!id) return // No persisted row yet; selection kept in memory only.
      try {
        await tagSymptomWithConditions(id, nextConditionIds)
      } catch {
        // Tag failures never block the symptom save path.
      }
    },
    [idByKey]
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
          // Drop any tag selection for a deactivated symptom. The junction
          // rows are removed via ON DELETE CASCADE on the parent delete.
          setTagsByKey((tprev) => {
            const k = symptomKey(category, symptom)
            if (!tprev.has(k)) return tprev
            const tnext = new Map(tprev)
            tnext.delete(k)
            return tnext
          })
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

  const hasConditionOptions = !!activeProblems && activeProblems.length > 0

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
          const key = symptomKey(activeTab, symptom)
          const showTagSelector = active && hasConditionOptions
          const selectedConditionIds = tagsByKey.get(key) ?? []

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

              {/* Wave 2d D5: optional condition tag selector under each
                  active pill. Rendered only when activeProblems is provided
                  and non-empty, so legacy callers see no change. */}
              {showTagSelector ? (
                <div aria-label={`Related conditions for ${symptom}`}>
                  <ConditionTagSelector
                    conditions={activeProblems!}
                    selectedIds={selectedConditionIds}
                    onChange={(next) =>
                      handleTagChange(activeTab, symptom, next)
                    }
                    compact
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
