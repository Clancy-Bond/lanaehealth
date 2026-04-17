'use client'

// ---------------------------------------------------------------------------
// EnergyModeToggle
//
// Three-pill segmented control placed near the top of the /log page. The
// initially active pill reflects either the user's previously saved mode or
// the inferred suggestion passed in via `suggestedMode`. The user can tap
// any pill to override; the override writes through to daily_logs.energy_mode
// via setEnergyMode().
//
// Voice rules:
//   - Labels are "Minimal / Gentle / Full". Never "reduced" or "limited".
//   - Copy describes the day's capacity ("Today feels X"). It never scores
//     the user or implies they failed a goal.
//
// See docs/plans/2026-04-16-non-shaming-voice-rule.md for the full rule set.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { setEnergyMode } from '@/lib/api/logs'
import type { EnergyMode } from '@/lib/types'

interface EnergyModeToggleProps {
  logId: string
  initialMode: EnergyMode | null
  // Suggested mode from energy-inference. Used only as the initial active
  // pill when `initialMode` is null. Always overridable.
  suggestedMode?: EnergyMode | null
  onModeChange?: (mode: EnergyMode) => void
}

const MODES: Array<{ value: EnergyMode; label: string; caption: string }> = [
  { value: 'minimal', label: 'Minimal', caption: 'Today feels minimal' },
  { value: 'gentle',  label: 'Gentle',  caption: 'Today feels gentle'  },
  { value: 'full',    label: 'Full',    caption: 'Today feels full'    },
]

export default function EnergyModeToggle({
  logId,
  initialMode,
  suggestedMode = null,
  onModeChange,
}: EnergyModeToggleProps) {
  const startMode: EnergyMode = initialMode ?? suggestedMode ?? 'full'
  const [mode, setMode] = useState<EnergyMode>(startMode)
  const [saving, setSaving] = useState(false)

  const pick = async (value: EnergyMode) => {
    if (saving || value === mode) return
    setMode(value) // optimistic
    setSaving(true)
    try {
      await setEnergyMode(logId, value)
      onModeChange?.(value)
    } catch {
      // Keep the optimistic UI; network retries happen on next interaction.
      // We intentionally do not surface a failure toast for this low-stakes
      // preference write.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: '#FFFDF9',
        border: '1px solid rgba(107, 144, 128, 0.15)',
      }}
      aria-label="Energy mode selector"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          How much capacity do you have today?
        </span>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Energy mode">
        {MODES.map((opt) => {
          const active = mode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(opt.value)}
              disabled={saving}
              className="press-feedback flex-1 py-3 rounded-xl text-sm font-medium"
              style={{
                background: active ? '#6B9080' : 'transparent',
                color: active ? '#fff' : '#3a3a3a',
                border: `1px solid ${active ? '#6B9080' : 'rgba(107, 144, 128, 0.25)'}`,
                opacity: saving && !active ? 0.7 : 1,
                transition:
                  'background var(--duration-fast) var(--ease-standard),'
                  + ' color var(--duration-fast) var(--ease-standard)',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs mt-3" style={{ color: '#8a8a8a' }}>
        {MODES.find((m) => m.value === mode)?.caption}
      </p>
    </div>
  )
}
