'use client'

// ---------------------------------------------------------------------------
// RestDayCard
//
// A sage-tinted card that lets Lanae explicitly mark today a rest day.
// Pressing the button writes rest_day=true to daily_logs via setRestDay().
// The button acts as a POSITIVE log, not a null log. Analysis pipelines
// downstream must exclude rest_day=true rows from any adherence or
// completeness denominator per the non-shaming-voice rule.
//
// Voice rules:
//   - Active state: "Rest day noted. See you tomorrow."
//   - Inactive state: "I'm resting today." (positive frame)
//   - There is a small "Undo" affordance but no red X, no shame copy.
//   - The card NEVER references streaks, missed days, or compliance.
//
// See docs/plans/2026-04-16-non-shaming-voice-rule.md.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { setRestDay } from '@/lib/api/logs'

interface RestDayCardProps {
  logId: string
  initialIsRestDay: boolean
  onChange?: (isRestDay: boolean) => void
}

export default function RestDayCard({
  logId,
  initialIsRestDay,
  onChange,
}: RestDayCardProps) {
  const [isRestDay, setIsRestDay] = useState<boolean>(initialIsRestDay)
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    if (saving || next === isRestDay) return
    setIsRestDay(next) // optimistic
    setSaving(true)
    try {
      await setRestDay(logId, next)
      onChange?.(next)
    } catch {
      // Revert on failure so UI matches DB state.
      setIsRestDay(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-4 flex items-center justify-between gap-3"
      style={{
        background: isRestDay
          ? 'linear-gradient(135deg, #E8F0EA 0%, #D6E4D9 100%)'
          : '#FFFDF9',
        border: isRestDay
          ? '1px solid rgba(107, 144, 128, 0.45)'
          : '1px solid rgba(107, 144, 128, 0.15)',
        transition:
          'background var(--duration-fast) var(--ease-standard),'
          + ' border var(--duration-fast) var(--ease-standard)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-medium"
          style={{ color: isRestDay ? '#3b5346' : '#3a3a3a' }}
        >
          {isRestDay ? 'Rest day noted.' : "I'm resting today"}
        </div>
        <div
          className="text-xs mt-0.5"
          style={{ color: isRestDay ? '#4a5b52' : '#8a8a8a' }}
        >
          {isRestDay ? 'See you tomorrow.' : 'Mark this as a deliberate rest day.'}
        </div>
      </div>
      {isRestDay ? (
        <button
          type="button"
          onClick={() => toggle(false)}
          disabled={saving}
          className="press-feedback shrink-0 px-3 py-2 rounded-full text-xs font-semibold"
          style={{
            background: 'transparent',
            color: '#6B9080',
            border: '1px solid #6B9080',
            opacity: saving ? 0.7 : 1,
          }}
          aria-label="Undo rest day"
        >
          Undo
        </button>
      ) : (
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={saving}
          className="press-feedback shrink-0 px-4 py-2 rounded-full text-sm font-semibold"
          style={{
            background: '#6B9080',
            color: '#fff',
            border: '1px solid #6B9080',
            opacity: saving ? 0.7 : 1,
            transition:
              'background var(--duration-fast) var(--ease-standard),'
              + ' color var(--duration-fast) var(--ease-standard)',
          }}
          aria-pressed={isRestDay}
        >
          Mark rest day
        </button>
      )}
    </div>
  )
}
