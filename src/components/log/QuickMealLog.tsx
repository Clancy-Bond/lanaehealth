'use client'

import { useState, useCallback, useMemo } from 'react'
import { detectTriggers, type DetectedTrigger } from '@/lib/food-triggers'
import type { FoodEntry, MealType } from '@/lib/types'

interface QuickMealLogProps {
  logId: string
  initialEntries: FoodEntry[]
  onAdd: (input: {
    log_id: string
    meal_type: MealType
    food_items: string
    flagged_triggers: string[]
  }) => Promise<FoodEntry>
  onDelete: (id: string) => Promise<void>
}

const MEAL_TYPES: { value: MealType; label: string; icon: string }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: '\u2600\uFE0F' },
  { value: 'lunch', label: 'Lunch', icon: '\uD83C\uDF1E' },
  { value: 'dinner', label: 'Dinner', icon: '\uD83C\uDF19' },
  { value: 'snack', label: 'Snack', icon: '\uD83C\uDF4E' },
]

const TRIGGER_COLORS: Record<string, string> = {
  Gluten: '#D97706',
  Dairy: '#3B82F6',
  Soy: '#10B981',
  'Red Meat': '#EF4444',
  Alcohol: '#8B5CF6',
  Caffeine: '#6366F1',
  Sugar: '#F97316',
  'Processed Foods': '#6B7280',
  'High FODMAP': '#EC4899',
  'Trans Fats': '#DC2626',
}

export default function QuickMealLog({
  logId,
  initialEntries,
  onAdd,
  onDelete,
}: QuickMealLogProps) {
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast')
  const [foodText, setFoodText] = useState('')
  const [entries, setEntries] = useState<FoodEntry[]>(initialEntries)
  const [saving, setSaving] = useState(false)

  // Real-time trigger detection
  const detectedTriggers: DetectedTrigger[] = useMemo(
    () => (foodText.length >= 2 ? detectTriggers(foodText) : []),
    [foodText]
  )

  const handleAdd = useCallback(async () => {
    if (!foodText.trim()) return
    setSaving(true)
    try {
      const triggers = detectTriggers(foodText).map((t) => t.category)
      const entry = await onAdd({
        log_id: logId,
        meal_type: selectedMeal,
        food_items: foodText.trim(),
        flagged_triggers: triggers,
      })
      setEntries((prev) => [entry, ...prev])
      setFoodText('')
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [foodText, logId, selectedMeal, onAdd])

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await onDelete(id)
        setEntries((prev) => prev.filter((e) => e.id !== id))
      } catch {
        // Silently fail
      }
    },
    [onDelete]
  )

  const getMealLabel = (type: MealType | null) =>
    MEAL_TYPES.find((m) => m.value === type)?.label ?? 'Meal'

  const getMealIcon = (type: MealType | null) =>
    MEAL_TYPES.find((m) => m.value === type)?.icon ?? ''

  return (
    <div className="space-y-4">
      {/* Meal type selector */}
      <div className="flex gap-2">
        {MEAL_TYPES.map((meal) => (
          <button
            key={meal.value}
            type="button"
            onClick={() => setSelectedMeal(meal.value)}
            className="flex-1 rounded-xl px-2 py-2 text-center text-xs font-medium transition-colors"
            style={{
              background:
                selectedMeal === meal.value
                  ? 'var(--accent-sage)'
                  : 'var(--bg-elevated)',
              color:
                selectedMeal === meal.value ? '#fff' : 'var(--text-secondary)',
              minHeight: 44,
            }}
          >
            <span className="block text-base">{meal.icon}</span>
            {meal.label}
          </button>
        ))}
      </div>

      {/* Food input */}
      <div className="relative">
        <input
          type="text"
          value={foodText}
          onChange={(e) => setFoodText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="What did you eat? (e.g., pasta with cheese)"
          className="w-full rounded-xl border px-3 py-3 text-sm"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Detected triggers */}
      {detectedTriggers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {detectedTriggers.map((trigger) => (
            <span
              key={trigger.category}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: `${TRIGGER_COLORS[trigger.category] ?? '#6B7280'}18`,
                color: TRIGGER_COLORS[trigger.category] ?? '#6B7280',
              }}
            >
              {trigger.category}
              <span className="ml-1 opacity-60">({trigger.matchedWord})</span>
            </span>
          ))}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!foodText.trim() || saving}
        className="w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
        style={{
          background: 'var(--accent-sage)',
          color: '#fff',
          minHeight: 44,
        }}
      >
        {saving ? 'Saving...' : 'Add Entry'}
      </button>

      {/* Logged entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Today&apos;s meals
          </span>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between rounded-lg px-3 py-2"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">
                    {getMealIcon(entry.meal_type)}
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {getMealLabel(entry.meal_type)}
                  </span>
                </div>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {entry.food_items}
                </p>
                {entry.flagged_triggers?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.flagged_triggers.map((t) => (
                      <span
                        key={t}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          background: `${TRIGGER_COLORS[t] ?? '#6B7280'}18`,
                          color: TRIGGER_COLORS[t] ?? '#6B7280',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(entry.id)}
                className="ml-2 flex h-7 w-7 items-center justify-center rounded-full"
                style={{
                  color: 'var(--text-muted)',
                  minWidth: 44,
                  minHeight: 44,
                }}
                title="Delete entry"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 3L11 11M3 11L11 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
