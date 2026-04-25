'use client'

/**
 * HomeLayoutEditor
 *
 * Lets the user reorder and hide home-screen widgets. The list
 * is rendered with native HTML drag-and-drop because:
 *   1. Touch-first phones already get long-press reorder via the
 *      arrow buttons we surface alongside drag handles.
 *   2. We avoid pulling in a drag-and-drop library for one screen.
 *
 * Save is throttled: each change immediately PUTs to
 * /api/v2/home-layout, with a small "Saved" pill on success.
 *
 * Pinned widgets (canReorder=false) appear at the top in a
 * read-only group so the user knows they exist but cannot move
 * or hide them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/v2/components/primitives'

interface WidgetMeta {
  id: string
  title: string
  description: string
  canHide: boolean
  canReorder: boolean
}

interface ServerLayout {
  order: string[]
  hidden: string[]
}

export interface HomeLayoutEditorProps {
  initialLayout: ServerLayout
  catalog: WidgetMeta[]
}

export default function HomeLayoutEditor({ initialLayout, catalog }: HomeLayoutEditorProps) {
  const catalogById = useMemo(() => new Map(catalog.map((w) => [w.id, w])), [catalog])
  const [order, setOrder] = useState<string[]>(initialLayout.order)
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialLayout.hidden))
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const pinned = useMemo(
    () => order.filter((id) => catalogById.get(id)?.canReorder === false),
    [order, catalogById],
  )
  const flexible = useMemo(
    () => order.filter((id) => catalogById.get(id)?.canReorder === true),
    [order, catalogById],
  )

  const persist = useCallback(
    async (nextOrder: string[], nextHidden: Set<string>) => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch('/api/v2/home-layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order: nextOrder,
            hidden: Array.from(nextHidden),
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        setSavedAt(Date.now())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!savedAt) return
    const t = setTimeout(() => setSavedAt(null), 1500)
    return () => clearTimeout(t)
  }, [savedAt])

  const moveBy = useCallback(
    (id: string, delta: number) => {
      const idx = flexible.indexOf(id)
      if (idx < 0) return
      const target = idx + delta
      if (target < 0 || target >= flexible.length) return
      const next = flexible.slice()
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      const nextOrder = [...pinned, ...next]
      setOrder(nextOrder)
      void persist(nextOrder, hidden)
    },
    [flexible, pinned, hidden, persist],
  )

  const toggleHidden = useCallback(
    (id: string) => {
      const next = new Set(hidden)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setHidden(next)
      void persist(order, next)
    },
    [hidden, order, persist],
  )

  const onDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, id: string) => {
      setDraggingId(id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    },
    [],
  )

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
      e.preventDefault()
      const sourceId = e.dataTransfer.getData('text/plain') || draggingId
      setDraggingId(null)
      if (!sourceId || sourceId === targetId) return
      const fromIdx = flexible.indexOf(sourceId)
      const toIdx = flexible.indexOf(targetId)
      if (fromIdx < 0 || toIdx < 0) return
      const next = flexible.slice()
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      const nextOrder = [...pinned, ...next]
      setOrder(nextOrder)
      void persist(nextOrder, hidden)
    },
    [flexible, pinned, hidden, persist, draggingId],
  )

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--v2-space-3)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--v2-text-lg)', fontWeight: 'var(--v2-weight-semibold)', color: 'var(--v2-text-primary)' }}>
          Home layout
        </h2>
        <SaveStatus saving={saving} savedAt={savedAt} error={error} />
      </div>
      <p style={{ margin: '0 0 var(--v2-space-3) 0', fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-secondary)', lineHeight: 'var(--v2-leading-relaxed)' }}>
        Drag to reorder. Hide cards you do not want to see. If something needs your attention, the app will still bubble it up to the top.
      </p>

      {pinned.length > 0 && (
        <div style={{ marginBottom: 'var(--v2-space-4)' }}>
          <SectionLabel>Always visible</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
            {pinned.map((id) => {
              const meta = catalogById.get(id)
              if (!meta) return null
              return <PinnedRow key={id} title={meta.title} description={meta.description} />
            })}
          </div>
        </div>
      )}

      <SectionLabel>Your order</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        {flexible.map((id, idx) => {
          const meta = catalogById.get(id)
          if (!meta) return null
          const isHidden = hidden.has(id)
          return (
            <ReorderRow
              key={id}
              meta={meta}
              isHidden={isHidden}
              isFirst={idx === 0}
              isLast={idx === flexible.length - 1}
              dragging={draggingId === id}
              onMoveUp={() => moveBy(id, -1)}
              onMoveDown={() => moveBy(id, 1)}
              onToggleHidden={() => toggleHidden(id)}
              onDragStart={(e) => onDragStart(e, id)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, id)}
            />
          )
        })}
      </div>
    </Card>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 'var(--v2-text-xs)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--v2-text-muted)',
        margin: '0 0 var(--v2-space-2) 0',
      }}
    >
      {children}
    </div>
  )
}

function SaveStatus({
  saving,
  savedAt,
  error,
}: {
  saving: boolean
  savedAt: number | null
  error: string | null
}) {
  if (error) {
    return (
      <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-accent-danger)' }}>
        {error}
      </span>
    )
  }
  if (saving) {
    return (
      <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-muted)' }}>
        Saving
      </span>
    )
  }
  if (savedAt) {
    return (
      <span style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-accent-success)' }}>
        Saved
      </span>
    )
  }
  return null
}

function PinnedRow({ title, description }: { title: string; description: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        background: 'var(--v2-bg-elevated)',
        border: '1px solid var(--v2-border-subtle)',
      }}
    >
      <span aria-hidden style={{ fontSize: 16, color: 'var(--v2-text-muted)', marginTop: 2 }}>
        ◆
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-primary)', fontWeight: 'var(--v2-weight-medium)' }}>
          {title}
        </div>
        <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-secondary)', marginTop: 2, lineHeight: 'var(--v2-leading-relaxed)' }}>
          {description}
        </div>
      </div>
    </div>
  )
}

interface ReorderRowProps {
  meta: WidgetMeta
  isHidden: boolean
  isFirst: boolean
  isLast: boolean
  dragging: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleHidden: () => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
}

function ReorderRow({
  meta,
  isHidden,
  isFirst,
  isLast,
  dragging,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
  onDragStart,
  onDragOver,
  onDrop,
}: ReorderRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--v2-space-3)',
        padding: 'var(--v2-space-3)',
        borderRadius: 'var(--v2-radius-md)',
        background: dragging ? 'var(--v2-bg-elevated)' : 'var(--v2-bg-card)',
        border: '1px solid var(--v2-border-subtle)',
        opacity: isHidden ? 0.55 : 1,
        cursor: 'grab',
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 16,
          color: 'var(--v2-text-muted)',
          lineHeight: 1,
        }}
      >
        ⋮⋮
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--v2-text-sm)', color: 'var(--v2-text-primary)', fontWeight: 'var(--v2-weight-medium)' }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 'var(--v2-text-xs)', color: 'var(--v2-text-secondary)', marginTop: 2, lineHeight: 'var(--v2-leading-relaxed)' }}>
          {meta.description}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--v2-space-1)' }}>
        <ArrowButton onClick={onMoveUp} disabled={isFirst} ariaLabel={`Move ${meta.title} up`}>
          ↑
        </ArrowButton>
        <ArrowButton onClick={onMoveDown} disabled={isLast} ariaLabel={`Move ${meta.title} down`}>
          ↓
        </ArrowButton>
        {meta.canHide && (
          <button
            type="button"
            onClick={onToggleHidden}
            aria-pressed={!isHidden}
            style={{
              border: '1px solid var(--v2-border-subtle)',
              background: isHidden ? 'transparent' : 'var(--v2-accent-primary-soft)',
              color: isHidden ? 'var(--v2-text-secondary)' : 'var(--v2-accent-primary)',
              fontSize: 'var(--v2-text-xs)',
              fontWeight: 'var(--v2-weight-medium)',
              padding: 'var(--v2-space-1) var(--v2-space-3)',
              borderRadius: 'var(--v2-radius-sm)',
              cursor: 'pointer',
              minHeight: 32,
            }}
          >
            {isHidden ? 'Show' : 'Visible'}
          </button>
        )}
      </div>
    </div>
  )
}

function ArrowButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void
  disabled: boolean
  ariaLabel: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        width: 32,
        height: 32,
        border: '1px solid var(--v2-border-subtle)',
        background: 'transparent',
        color: disabled ? 'var(--v2-text-muted)' : 'var(--v2-text-primary)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 'var(--v2-radius-sm)',
        fontSize: 14,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
