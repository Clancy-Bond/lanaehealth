'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type {
  CustomTrackable,
  CustomTrackableEntry,
  TrackableCategory,
  TrackableInputType,
} from '@/lib/types'
import {
  createTrackable,
  saveTrackableEntry,
} from '@/lib/api/custom-trackables'
import SaveIndicator from './SaveIndicator'

// ── Props ───────────────────────────────────────────────────────────

interface CustomFactorsCardProps {
  logId: string
  initialTrackables: CustomTrackable[]
  initialEntries: CustomTrackableEntry[]
  onComplete?: () => void
}

// ── Constants ───────────────────────────────────────────────────────

const CATEGORIES: { value: TrackableCategory; label: string }[] = [
  { value: 'symptom', label: 'Symptom' },
  { value: 'factor', label: 'Factor' },
  { value: 'activity', label: 'Activity' },
  { value: 'supplement', label: 'Supplement' },
  { value: 'other', label: 'Other' },
]

const INPUT_TYPES: { value: TrackableInputType; label: string }[] = [
  { value: 'toggle', label: 'Toggle' },
  { value: 'scale_5', label: 'Scale (1-5)' },
  { value: 'scale_10', label: 'Scale (0-10)' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
]

const DEBOUNCE_MS = 400

// ── Component ───────────────────────────────────────────────────────

export default function CustomFactorsCard({
  logId,
  initialTrackables,
  initialEntries,
  onComplete,
}: CustomFactorsCardProps) {
  const [trackables, setTrackables] = useState<CustomTrackable[]>(initialTrackables)

  // Map of trackable_id -> entry state
  const [entries, setEntries] = useState<Record<string, Partial<CustomTrackableEntry>>>(() => {
    const map: Record<string, Partial<CustomTrackableEntry>> = {}
    for (const e of initialEntries) {
      map[e.trackable_id] = e
    }
    return map
  })

  // Add-form visibility and state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<TrackableCategory>('factor')
  const [newType, setNewType] = useState<TrackableInputType>('toggle')
  const [newIcon, setNewIcon] = useState('')
  const [creating, setCreating] = useState(false)

  // Save indicator
  const [saved, setSaved] = useState(false)

  // Debounce timers per trackable
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  // ── Debounced save ──

  const debounceSave = useCallback(
    (trackableId: string, value: { value?: number; text_value?: string; toggled?: boolean }) => {
      if (timersRef.current[trackableId]) {
        clearTimeout(timersRef.current[trackableId])
      }
      timersRef.current[trackableId] = setTimeout(async () => {
        try {
          await saveTrackableEntry(logId, trackableId, value)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        } catch {
          // Silently fail, entry state is still local
        }
      }, DEBOUNCE_MS)
    },
    [logId]
  )

  // ── Entry change handlers ──

  const setToggle = useCallback(
    (trackableId: string, on: boolean) => {
      setEntries((prev) => ({
        ...prev,
        [trackableId]: { ...prev[trackableId], toggled: on },
      }))
      debounceSave(trackableId, { toggled: on })
    },
    [debounceSave]
  )

  const setScale = useCallback(
    (trackableId: string, val: number) => {
      setEntries((prev) => ({
        ...prev,
        [trackableId]: { ...prev[trackableId], value: val },
      }))
      debounceSave(trackableId, { value: val })
    },
    [debounceSave]
  )

  const setNumber = useCallback(
    (trackableId: string, val: number) => {
      setEntries((prev) => ({
        ...prev,
        [trackableId]: { ...prev[trackableId], value: val },
      }))
      debounceSave(trackableId, { value: val })
    },
    [debounceSave]
  )

  const setText = useCallback(
    (trackableId: string, val: string) => {
      setEntries((prev) => ({
        ...prev,
        [trackableId]: { ...prev[trackableId], text_value: val },
      }))
      debounceSave(trackableId, { text_value: val })
    },
    [debounceSave]
  )

  // ── Create new trackable ──

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const created = await createTrackable({
        name: trimmed,
        category: newCategory,
        input_type: newType,
        icon: newIcon.trim() || undefined,
      })
      setTrackables((prev) => [...prev, created])
      // Reset form
      setNewName('')
      setNewCategory('factor')
      setNewType('toggle')
      setNewIcon('')
      setShowAddForm(false)
    } catch {
      // Could show error toast, for now silently fail
    } finally {
      setCreating(false)
    }
  }, [newName, newCategory, newType, newIcon])

  // ── Render helpers ──

  const renderToggle = (t: CustomTrackable) => {
    const on = entries[t.id]?.toggled === true
    return (
      <button
        type="button"
        onClick={() => setToggle(t.id, !on)}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
        style={{
          minHeight: 44,
          background: on ? 'var(--accent-sage)' : 'var(--bg-elevated)',
          color: on ? '#fff' : 'var(--text-secondary)',
          border: `1px solid ${on ? 'var(--accent-sage)' : 'var(--border-light)'}`,
        }}
      >
        {t.icon && <span>{t.icon}</span>}
        {t.name}
      </button>
    )
  }

  const renderScale = (t: CustomTrackable, max: number, start: number) => {
    const current = entries[t.id]?.value ?? null
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {t.icon && <span className="text-sm">{t.icon}</span>}
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t.name}
          </span>
          {current !== null && (
            <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
              {current}/{max}
            </span>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: max - start + 1 }, (_, i) => i + start).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScale(t.id, n)}
              className="flex items-center justify-center rounded-lg text-xs font-medium transition-colors"
              style={{
                width: 36,
                height: 36,
                minHeight: 36,
                background: current === n ? 'var(--accent-sage)' : 'var(--bg-elevated)',
                color: current === n ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${current === n ? 'var(--accent-sage)' : 'var(--border-light)'}`,
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderNumber = (t: CustomTrackable) => {
    const current = entries[t.id]?.value ?? 0
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {t.icon && <span className="text-sm">{t.icon}</span>}
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t.name}
          </span>
        </div>
        <div className="inline-flex items-center gap-0 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-light)' }}>
          <button
            type="button"
            onClick={() => setNumber(t.id, Math.max(0, current - 1))}
            className="flex items-center justify-center text-lg font-medium transition-colors"
            style={{
              width: 44,
              height: 44,
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            -
          </button>
          <input
            type="number"
            inputMode="numeric"
            value={current}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 0) setNumber(t.id, v)
            }}
            className="w-14 text-center text-sm font-medium border-x"
            style={{
              height: 44,
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-light)',
            }}
          />
          <button
            type="button"
            onClick={() => setNumber(t.id, current + 1)}
            className="flex items-center justify-center text-lg font-medium transition-colors"
            style={{
              width: 44,
              height: 44,
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            +
          </button>
        </div>
      </div>
    )
  }

  const renderText = (t: CustomTrackable) => {
    const current = entries[t.id]?.text_value ?? ''
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {t.icon && <span className="text-sm">{t.icon}</span>}
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {t.name}
          </span>
        </div>
        <input
          type="text"
          value={current}
          onChange={(e) => setText(t.id, e.target.value)}
          placeholder={`Enter ${t.name.toLowerCase()}...`}
          className="w-full rounded-xl border px-3 py-2.5 text-sm"
          style={{
            minHeight: 44,
            background: 'var(--bg-input)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
    )
  }

  const renderTrackable = (t: CustomTrackable) => {
    switch (t.input_type) {
      case 'toggle':
        return renderToggle(t)
      case 'scale_5':
        return renderScale(t, 5, 1)
      case 'scale_10':
        return renderScale(t, 10, 0)
      case 'number':
        return renderNumber(t)
      case 'text':
        return renderText(t)
      default:
        return null
    }
  }

  // Group toggles together, other types listed individually
  const toggleTrackables = trackables.filter((t) => t.input_type === 'toggle')
  const otherTrackables = trackables.filter((t) => t.input_type !== 'toggle')

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          My Factors
        </h3>
        <div className="flex items-center gap-2">
          <SaveIndicator show={saved} />
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 32,
              height: 32,
              background: 'var(--accent-sage-muted)',
              color: 'var(--accent-sage)',
            }}
            aria-label="Add custom factor"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Empty state */}
      {trackables.length === 0 && !showAddForm && (
        <div
          className="rounded-xl border border-dashed p-6 text-center"
          style={{ borderColor: 'var(--border-light)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add your first custom factor to track anything that matters to you
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors"
            style={{
              minHeight: 44,
              background: 'var(--accent-sage)',
              color: '#fff',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Factor
          </button>
        </div>
      )}

      {/* Toggle pills row */}
      {toggleTrackables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {toggleTrackables.map((t) => (
            <div key={t.id}>{renderTrackable(t)}</div>
          ))}
        </div>
      )}

      {/* Other trackable types */}
      {otherTrackables.length > 0 && (
        <div className="space-y-3">
          {otherTrackables.map((t) => (
            <div key={t.id}>{renderTrackable(t)}</div>
          ))}
        </div>
      )}

      {/* Add form (inline, not modal) */}
      {showAddForm && (
        <div
          className="space-y-3 rounded-xl border p-4"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-light)',
          }}
        >
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            New custom factor
          </p>

          {/* Name */}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Factor name (e.g. Caffeine, Yoga, Headache)"
            className="w-full rounded-xl border px-3 py-2.5 text-sm"
            style={{
              minHeight: 44,
              background: 'var(--bg-input)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Category
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setNewCategory(c.value)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    minHeight: 36,
                    background: newCategory === c.value ? 'var(--accent-sage)' : 'var(--bg-card)',
                    color: newCategory === c.value ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${newCategory === c.value ? 'var(--accent-sage)' : 'var(--border-light)'}`,
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input type */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Input type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INPUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewType(t.value)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    minHeight: 36,
                    background: newType === t.value ? 'var(--accent-sage)' : 'var(--bg-card)',
                    color: newType === t.value ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${newType === t.value ? 'var(--accent-sage)' : 'var(--border-light)'}`,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Icon emoji (optional)
            </label>
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              placeholder="e.g. ☕"
              maxLength={4}
              className="w-20 rounded-xl border px-3 py-2 text-center text-lg"
              style={{
                minHeight: 44,
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
              style={{
                minHeight: 44,
                background: 'var(--accent-sage)',
                color: '#fff',
              }}
            >
              {creating ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewName('')
                setNewCategory('factor')
                setNewType('toggle')
                setNewIcon('')
              }}
              className="text-sm"
              style={{ color: 'var(--text-muted)', minHeight: 44 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
