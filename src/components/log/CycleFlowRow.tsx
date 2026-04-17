'use client'

import { useState } from 'react'
import { updateCycleEntry } from '@/lib/api/cycle'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import type { FlowLevel } from '@/lib/types'

interface CycleFlowRowProps {
  date: string
  initialFlow: FlowLevel | null
  cycleDay: number | null
  phase: string | null
}

const FLOW_OPTIONS: Array<{ value: FlowLevel; label: string; color: string }> = [
  { value: 'none',     label: 'None',     color: '#E8EDE6' },
  { value: 'spotting', label: 'Spotting', color: '#E8D5B7' },
  { value: 'light',    label: 'Light',    color: '#D4A0A0' },
  { value: 'medium',   label: 'Medium',   color: '#B57878' },
  { value: 'heavy',    label: 'Heavy',    color: '#8F5555' },
]

export default function CycleFlowRow({ date, initialFlow, cycleDay, phase }: CycleFlowRowProps) {
  const [flow, setFlow] = useState<FlowLevel | null>(initialFlow)
  const [saving, setSaving] = useState(false)

  const onPick = async (level: FlowLevel) => {
    const next = flow === level ? null : level
    setFlow(next)
    setSaving(true)
    try {
      await updateCycleEntry(date, {
        flow_level: next,
        menstruation: next !== null && next !== 'none',
      })
      refreshTodayNarrative()
    } finally {
      setSaving(false)
    }
  }

  const context =
    phase === 'menstrual' ? 'Period' :
    phase === 'follicular' ? 'Follicular' :
    phase === 'ovulatory' ? 'Ovulatory' :
    phase === 'luteal' ? 'Luteal (pre-period)' :
    null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
        Cycle flow
        <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
          {context ? <>{context}{cycleDay ? <> &middot; day <span className="tabular">{cycleDay}</span></> : ''}</> : 'Tap if bleeding today'}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {FLOW_OPTIONS.map(opt => {
          const active = flow === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPick(opt.value)}
              disabled={saving}
              className="press-feedback px-3 py-2 rounded-full text-sm"
              style={{
                background: active ? opt.color : 'transparent',
                color: active ? (['none', 'spotting'].includes(opt.value) ? '#3a2e1f' : '#fff') : '#6a6a6a',
                border: `1px solid ${active ? opt.color : 'rgba(107, 144, 128, 0.25)'}`,
                opacity: saving ? 0.7 : 1,
                transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`,
              }}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
