'use client'

import { useState } from 'react'
import { updateDailyLog } from '@/lib/api/logs'
import { refreshTodayNarrative } from '@/lib/log/narrative-refresh'
import type { DailyLog } from '@/lib/types'

const FLARE_MARKER = '[FLARE]'

interface FlareToggleProps {
  log: DailyLog
}

export default function FlareToggle({ log }: FlareToggleProps) {
  const initial = (log.triggers ?? '').includes(FLARE_MARKER)
  const [flaring, setFlaring] = useState(initial)
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    setSaving(true)
    const currentTriggers = log.triggers ?? ''
    const nextTriggers = flaring
      ? currentTriggers.replace(new RegExp(`\\s*${FLARE_MARKER.replace(/[[\]]/g, '\\$&')}\\s*`, 'g'), '').trim()
      : `${FLARE_MARKER} ${currentTriggers}`.trim()

    try {
      await updateDailyLog(log.id, { triggers: nextTriggers || null })
      setFlaring(!flaring)
      refreshTodayNarrative()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-4 flex items-center justify-between gap-3"
      style={{
        background: flaring
          ? 'linear-gradient(135deg, #F5E1E1 0%, #ECC9C9 100%)'
          : '#FFFDF9',
        border: flaring
          ? '1px solid rgba(166, 107, 107, 0.4)'
          : '1px solid rgba(107, 144, 128, 0.15)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium" style={{ color: flaring ? '#7A3A3A' : '#3a3a3a' }}>
          Flare day
        </div>
        <div className="text-xs mt-0.5" style={{ color: flaring ? '#8A5A5A' : '#8a8a8a' }}>
          {flaring
            ? 'Today is flagged for doctor review'
            : 'Tap if today is a tough stretch you want flagged for your doctor'}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="press-feedback shrink-0 px-4 py-2 rounded-full text-sm font-semibold"
        style={{
          background: flaring ? '#A66B6B' : 'transparent',
          color: flaring ? '#fff' : '#A66B6B',
          border: `1px solid #A66B6B`,
          opacity: saving ? 0.7 : 1,
          transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)`,
        }}
        aria-pressed={flaring}
      >
        {flaring ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden>&#10003;</span> Flagged
          </span>
        ) : (
          'Flag flare'
        )}
      </button>
    </div>
  )
}
