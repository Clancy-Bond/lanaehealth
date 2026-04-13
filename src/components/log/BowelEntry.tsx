'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import SaveIndicator from './SaveIndicator'

interface BowelData {
  type: number | null // 1-7 Bristol scale
  urgency: boolean
  pain: boolean
  blood: boolean
}

interface BowelEntryProps {
  initialData: BowelData
  onSave: (data: BowelData) => Promise<void>
}

const BRISTOL_TYPES: { type: number; label: string; detail: string }[] = [
  { type: 1, label: 'Type 1', detail: 'Hard lumps (constipation)' },
  { type: 2, label: 'Type 2', detail: 'Lumpy sausage' },
  { type: 3, label: 'Type 3', detail: 'Sausage with cracks (normal)' },
  { type: 4, label: 'Type 4', detail: 'Smooth sausage (ideal)' },
  { type: 5, label: 'Type 5', detail: 'Soft blobs' },
  { type: 6, label: 'Type 6', detail: 'Fluffy/mushy' },
  { type: 7, label: 'Type 7', detail: 'Watery (diarrhea)' },
]

export default function BowelEntry({ initialData, onSave }: BowelEntryProps) {
  const [data, setData] = useState<BowelData>(initialData)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const persist = useCallback(
    (updated: BowelData) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        try {
          await onSave(updated)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail
        }
      }, 400)
    },
    [onSave]
  )

  const selectType = (type: number) => {
    const updated = { ...data, type: data.type === type ? null : type }
    setData(updated)
    persist(updated)
  }

  const toggleField = (field: 'urgency' | 'pain' | 'blood') => {
    const updated = { ...data, [field]: !data[field] }
    setData(updated)
    persist(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SaveIndicator show={saved} />
      </div>

      {/* Bristol Stool Type Buttons */}
      <div>
        <p
          className="mb-2 text-xs font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          Bristol Stool Type
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BRISTOL_TYPES.map(({ type, label, detail }) => {
            const active = data.type === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className="touch-target rounded-xl px-3 py-2.5 text-left transition-colors"
                style={{
                  minHeight: 44,
                  background: active
                    ? 'var(--accent-sage-muted)'
                    : 'var(--bg-input)',
                  border: active
                    ? '1.5px solid var(--accent-sage)'
                    : '1px solid var(--border)',
                }}
              >
                <span
                  className="block text-sm font-semibold"
                  style={{
                    color: active
                      ? 'var(--accent-sage)'
                      : 'var(--text-primary)',
                  }}
                >
                  {label}
                </span>
                <span
                  className="block text-xs mt-0.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {detail}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Toggle switches */}
      <div className="space-y-2">
        <p
          className="text-xs font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          Additional Details
        </p>

        <ToggleRow
          label="Urgency"
          active={data.urgency}
          onToggle={() => toggleField('urgency')}
        />
        <ToggleRow
          label="Pain"
          active={data.pain}
          onToggle={() => toggleField('pain')}
        />
        <ToggleRow
          label="Blood"
          active={data.blood}
          onToggle={() => toggleField('blood')}
        />
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="touch-target flex w-full items-center justify-between rounded-xl px-3 py-2.5"
      style={{
        minHeight: 44,
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
      }}
    >
      <span
        className="text-sm font-medium"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </span>
      <div
        className="relative rounded-full transition-colors"
        style={{
          width: 44,
          height: 24,
          background: active ? 'var(--accent-sage)' : 'var(--border)',
        }}
      >
        <div
          className="absolute top-0.5 rounded-full bg-white transition-transform"
          style={{
            width: 20,
            height: 20,
            transform: active ? 'translateX(21px)' : 'translateX(2px)',
          }}
        />
      </div>
    </button>
  )
}
