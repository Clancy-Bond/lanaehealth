'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CycleEntry, FlowLevel, NcImported } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface CycleQuickEntryProps {
  initialEntry: CycleEntry
  onSave: (
    date: string,
    fields: Partial<Omit<CycleEntry, 'id' | 'date' | 'created_at'>>
  ) => Promise<void>
  ncData?: NcImported | null
}

const FERTILITY_COLORS: Record<string, { bg: string; dot: string; label: string }> = {
  red: { bg: 'rgba(239, 68, 68, 0.1)', dot: '#EF4444', label: 'Fertile (Red)' },
  green: { bg: 'rgba(34, 197, 94, 0.1)', dot: '#22C55E', label: 'Not fertile (Green)' },
  yellow: { bg: 'rgba(234, 179, 8, 0.1)', dot: '#EAB308', label: 'Transitional (Yellow)' },
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
  ncData,
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

  const fertilityInfo = ncData?.fertility_color
    ? FERTILITY_COLORS[ncData.fertility_color.toLowerCase()] ?? null
    : null

  return (
    <div className="space-y-4">
      {/* Save indicator */}
      <div className="flex justify-end">
        <SaveIndicator show={saved} />
      </div>

      {/* Natural Cycles data (read-only) */}
      {ncData && (
        <div
          className="rounded-xl border p-3"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-light)',
          }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="var(--accent-sage)" strokeWidth="1.2" fill="none" />
              <path d="M7 4V7.5L9 9" stroke="var(--accent-sage)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              from Natural Cycles
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Fertility color */}
            {fertilityInfo && (
              <div
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: fertilityInfo.bg }}
              >
                <span
                  className="block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: fertilityInfo.dot }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {fertilityInfo.label}
                </span>
              </div>
            )}

            {/* Cycle day */}
            {ncData.cycle_day != null && (
              <div
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'var(--bg-card)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>CD</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {ncData.cycle_day}
                </span>
              </div>
            )}

            {/* Temperature */}
            {ncData.temperature != null && (
              <div
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'var(--bg-card)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Temp</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {ncData.temperature.toFixed(2)}&deg;
                </span>
              </div>
            )}

            {/* Ovulation status */}
            {ncData.ovulation_status && ncData.ovulation_status !== 'none' && (
              <div
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'rgba(168, 85, 247, 0.08)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ovulation</span>
                <span className="text-xs font-medium" style={{ color: '#A855F7' }}>
                  {ncData.ovulation_status}
                </span>
              </div>
            )}

            {/* LH test from NC */}
            {ncData.lh_test && ncData.lh_test !== 'not_taken' && (
              <div
                className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                style={{
                  background:
                    ncData.lh_test === 'positive'
                      ? 'rgba(234, 179, 8, 0.1)'
                      : 'var(--bg-card)',
                }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>LH</span>
                <span
                  className="text-xs font-medium capitalize"
                  style={{
                    color:
                      ncData.lh_test === 'positive'
                        ? '#EAB308'
                        : 'var(--text-primary)',
                  }}
                >
                  {ncData.lh_test}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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
