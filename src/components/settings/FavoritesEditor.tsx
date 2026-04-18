'use client'

/**
 * Favorites editor for /settings (Wave 2e F5).
 *
 * Lets Lanae pick up to 6 metrics to pin on the home FavoritesStrip, then
 * drag them to reorder. Persists to health_profile (section='home_favorites')
 * via /api/favorites which wraps the EAV helpers in src/lib/api/favorites.ts.
 *
 * No migration. The home page already reads the row each render because it
 * is force-dynamic.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GripVertical, Plus, Trash2, Check, AlertCircle } from 'lucide-react'
import {
  FAVORITE_METRIC_DEFINITIONS,
  MAX_FAVORITES,
  type FavoriteItem,
  type FavoriteMetricId,
} from '@/lib/api/favorites'

interface FavoritesEditorProps {
  initialItems?: FavoriteItem[]
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr
  if (from < 0 || from >= arr.length) return arr
  const clampedTo = Math.max(0, Math.min(arr.length - 1, to))
  const next = arr.slice()
  const [moved] = next.splice(from, 1)
  next.splice(clampedTo, 0, moved)
  return next
}

export default function FavoritesEditor({ initialItems }: FavoritesEditorProps) {
  const [items, setItems] = useState<FavoriteItem[]>(initialItems ?? [])
  const [loading, setLoading] = useState(!initialItems)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // Load the saved list on mount unless the parent pre-fetched.
  useEffect(() => {
    if (initialItems) return
    let cancelled = false
    fetch('/api/favorites')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : [])
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialItems])

  const pinnedIds = useMemo(
    () => new Set<FavoriteMetricId>(items.map((i) => i.metric)),
    [items],
  )

  const availableDefs = useMemo(
    () => FAVORITE_METRIC_DEFINITIONS.filter((d) => !pinnedIds.has(d.id)),
    [pinnedIds],
  )

  const save = useCallback(async (next: FavoriteItem[]) => {
    setStatus('saving')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: next }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.error || `Save failed (${res.status})`)
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Save failed')
    }
  }, [])

  const addMetric = useCallback(
    (id: FavoriteMetricId) => {
      if (pinnedIds.has(id) || items.length >= MAX_FAVORITES) return
      const next = [...items, { metric: id }]
      setItems(next)
      save(next)
    },
    [pinnedIds, items, save],
  )

  const removeAt = useCallback(
    (idx: number) => {
      const next = items.filter((_, i) => i !== idx)
      setItems(next)
      save(next)
    },
    [items, save],
  )

  const reorder = useCallback(
    (from: number, to: number) => {
      const next = moveItem(items, from, to)
      if (next === items) return
      setItems(next)
      save(next)
    },
    [items, save],
  )

  if (loading) {
    return (
      <div className="space-y-1.5">
        <div className="shimmer-bar" style={{ height: 1, marginBottom: 8 }} />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 48, borderRadius: 8 }}
          />
        ))}
      </div>
    )
  }

  return (
    <div id="favorites">
      <p
        className="text-xs mb-3"
        style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}
      >
        Pick up to {MAX_FAVORITES} metrics to pin on your home screen. Drag the
        handle to reorder.
      </p>

      {items.length === 0 ? (
        <div
          className="rounded-lg p-3 mb-3"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--border-light)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No favorites yet. Pick one below to get started.
          </p>
        </div>
      ) : (
        <ul
          className="space-y-1.5 mb-3"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
        >
          {items.map((item, idx) => {
            const def = FAVORITE_METRIC_DEFINITIONS.find(
              (d) => d.id === item.metric,
            )
            const isDragging = dragIndex === idx
            return (
              <li
                key={item.metric}
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx)
                  e.dataTransfer.effectAllowed = 'move'
                  // Some browsers require non-empty data for drag to start.
                  e.dataTransfer.setData('text/plain', String(idx))
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex === null) return
                  reorder(dragIndex, idx)
                  setDragIndex(null)
                }}
                onDragEnd={() => setDragIndex(null)}
                className="press-feedback"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                  opacity: isDragging ? 0.5 : 1,
                  cursor: 'grab',
                }}
                data-testid={`favorite-item-${item.metric}`}
              >
                <button
                  type="button"
                  aria-label={`Move ${def?.label ?? item.metric} up`}
                  onClick={() => reorder(idx, idx - 1)}
                  disabled={idx === 0}
                  className="touch-target"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 28,
                    minWidth: 28,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: idx === 0 ? 'not-allowed' : 'grab',
                    opacity: idx === 0 ? 0.35 : 1,
                  }}
                >
                  <GripVertical size={14} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    {def?.label ?? item.metric}
                  </p>
                  {def?.category && (
                    <p
                      className="text-xs"
                      style={{ color: 'var(--text-muted)', margin: 0 }}
                    >
                      {def.category}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${def?.label ?? item.metric}`}
                  onClick={() => removeAt(idx)}
                  className="touch-target"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 32,
                    minWidth: 32,
                    border: '1px solid var(--border-light)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    borderRadius: 8,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Available metrics picker */}
      {availableDefs.length > 0 && items.length < MAX_FAVORITES && (
        <>
          <p
            className="text-xs mb-2"
            style={{
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              fontWeight: 600,
            }}
          >
            Add a favorite
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {availableDefs.map((def) => (
              <button
                key={def.id}
                type="button"
                onClick={() => addMetric(def.id)}
                className="press-feedback touch-target"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontWeight: 500,
                  minHeight: 36,
                }}
              >
                <Plus size={12} />
                {def.label}
              </button>
            ))}
          </div>
        </>
      )}

      {items.length >= MAX_FAVORITES && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}
        >
          {MAX_FAVORITES} is the max. Remove one to pin a different metric.
        </p>
      )}

      {/* Save status */}
      {status === 'saved' && (
        <div
          className="flex items-center gap-1.5 mt-3 px-2 py-1.5 rounded-lg"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
          }}
        >
          <Check size={14} style={{ color: 'var(--accent-sage)' }} />
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--accent-sage)' }}
          >
            Saved
          </span>
        </div>
      )}
      {status === 'error' && (
        <div
          className="flex items-start gap-1.5 mt-3 px-2 py-1.5 rounded-lg"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-light)',
          }}
        >
          <AlertCircle size={14} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {errorMsg ?? 'Could not save. Try again?'}
          </span>
        </div>
      )}
    </div>
  )
}

// Exported for unit tests only.
export const __testing = { moveItem }
