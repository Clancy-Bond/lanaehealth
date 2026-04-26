'use client'

/*
 * RecentFoodsQuickLog
 *
 * MFN's signature time-saver: a strip of recently-logged foods at the
 * top of the dashboard. Tap a row, pick a meal, the food is logged
 * with the same calories and macros as the previous time. No USDA
 * roundtrip, no portion picker, no meal picker -- one tap to commit.
 *
 * Composition mirrors the meal-section row composition (Feature B):
 *   bold name        |  cal (right)
 *   muted portion    |
 * so the surface reads as a sibling to the meal log, not a separate
 * widget. The leading 40px spacer keeps text aligned with meal rows
 * even though we don't fetch photos here (the parent page already
 * paid the OFF lookup cost for current-day entries; recents would
 * double the call budget).
 *
 * Empty state ("No recent foods yet") sits inline so the section
 * never collapses to zero height -- otherwise the dashboard rhythm
 * jumps when Lanae's first day starts logging.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Sheet, Button } from '@/v2/components/primitives'
import { splitFoodLabel } from './MealSectionCard'
import type { RecentFoodEntry } from '@/lib/calories/recent-foods'

export interface RecentFoodsQuickLogProps {
  recents: RecentFoodEntry[]
  /** ISO date this dashboard is viewing. Quick log targets this day. */
  date: string
}

const MEALS: Array<{ value: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

export default function RecentFoodsQuickLog({ recents, date }: RecentFoodsQuickLogProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<RecentFoodEntry | null>(null)

  const handlePick = async (food: RecentFoodEntry, meal: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    setError(null)
    setPendingId(food.sourceId)
    try {
      const res = await fetch('/api/food/log/recent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId: food.sourceId, meal, date }),
      })
      if (!res.ok) {
        setError("That didn't log. Want to try again?")
        setPendingId(null)
        return
      }
      setPickerFor(null)
      setPendingId(null)
      router.refresh()
    } catch {
      setError("That didn't log. Want to try again?")
      setPendingId(null)
    }
  }

  return (
    <Card padding="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-2)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--v2-space-2)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-base)',
              fontWeight: 'var(--v2-weight-semibold)',
              color: 'var(--v2-text-primary)',
            }}
          >
            Recent
          </h3>
          <span
            style={{
              fontSize: 'var(--v2-text-xs)',
              color: 'var(--v2-text-muted)',
            }}
          >
            Tap to log again
          </span>
        </div>

        {recents.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--v2-text-sm)',
              color: 'var(--v2-text-muted)',
              lineHeight: 'var(--v2-leading-relaxed)',
            }}
          >
            No recent foods yet. Once you log a few, they show up here for one-tap re-log.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {recents.map((r, i) => {
              const { name, portion } = splitFoodLabel(r.name)
              const cal = Math.round(r.calories)
              const isLast = i === recents.length - 1
              const busy = pendingId === r.sourceId
              return (
                <li key={r.sourceId}>
                  <button
                    type="button"
                    onClick={() => setPickerFor(r)}
                    aria-label={`Quick-log ${name}, ${cal} calories`}
                    disabled={busy}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--v2-space-3)',
                      width: '100%',
                      minHeight: 'var(--v2-touch-target-min)',
                      padding: 'var(--v2-space-3) 0',
                      borderBottom: isLast ? 'none' : '1px solid var(--v2-border-subtle)',
                      background: 'transparent',
                      border: 0,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomStyle: isLast ? 'none' : 'solid',
                      borderBottomColor: isLast ? 'transparent' : 'var(--v2-border-subtle)',
                      cursor: busy ? 'wait' : 'pointer',
                      color: 'inherit',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: 'var(--v2-bg-card-muted, rgba(255,255,255,0.04))',
                        border: '1px solid var(--v2-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--v2-text-muted)',
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        aria-hidden
                      >
                        <path d="M12 8v8M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--v2-text-base)',
                          fontWeight: 'var(--v2-weight-semibold)',
                          color: 'var(--v2-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {name}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--v2-text-sm)',
                          color: 'var(--v2-text-muted)',
                          marginTop: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minHeight: '1em',
                        }}
                      >
                        {portion ?? 'Same as last time'}
                      </div>
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        fontSize: 'var(--v2-text-base)',
                        fontWeight: 'var(--v2-weight-semibold)',
                        color: 'var(--v2-text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right',
                        minWidth: 56,
                      }}
                    >
                      {cal}
                      <span
                        style={{
                          fontSize: 'var(--v2-text-xs)',
                          fontWeight: 'var(--v2-weight-regular)',
                          color: 'var(--v2-text-muted)',
                          marginLeft: 4,
                        }}
                      >
                        cal
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            style={{ margin: 0, color: 'var(--v2-accent-warning)', fontSize: 'var(--v2-text-sm)' }}
          >
            {error}
          </p>
        )}
      </div>

      <Sheet
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        title="Add to which meal?"
      >
        {pickerFor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--v2-space-3)' }}>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--v2-text-sm)',
                color: 'var(--v2-text-secondary)',
                lineHeight: 'var(--v2-leading-relaxed)',
              }}
            >
              {splitFoodLabel(pickerFor.name).name}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--v2-space-2)',
              }}
            >
              {MEALS.map((m) => (
                <Button
                  key={m.value}
                  variant={m.value === pickerFor.lastMealType ? 'primary' : 'secondary'}
                  size="lg"
                  fullWidth
                  onClick={() => handlePick(pickerFor, m.value)}
                  disabled={pendingId !== null}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </Card>
  )
}
