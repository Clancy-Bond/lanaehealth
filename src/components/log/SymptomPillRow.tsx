'use client'

import { useMemo, useState, useCallback } from 'react'
import { addSymptom, deleteSymptom, updateSymptomSeverity } from '@/lib/api/symptoms'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import { enqueue } from '@/lib/log/offline-queue'
import type { Symptom, SymptomCategory, Severity } from '@/lib/types'
import type { CheckInPrefill } from '@/lib/log/prefill'

interface SymptomPillRowProps {
  logId: string
  initialSymptoms: Symptom[]
  topPills: CheckInPrefill['topPills']
  label?: string
  subtitle?: string
}

export default function SymptomPillRow({
  logId,
  initialSymptoms,
  topPills,
  label = 'Anything bothering you?',
  subtitle = 'Tap once for moderate, again for severe, again to remove.',
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
      }
      refreshTodayNarrative()
    } finally {
      setBusy(false)
    }
  }, [symptomIds, pillCategories, logId])

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
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm transition"
              style={{ background: bg, color, border: `1px solid ${border}`, opacity: busy ? 0.7 : 1 }}
              aria-pressed={active}
              aria-label={active ? `${s}, ${state?.severity}. Tap to cycle severity.` : s}
            >
              {s}
              {severe ? <span aria-hidden style={{ fontWeight: 700 }}>!</span> : null}
            </button>
          )
        })}
        <p className="basis-full text-xs mt-1" style={{ color: '#8a8a8a' }}>{subtitle}</p>
      </div>
    </div>
  )
}
