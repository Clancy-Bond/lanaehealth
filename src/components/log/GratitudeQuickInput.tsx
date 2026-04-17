'use client'

import { useState } from 'react'
import { addGratitude } from '@/lib/api/gratitude'
import type { GratitudeEntry } from '@/lib/types'

interface GratitudeQuickInputProps {
  logId: string
  initialEntries: GratitudeEntry[]
}

export default function GratitudeQuickInput({ logId, initialEntries }: GratitudeQuickInputProps) {
  const [entries, setEntries] = useState<GratitudeEntry[]>(initialEntries)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const t = text.trim()
    if (!t || saving) return
    setSaving(true)
    try {
      const created = await addGratitude(logId, t, 'gratitude')
      setEntries(prev => [...prev, created])
      setText('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'linear-gradient(135deg, #FFFDF9 0%, #F7F0E6 100%)', border: '1px solid rgba(204, 177, 103, 0.25)' }}
    >
      <label className="block text-sm font-medium mb-2" style={{ color: '#3a3a3a' }}>
        One thing you&apos;re grateful for today
        <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>Optional</span>
      </label>
      {entries.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {entries.map(e => (
            <li key={e.id} className="text-sm flex items-start gap-2" style={{ color: '#6a6a6a' }}>
              <span aria-hidden style={{ color: '#CCB167' }}>&#x2767;</span>
              <span className="flex-1">{e.content}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder="Coffee, a quiet morning, anything..."
          className="flex-1 rounded-full px-4 py-2 text-sm focus:outline-none"
          style={{ background: '#fff', border: '1px solid rgba(107, 144, 128, 0.2)', color: '#3a3a3a' }}
          disabled={saving}
        />
        <button
          type="button"
          onClick={submit}
          disabled={saving || text.trim().length === 0}
          className="px-4 py-2 rounded-full text-sm font-medium"
          style={{
            background: '#CCB167',
            color: '#3a2e1f',
            opacity: saving || text.trim().length === 0 ? 0.5 : 1,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
