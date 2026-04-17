'use client'

import { useState } from 'react'
import { addFoodEntry } from '@/lib/api/food'
import type { MealType } from '@/lib/types'
import type { RecentMeal } from '@/app/log/page'

interface FoodQuickRowProps {
  logId: string
  recentMeals: RecentMeal[]
  onOpenDetails: () => void
}

function currentMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 20) return 'dinner'
  return 'snack'
}

export default function FoodQuickRow({ logId, recentMeals, onOpenDetails }: FoodQuickRowProps) {
  const [adding, setAdding] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const top = recentMeals
    .filter(m => {
      const t = (m.food_items ?? '').trim()
      if (!t) return false
      const lower = t.toLowerCase()
      if (lower.startsWith('daily total')) return false
      if (/^water\b/i.test(lower)) return false
      if (lower === 'exercise' || lower.startsWith('exercise ')) return false
      if (lower.includes('kcal') && !lower.includes(' ')) return false
      return true
    })
    .slice(0, 4)

  const relog = async (meal: RecentMeal) => {
    const key = meal.food_items
    if (addedIds.has(key) || adding) return
    setAdding(key)
    try {
      await addFoodEntry({
        log_id: logId,
        meal_type: (meal.meal_type as MealType) ?? currentMealType(),
        food_items: meal.food_items,
        flagged_triggers: meal.flagged_triggers ?? [],
      })
      setAddedIds(prev => new Set(prev).add(key))
    } catch {
      // noop
    } finally {
      setAdding(null)
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#FFFDF9', border: '1px solid rgba(107, 144, 128, 0.15)' }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium" style={{ color: '#3a3a3a' }}>
          Food today
          <span className="ml-2 text-xs font-normal" style={{ color: '#8a8a8a' }}>
            Tap a recent meal to re-log
          </span>
        </h3>
        <button
          onClick={onOpenDetails}
          className="text-xs underline"
          style={{ color: '#6B9080' }}
        >
          Add new
        </button>
      </div>

      {top.length === 0 ? (
        <p className="text-sm" style={{ color: '#8a8a8a' }}>
          No recent meals yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {top.map(m => {
            const key = m.food_items
            const added = addedIds.has(key)
            const busy = adding === key
            return (
              <button
                key={key + m.logged_at}
                type="button"
                onClick={() => relog(m)}
                disabled={added || busy}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition text-left"
                style={{
                  background: added ? '#E8EDE6' : 'transparent',
                  color: added ? '#4A6B52' : '#3a3a3a',
                  border: `1px solid ${added ? 'rgba(74, 107, 82, 0.4)' : 'rgba(107, 144, 128, 0.25)'}`,
                  opacity: busy ? 0.6 : 1,
                  maxWidth: '100%',
                }}
                aria-label={added ? `Re-logged ${m.food_items}` : `Re-log ${m.food_items}`}
                title={m.food_items}
              >
                {added ? <span aria-hidden>&#10003;</span> : null}
                <span className="truncate" style={{ maxWidth: '16rem' }}>
                  {m.food_items}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
