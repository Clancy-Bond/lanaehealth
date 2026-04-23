'use client'

/*
 * FavoritesSection
 *
 * Shows the metrics the user has pinned to the home screen (up to
 * six) and lets them add or remove via a bottom sheet. Reorder is
 * deliberately not wired in v2 because drag-and-drop on a phone
 * adds a non-trivial touch-handling layer; users who need to
 * reorder can reach the legacy editor at /settings#favorites via
 * the "More settings" card below.
 *
 * Writes go through PUT /api/favorites (the same endpoint the
 * legacy FavoritesEditor uses). We track state optimistically so
 * the sheet feels instant; on failure we revert and surface a
 * short error.
 */
import { useMemo, useState } from 'react'
import {
  FAVORITE_METRIC_DEFINITIONS,
  MAX_FAVORITES,
  type FavoriteItem,
  type FavoriteMetricId,
} from '@/lib/api/favorites'
import { Button, Card, ListRow, Sheet } from '@/v2/components/primitives'

export interface FavoritesSectionProps {
  initialItems: FavoriteItem[]
}

function labelFor(id: FavoriteMetricId): string {
  return (
    FAVORITE_METRIC_DEFINITIONS.find((d) => d.id === id)?.label ?? id
  )
}

function categoryFor(id: FavoriteMetricId): string | null {
  return FAVORITE_METRIC_DEFINITIONS.find((d) => d.id === id)?.category ?? null
}

export default function FavoritesSection({ initialItems }: FavoritesSectionProps) {
  const [items, setItems] = useState<FavoriteItem[]>(initialItems)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pinnedIds = useMemo(
    () => new Set<FavoriteMetricId>(items.map((i) => i.metric)),
    [items],
  )

  const availableDefs = useMemo(
    () => FAVORITE_METRIC_DEFINITIONS.filter((d) => !pinnedIds.has(d.id)),
    [pinnedIds],
  )

  async function persist(next: FavoriteItem[]) {
    setSaving(true)
    setError(null)
    const previous = items
    // Optimistic: update state first so the sheet feels snappy.
    setItems(next)
    try {
      const res = await fetch('/api/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: next }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || body.ok === false) {
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
    } catch (err) {
      setItems(previous)
      setError(err instanceof Error ? err.message : 'Could not save. Try again?')
    } finally {
      setSaving(false)
    }
  }

  function addMetric(id: FavoriteMetricId) {
    if (pinnedIds.has(id) || items.length >= MAX_FAVORITES) return
    void persist([...items, { metric: id }])
  }

  function removeMetric(id: FavoriteMetricId) {
    void persist(items.filter((i) => i.metric !== id))
  }

  return (
    <>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--v2-space-2)',
            }}
          >
            <h2
              style={{
                fontSize: 'var(--v2-text-lg)',
                fontWeight: 'var(--v2-weight-semibold)',
                color: 'var(--v2-text-primary)',
                margin: 0,
              }}
            >
              Favorites
            </h2>
            <span
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
              }}
            >
              {items.length} of {MAX_FAVORITES}
            </span>
          </div>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              margin: 0,
            }}
          >
            Pinned metrics show at the top of your home screen.
          </p>

          {items.length === 0 ? (
            <p
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
                margin: 'var(--v2-space-2) 0 0',
              }}
            >
              Nothing pinned yet. Add one to see it on home.
            </p>
          ) : (
            <div>
              {items.map((item, idx) => (
                <ListRow
                  key={item.metric}
                  label={item.displayAs ?? labelFor(item.metric)}
                  subtext={categoryFor(item.metric) ?? undefined}
                  divider={idx < items.length - 1}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop: 'var(--v2-space-2)' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setError(null)
                setOpen(true)
              }}
            >
              Edit favorites
            </Button>
          </div>

          {error && (
            <p
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-danger)',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}
        </div>
      </Card>

      <Sheet open={open} onClose={() => setOpen(false)} title="Edit favorites">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-4)' }}>
          <p
            style={{
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              margin: 0,
            }}
          >
            Pick up to {MAX_FAVORITES} metrics. Tap a pinned metric to remove
            it. For drag-to-reorder, use the editor on legacy settings.
          </p>

          <div>
            <div
              style={{
                fontSize: 'var(--v2-text-xs)',
                color: 'var(--v2-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 'var(--v2-weight-semibold)',
                marginBottom: 'var(--v2-space-2)',
              }}
            >
              Pinned
            </div>
            {items.length === 0 ? (
              <p
                style={{
                  fontSize: 'var(--v2-text-sm)',
                  color: 'var(--v2-text-muted)',
                  margin: 0,
                }}
              >
                Nothing pinned yet.
              </p>
            ) : (
              <div>
                {items.map((item, idx) => (
                  <ListRow
                    key={item.metric}
                    label={item.displayAs ?? labelFor(item.metric)}
                    subtext="Tap to remove"
                    divider={idx < items.length - 1}
                    onClick={() => removeMetric(item.metric)}
                  />
                ))}
              </div>
            )}
          </div>

          {availableDefs.length > 0 && items.length < MAX_FAVORITES && (
            <div>
              <div
                style={{
                  fontSize: 'var(--v2-text-xs)',
                  color: 'var(--v2-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 'var(--v2-weight-semibold)',
                  marginBottom: 'var(--v2-space-2)',
                }}
              >
                Add a favorite
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--v2-space-2)',
                }}
              >
                {availableDefs.map((def) => (
                  <Button
                    key={def.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => addMetric(def.id)}
                    disabled={saving}
                  >
                    {def.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {items.length >= MAX_FAVORITES && (
            <p
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-muted)',
                margin: 0,
              }}
            >
              {MAX_FAVORITES} is the max. Remove one to pin a different
              metric.
            </p>
          )}

          {error && (
            <p
              style={{
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-accent-danger)',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
