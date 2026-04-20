'use client'

/*
 * MealRowKebab
 *
 * Per-food-row three-dot menu. Opens a popover with Edit / Copy /
 * Delete. Edit routes to the food detail, Copy posts a duplicate
 * through /api/food/log (future), Delete routes to the confirm
 * screen at /v2/calories/meal-delete where the destructive op sits
 * behind an explicit submit (CLAUDE.md data-safety rule).
 *
 * Outside-click and Escape both close the menu. Pairs with v2's
 * dark chrome; uses accent-danger for Delete label only, no red
 * panic elsewhere.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export interface MealRowKebabProps {
  /** food_entries.id */
  entryId: string
  /** ISO date of the entry. */
  date: string
  /** breakfast | lunch | dinner | snack. */
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  /** Short display name used in aria-labels. */
  foodLabel: string
}

export default function MealRowKebab({ entryId, date, meal, foodLabel }: MealRowKebabProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-label={`More actions for ${foodLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 'var(--v2-touch-target-min)',
          height: 'var(--v2-touch-target-min)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--v2-radius-md)',
          color: 'var(--v2-text-secondary)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1,
          fontFamily: 'inherit',
        }}
      >
        <span aria-hidden>⋮</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${foodLabel}`}
          style={{
            position: 'absolute',
            top: 'calc(var(--v2-touch-target-min) + 4px)',
            right: 0,
            minWidth: 176,
            background: 'var(--v2-bg-elevated)',
            border: '1px solid var(--v2-border)',
            borderRadius: 'var(--v2-radius-md)',
            boxShadow: 'var(--v2-shadow-lg)',
            padding: 'var(--v2-space-1)',
            zIndex: 30,
          }}
        >
          <Link
            role="menuitem"
            href={`/v2/calories/food?entry=${entryId}`}
            onClick={() => setOpen(false)}
            style={menuItemStyle}
          >
            Edit
          </Link>
          <Link
            role="menuitem"
            href={`/v2/calories/search?view=search&meal=${meal}&copy=${entryId}`}
            onClick={() => setOpen(false)}
            style={menuItemStyle}
          >
            Copy to today
          </Link>
          <Link
            role="menuitem"
            href={`/v2/calories/meal-delete?date=${date}&meal=${meal}&entry=${entryId}`}
            onClick={() => setOpen(false)}
            style={{
              ...menuItemStyle,
              color: 'var(--v2-accent-danger)',
            }}
          >
            Delete
          </Link>
        </div>
      )}
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  padding: 'var(--v2-space-2) var(--v2-space-3)',
  fontSize: 'var(--v2-text-sm)',
  color: 'var(--v2-text-primary)',
  textDecoration: 'none',
  borderRadius: 'var(--v2-radius-sm)',
  minHeight: 'var(--v2-touch-target-min)',
  lineHeight: 'var(--v2-touch-target-min)',
}
