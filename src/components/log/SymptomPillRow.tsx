'use client'

import { useMemo, useState, useCallback } from 'react'
import { addSymptom, deleteSymptom, updateSymptomSeverity } from '@/lib/api/symptoms'
import { tagSymptomWithConditions } from '@/lib/api/symptom-conditions'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import { enqueue } from '@/lib/log/offline-queue'
import type { Symptom, SymptomCategory, Severity } from '@/lib/types'
import type { CheckInPrefill } from '@/lib/log/prefill'
import type { ActiveProblemOption } from '@/app/log/page'
import ConditionTagSelector from './ConditionTagSelector'

interface SymptomPillRowProps {
  logId: string
  initialSymptoms: Symptom[]
  topPills: CheckInPrefill['topPills']
  label?: string
  subtitle?: string
  /**
   * Wave 2d D5: when provided and non-empty, each active pill grows a
   * companion ConditionTagSelector that writes to `symptom_conditions`.
   * Tags are optional; the symptom row persists regardless.
   */
  activeProblems?: ActiveProblemOption[]
}

export default function SymptomPillRow({
  logId,
  initialSymptoms,
  topPills,
  label = 'Anything bothering you?',
  subtitle = 'Tap once for moderate, again for severe, again to clear.',
  activeProblems,
}: SymptomPillRowProps) {
  const pillNames = useMemo(() => topPills.map(p => p.symptom), [topPills])
  const pillCategories = useMemo(() => {
    const m = new Map<string, SymptomCategory>()
    for (const p of topPills) m.set(p.symptom, p.category)
    return m
  }, [topPills])

  const initialMap = useMemo(() => {
    const map = new Map<string, { id: string; severity: Severity }>()
    const list = Array.isArray(initialSymptoms) ? initialSymptoms : []
    for (const s of list) {
      if (pillNames.includes(s.symptom)) {
        map.set(s.symptom, { id: s.id, severity: (s.severity as Severity) ?? 'moderate' })
      }
    }
    return map
  }, [initialSymptoms, pillNames])

  const [symptomIds, setSymptomIds] = useState(initialMap)
  const [busy, setBusy] = useState(false)

  // Wave 2d D5: per-symptom condition tag selections, keyed by symptom label.
  // The id can rotate across add/delete cycles, but the label is stable.
  const [tagsByLabel, setTagsByLabel] = useState<Map<string, string[]>>(
    () => new Map()
  )

  const handleTagChange = useCallback(
    async (symptomLabel: string, nextConditionIds: string[]) => {
      const state = symptomIds.get(symptomLabel)
      setTagsByLabel((prev) => {
        const next = new Map(prev)
        next.set(symptomLabel, nextConditionIds)
        return next
      })
      if (!state || state.id.startsWith('pending-')) return
      try {
        await tagSymptomWithConditions(state.id, nextConditionIds)
      } catch {
        // Tag failures never block the symptom log itself.
      }
    },
    [symptomIds]
  )

  const toggle = useCallback(async (s: string) => {
    const existing = symptomIds.get(s)
    setBusy(true)
    try {
      if (!existing) {
        const cat = pillCategories.get(s)
        if (!cat) return
        const input = { log_id: logId, category: cat, symptom: s, severity: 'moderate' as const }
        try {
          const created = await addSymptom(input)
          setSymptomIds(prev => {
            const next = new Map(prev)
            next.set(s, { id: created.id, severity: 'moderate' })
            return next
          })
        } catch {
          enqueue({ kind: 'addSymptom', payload: input })
          setSymptomIds(prev => {
            const next = new Map(prev)
            next.set(s, { id: `pending-${Date.now()}`, severity: 'moderate' })
            return next
          })
        }
      } else if (existing.severity === 'moderate') {
        try {
          await updateSymptomSeverity(existing.id, 'severe')
        } catch {
          enqueue({ kind: 'updateSymptomSeverity', payload: { id: existing.id, severity: 'severe' } })
        }
        setSymptomIds(prev => {
          const next = new Map(prev)
          next.set(s, { id: existing.id, severity: 'severe' })
          return next
        })
      } else {
        try {
          await deleteSymptom(existing.id)
        } catch {
          enqueue({ kind: 'deleteSymptom', payload: { id: existing.id } })
        }
        setSymptomIds(prev => {
          const next = new Map(prev)
          next.delete(s)
          return next
        })
        // Drop condition tag selections when the underlying symptom is cleared.
        // Junction rows are removed via ON DELETE CASCADE (migration 018).
        setTagsByLabel(prev => {
          if (!prev.has(s)) return prev
          const next = new Map(prev)
          next.delete(s)
          return next
        })
      }
      refreshTodayNarrative()
    } finally {
      setBusy(false)
    }
  }, [symptomIds, pillCategories, logId])

  const hasConditionOptions = !!activeProblems && activeProblems.length > 0

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {pillNames.map(s => {
          const state = symptomIds.get(s)
          const active = !!state
          const severe = state?.severity === 'severe'
          const bg = severe ? '#A66B6B' : active ? '#D4A0A0' : 'transparent'
          const color = active ? '#fff' : '#6a6a6a'
          const border = severe ? '#A66B6B' : active ? '#D4A0A0' : 'rgba(107, 144, 128, 0.25)'
          const showTagSelector = active && hasConditionOptions
          const selectedConditionIds = tagsByLabel.get(s) ?? []
          return (
            <div key={s} className="inline-flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggle(s)}
                disabled={busy}
                className="press-feedback inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm self-start"
                style={{
                  background: bg,
                  color,
                  border: `1px solid ${border}`,
                  opacity: busy ? 0.7 : 1,
                  transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`,
                }}
                aria-pressed={active}
                aria-label={active ? `${s}, ${state?.severity}. Tap to cycle severity.` : s}
              >
                {s}
                {severe ? <span aria-hidden style={{ fontWeight: 700 }}>!</span> : null}
              </button>
              {showTagSelector ? (
                <div aria-label={`Related conditions for ${s}`}>
                  <ConditionTagSelector
                    conditions={activeProblems!}
                    selectedIds={selectedConditionIds}
                    onChange={(next) => handleTagChange(s, next)}
                    compact
                  />
                </div>
              ) : null}
            </div>
          )
        })}
        <p className="basis-full text-xs mt-1" style={{ color: '#8a8a8a' }}>{subtitle}</p>
      </div>
    </div>
  )
}
