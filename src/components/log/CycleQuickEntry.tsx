'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CycleEntry, FlowLevel } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface CycleQuickEntryProps {
  initialEntry: CycleEntry
  onSave: (
    date: string,
    fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>>
  ) => Promise<void>
}

const FLOW_LEVELS: { value: FlowLevel; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
]

const LH_OPTIONS = [
  { value: 'not_taken', label: 'Not taken' },
  { value: 'negative', label: 'Negative' },
  { value: 'positive', label: 'Positive' },
]

export default function CycleQuickEntry({
  initialEntry,
  onSave,
}: CycleQuickEntryProps) {
  const [hasPeriod, setHasPeriod] = useState(initialEntry.menstruation)
  const [flowLevel, setFlowLevel] = useState<FlowLevel>(
    initialEntry.flow_level ?? 'medium'
  )
  const [lhTest, setLhTest] = useState(
    initialEntry.lh_test_result ?? 'not_taken'
  )
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedSave = useCallback(
    (fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        try {
          await onSave(initialEntry.date, fields)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 500)
    },
    [initialEntry.date, onSave]
  )

  const togglePeriod = useCallback(
    (val: boolean) => {
      setHasPeriod(val)
      debouncedSave({
        menstruation: val,
        flow_level: val ? flowLevel : 'none',
      })
    },
    [debouncedSave, flowLevel]
  )

  const changeFlow = useCallback(
    (level: FlowLevel) => {
      setFlowLevel(level)
      debouncedSave({ flow_level: level })
    },
    [debouncedSave]
  )

  const changeLH = useCallback(
    (val: string) => {
      setLhTest(val)
      debouncedSave({ lh_test_result: val })
    },
    [debouncedSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* Save indicator */}
      <div className="flex justify-end">
        <SaveIndicator show={saved} />
      </div>

      {/* Period toggle */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          Period today?
        </label>
        <div className="flex gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => togglePeriod(val)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors"
              style={{
                background:
                  hasPeriod === val
                    ? val
                      ? 'var(--phase-menstrual)'
                      : 'var(--accent-sage)'
                    : 'var(--bg-elevated)',
                color:
                  hasPeriod === val ? '#fff' : 'var(--text-secondary)',
                minHeight: 44,
              }}
            >
              {val ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>

      {/* Flow level (only when period = yes) */}
      {hasPeriod && (
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            Flow level
          </label>
          <div className="flex gap-2">
            {FLOW_LEVELS.map((fl) => (
              <button
                key={fl.value}
                type="button"
                onClick={() => changeFlow(fl.value)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors"
                style={{
                  background:
                    flowLevel === fl.value
                      ? 'var(--phase-menstrual)'
                      : 'var(--bg-elevated)',
                  color:
                    flowLevel === fl.value
                      ? '#fff'
                      : 'var(--text-secondary)',
                  minHeight: 44,
                }}
              >
                {fl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LH test */}
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          LH Test (optional)
        </label>
        <div className="flex gap-2">
          {LH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeLH(opt.value)}
              className="flex-1 rounded-xl py-2 text-xs font-medium transition-colors"
              style={{
                background:
                  lhTest === opt.value
                    ? opt.value === 'positive'
                      ? 'var(--phase-ovulatory)'
                      : 'var(--accent-sage)'
                    : 'var(--bg-elevated)',
                color:
                  lhTest === opt.value ? '#fff' : 'var(--text-secondary)',
                minHeight: 44,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
