'use client'

import { useState, useCallback, useRef } from 'react'
import { addGratitude, deleteGratitude } from '@/lib/api/gratitude'
import type { GratitudeEntry, GratitudeType } from '@/lib/types'
import SaveIndicator from './SaveIndicator'

interface GratitudeCardProps {
  logId: string
  initialGratitudes: GratitudeEntry[]
}

const QUICK_ACTIONS: { label: string; type: GratitudeType; icon: string }[] = [
  { label: 'Add a win', type: 'win', icon: '\u{1F3C6}' },
  { label: "Something I'm grateful for", type: 'gratitude', icon: '\u{1F64F}' },
]

export default function GratitudeCard({
  logId,
  initialGratitudes,
}: GratitudeCardProps) {
  const [entries, setEntries] = useState<GratitudeEntry[]>(initialGratitudes)
  const [inputValue, setInputValue] = useState('')
  const [activeType, setActiveType] = useState<GratitudeType>('positive')
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const flashSaved = useCallback(() => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }, [])

  const handleAdd = useCallback(async () => {
    const trimmed = inputValue.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    try {
      const newEntry = await addGratitude(logId, trimmed, activeType)
      setEntries((prev) => [...prev, newEntry])
      setInputValue('')
      setActiveType('positive')
      flashSaved()
      inputRef.current?.focus()
    } catch {
      // Silently fail, user can retry
    } finally {
      setSubmitting(false)
    }
  }, [logId, inputValue, activeType, submitting, flashSaved])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic delete
      const prev = entries
      setEntries((current) => current.filter((e) => e.id !== id))
      try {
        await deleteGratitude(id)
      } catch {
        // Revert on failure
        setEntries(prev)
      }
    },
    [entries]
  )

  const handleQuickAction = useCallback(
    (type: GratitudeType) => {
      setActiveType(type)
      inputRef.current?.focus()
    },
    []
  )

  const typeLabel = (type: GratitudeType): string => {
    switch (type) {
      case 'win': return 'Win'
      case 'gratitude': return 'Grateful'
      default: return 'Positive'
    }
  }

  const typeBadgeColor = (type: GratitudeType): string => {
    switch (type) {
      case 'win': return '#D4A0A0'
      case 'gratitude': return 'var(--accent-sage)'
      default: return 'var(--text-muted)'
    }
  }

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        borderRadius: '1rem',
      }}
    >
      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3
            className="flex items-center gap-2 text-base font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {/* Sparkle icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M10 2L11.5 7.5L17 6L12.5 10L17 14L11.5 12.5L10 18L8.5 12.5L3 14L7.5 10L3 6L8.5 7.5L10 2Z"
                fill="var(--accent-sage)"
                opacity="0.8"
              />
            </svg>
            What went well today?
          </h3>
          <SaveIndicator show={saved} />
        </div>

        {/* Quick action pills */}
        <div className="flex gap-2">
          {QUICK_ACTIONS.map(({ label, type, icon }) => {
            const isActive = activeType === type
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleQuickAction(type)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: isActive
                    ? 'var(--accent-sage-muted)'
                    : 'var(--bg-elevated)',
                  color: isActive
                    ? 'var(--accent-sage)'
                    : 'var(--text-secondary)',
                  border: isActive
                    ? '1.5px solid var(--accent-sage)'
                    : '1.5px solid transparent',
                  minHeight: 36,
                }}
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            )
          })}
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Something good that happened..."
            disabled={submitting}
            aria-label="Add a gratitude entry"
            className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              minHeight: 44,
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!inputValue.trim() || submitting}
            aria-label="Add entry"
            className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
            style={{
              background: inputValue.trim()
                ? 'var(--accent-sage)'
                : 'var(--bg-elevated)',
              color: inputValue.trim() ? '#fff' : 'var(--text-muted)',
              opacity: submitting ? 0.6 : 1,
              minHeight: 44,
              minWidth: 56,
            }}
          >
            Add
          </button>
        </div>

        {/* Entries list */}
        {entries.length > 0 && (
          <ul className="space-y-2" aria-label="Today's gratitudes">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-2 rounded-lg px-3 py-2.5"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {entry.content}
                  </p>
                  <span
                    className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      color: typeBadgeColor(entry.entry_type),
                      background: `color-mix(in srgb, ${typeBadgeColor(entry.entry_type)} 12%, transparent)`,
                    }}
                  >
                    {typeLabel(entry.entry_type)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  aria-label={`Remove: ${entry.content}`}
                  className="shrink-0 flex items-center justify-center rounded-full transition-colors"
                  style={{
                    width: 28,
                    height: 28,
                    minWidth: 44,
                    minHeight: 44,
                    color: 'var(--text-muted)',
                    padding: 8,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <p
            className="text-center text-xs py-2"
            style={{ color: 'var(--text-muted)' }}
          >
            No entries yet. Add something positive!
          </p>
        )}
      </div>
    </div>
  )
}
