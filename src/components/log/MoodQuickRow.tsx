'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MoodQuickRowProps {
  logId: string
  initialMoodScore: number | null
  label?: string
}

const MOODS: Array<{ value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }> = [
  { value: 1, emoji: '😣', label: 'Rough' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

export default function MoodQuickRow({ logId, initialMoodScore, label = 'How are you feeling?' }: MoodQuickRowProps) {
  const [score, setScore] = useState<number | null>(initialMoodScore)
  const [saving, setSaving] = useState(false)

  const pick = async (value: number) => {
    if (saving) return
    setScore(value)
    setSaving(true)
    try {
      await supabase.from('mood_entries').upsert({
        log_id: logId,
        mood_score: value,
      }, { onConflict: 'log_id' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <label className="block text-sm font-medium mb-3" style={{ color: '#3a3a3a' }}>
        {label}
      </label>
      <div className="flex justify-between gap-2">
        {MOODS.map(opt => {
          const active = score === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => pick(opt.value)}
              disabled={saving}
              className="press-feedback flex-1 flex flex-col items-center gap-1 py-3 rounded-xl"
              style={{
                background: active ? '#6B9080' : 'transparent',
                border: `1px solid ${active ? '#6B9080' : 'rgba(107, 144, 128, 0.25)'}`,
                color: active ? '#fff' : '#3a3a3a',
                opacity: saving && !active ? 0.7 : 1,
                transition: `background var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)`,
              }}
              aria-pressed={active}
              aria-label={`${opt.label} mood`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-xs">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
