'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { detectTriggers, type DetectedTrigger } from '@/lib/food-triggers'
import type { FoodEntry, MealType } from '@/lib/types'
import type { RecentMeal } from '@/app/log/page'
import FoodSearchAutocomplete from './FoodSearchAutocomplete'
import type { FoodSearchResult } from '@/lib/food-database'

/**
 * A frequency-ranked chip suggestion, one per normalized food_items
 * within a specific meal_type. See src/lib/api/food.ts for the source query.
 * The component keeps this typed locally to avoid a server-file import.
 */
export interface FrequentMealChip {
  meal_type: MealType
  food_items: string
  flagged_triggers: string[]
  count: number
  last_logged_at: string
}

interface QuickMealLogProps {
  logId: string
  initialEntries: FoodEntry[]
  recentMeals: RecentMeal[]
  /**
   * Optional frequency-ranked chips per meal_type. Rendered above the free-text
   * input when the selected meal_type has any matches. Empty/missing map is
   * silently ignored (graceful empty state).
   */
  frequentMeals?: Partial<Record<MealType, FrequentMealChip[]>>
  /**
   * Copy meals from a prior date. Returns the newly-inserted entries so the
   * host can merge them into local state. Optional: when omitted, the copy
   * button stays hidden.
   */
  onCopyFromDate?: (sourceDate: string) => Promise<FoodEntry[]>
  /**
   * ISO date (yyyy-MM-dd) of the prior day, used to enable the
   * "Same as yesterday" quick-copy button.
   */
  yesterdayDate?: string
  /**
   * Hint whether yesterday has any meals to copy. When false the
   * "Same as yesterday" chip is rendered disabled with a tooltip.
   */
  yesterdayHasMeals?: boolean
  onAdd: (input: {
    log_id: string
    meal_type: MealType
    food_items: string
    flagged_triggers: string[]
  }) => Promise<FoodEntry>
  onDelete: (id: string) => Promise<void>
}

interface FavoriteMeal {
  meal_type: string
  food_items: string
  flagged_triggers: string[]
}

const FAVORITES_KEY = 'lanae_favorite_meals'

function loadFavorites(): FavoriteMeal[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    return raw ? (JSON.parse(raw) as FavoriteMeal[]) : []
  } catch {
    return []
  }
}

function saveFavorites(favs: FavoriteMeal[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs))
  } catch {
    // Storage full or unavailable
  }
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
  recentMeals,
  frequentMeals,
  onCopyFromDate,
  yesterdayDate,
  yesterdayHasMeals,
  onAdd,
  onDelete,
}: QuickMealLogProps) {
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast')
  const [foodText, setFoodText] = useState('')
  const [entries, setEntries] = useState<FoodEntry[]>(initialEntries)
  const [saving, setSaving] = useState(false)
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([])
  const [copying, setCopying] = useState(false)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [pickingDate, setPickingDate] = useState(false)

  // Load favorites from localStorage on mount
  useEffect(() => {
    setFavorites(loadFavorites())
  }, [])

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

  // Fill input from a recent meal or favorite chip
  const fillFromMeal = useCallback(
    (meal: { meal_type: string | null; food_items: string }) => {
      setFoodText(meal.food_items)
      const mealType = MEAL_TYPES.find((m) => m.value === meal.meal_type)
      if (mealType) {
        setSelectedMeal(mealType.value)
      }
    },
    []
  )

  // Toggle favorite for a meal
  const toggleFavorite = useCallback(
    (meal: { meal_type: string | null; food_items: string; flagged_triggers: string[] }) => {
      setFavorites((prev) => {
        const key = meal.food_items.trim().toLowerCase()
        const exists = prev.some((f) => f.food_items.trim().toLowerCase() === key)
        let next: FavoriteMeal[]
        if (exists) {
          next = prev.filter((f) => f.food_items.trim().toLowerCase() !== key)
        } else {
          next = [
            ...prev,
            {
              meal_type: meal.meal_type ?? 'snack',
              food_items: meal.food_items,
              flagged_triggers: meal.flagged_triggers,
            },
          ]
        }
        saveFavorites(next)
        return next
      })
    },
    []
  )

  const isFavorite = useCallback(
    (foodItems: string) => {
      const key = foodItems.trim().toLowerCase()
      return favorites.some((f) => f.food_items.trim().toLowerCase() === key)
    },
    [favorites]
  )

  const getMealLabel = (type: MealType | null) =>
    MEAL_TYPES.find((m) => m.value === type)?.label ?? 'Meal'

  const getMealIcon = (type: MealType | string | null) =>
    MEAL_TYPES.find((m) => m.value === type)?.icon ?? ''

  // Filter recent meals to exclude entries already in favorites
  const filteredRecent = useMemo(() => {
    const favKeys = new Set(favorites.map((f) => f.food_items.trim().toLowerCase()))
    return recentMeals.filter((m) => !favKeys.has(m.food_items.trim().toLowerCase()))
  }, [recentMeals, favorites])

  // Frequency-weighted chips for the currently-selected meal_type.
  // Lowercase + trim normalization happens upstream in getFrequentMeals.
  const currentFrequent: FrequentMealChip[] = useMemo(() => {
    if (!frequentMeals) return []
    const list = frequentMeals[selectedMeal] ?? []
    // Hide suggestions that are already showing as favorites so we don't
    // double up a chip row visually.
    const favKeys = new Set(favorites.map((f) => f.food_items.trim().toLowerCase()))
    return list.filter((c) => !favKeys.has(c.food_items.trim().toLowerCase()))
  }, [frequentMeals, selectedMeal, favorites])

  const runCopy = useCallback(
    async (sourceDate: string) => {
      if (!onCopyFromDate || !sourceDate) return
      setCopying(true)
      setCopyNotice(null)
      try {
        const added = await onCopyFromDate(sourceDate)
        if (added.length === 0) {
          setCopyNotice('No meals to copy from that date.')
        } else {
          setEntries((prev) => [...added, ...prev])
          setCopyNotice(`Copied ${added.length} meal${added.length === 1 ? '' : 's'}.`)
        }
      } catch {
        setCopyNotice('Copy failed. Try again.')
      } finally {
        setCopying(false)
        // Auto-clear the notice after a few seconds so it doesn't stick.
        setTimeout(() => setCopyNotice(null), 5000)
      }
    },
    [onCopyFromDate],
  )

  const handleCopyYesterday = useCallback(() => {
    if (yesterdayDate) runCopy(yesterdayDate)
  }, [runCopy, yesterdayDate])

  const handleCopyCustom = useCallback(() => {
    if (customDate) {
      runCopy(customDate)
      setPickingDate(false)
      setCustomDate('')
    }
  }, [runCopy, customDate])

  // "Today" and "1 year ago" bounds for the date picker. Copy from the future
  // makes no sense; copying older than 365 days is technically fine but the
  // implementation-notes.md cap is 365 for UX.
  const today = new Date().toISOString().slice(0, 10)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

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

      {/* Copy from prior date (MyFitnessPal-style "Same as yesterday") */}
      {onCopyFromDate && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyYesterday}
            disabled={copying || !yesterdayDate || yesterdayHasMeals === false}
            title={
              yesterdayHasMeals === false
                ? 'No meals to copy from yesterday.'
                : 'Copy all meals from yesterday into today.'
            }
            className="flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-opacity disabled:opacity-40"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--accent-sage)',
              color: 'var(--text-primary)',
              minHeight: 44,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="3" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <rect x="4.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
            {copying ? 'Copying...' : 'Same as yesterday'}
          </button>

          <button
            type="button"
            onClick={() => setPickingDate((p) => !p)}
            disabled={copying}
            className="flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-opacity disabled:opacity-40"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-light)',
              color: 'var(--text-secondary)',
              minHeight: 44,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="2" y="3" width="10" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M4.5 2V4M9.5 2V4M2 6H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Pick date
          </button>

          {pickingDate && (
            <div className="flex w-full items-center gap-2">
              <input
                type="date"
                value={customDate}
                min={oneYearAgo}
                max={today}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 rounded-xl border px-3 text-sm"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  minHeight: 44,
                }}
              />
              <button
                type="button"
                onClick={handleCopyCustom}
                disabled={!customDate || copying}
                className="rounded-xl px-4 text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{
                  background: 'var(--accent-sage)',
                  color: '#fff',
                  minHeight: 44,
                }}
              >
                {copying ? 'Copying...' : 'Copy'}
              </button>
            </div>
          )}

          {copyNotice && (
            <span
              role="status"
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {copyNotice}
            </span>
          )}
        </div>
      )}

      {/* Frequency-weighted suggestions for the currently-selected meal_type.
          Hidden when the current meal_type has no history; no empty-state card. */}
      {currentFrequent.length > 0 && (
        <div className="space-y-1.5">
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M6 1L7.5 4.5L11 5L8.25 7.5L9 11L6 9L3 11L3.75 7.5L1 5L4.5 4.5L6 1Z"
                stroke="var(--accent-sage)"
                strokeWidth="1"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
            Frequent {getMealLabel(selectedMeal).toLowerCase()}s
          </span>
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {currentFrequent.map((chip, i) => (
              <button
                key={`freq-${i}`}
                type="button"
                onClick={() =>
                  fillFromMeal({
                    meal_type: chip.meal_type,
                    food_items: chip.food_items,
                  })
                }
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-light)',
                  color: 'var(--text-primary)',
                  maxWidth: 220,
                  minHeight: 44,
                }}
              >
                <span>{getMealIcon(chip.meal_type)}</span>
                <span className="truncate">
                  {chip.food_items.length > 30
                    ? chip.food_items.slice(0, 30) + '...'
                    : chip.food_items}
                </span>
                <span
                  className="ml-0.5 rounded-full px-1.5 text-[10px] font-semibold"
                  style={{
                    background: 'var(--accent-sage)',
                    color: '#fff',
                  }}
                >
                  {chip.count}x
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Favorites section */}
      {favorites.length > 0 && (
        <div className="space-y-1.5">
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1.5L7.4 4.3L10.5 4.7L8.2 6.9L8.8 10L6 8.5L3.2 10L3.8 6.9L1.5 4.7L4.6 4.3L6 1.5Z"
                fill="var(--accent-sage)"
                stroke="var(--accent-sage)"
                strokeWidth="0.8"
              />
            </svg>
            Favorites
          </span>
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {favorites.map((fav, i) => (
              <button
                key={`fav-${i}`}
                type="button"
                onClick={() => fillFromMeal(fav)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--accent-sage)',
                  color: 'var(--text-primary)',
                  maxWidth: 200,
                }}
              >
                <span>{getMealIcon(fav.meal_type)}</span>
                <span className="truncate">
                  {fav.food_items.length > 30
                    ? fav.food_items.slice(0, 30) + '...'
                    : fav.food_items}
                </span>
                {fav.flagged_triggers.length > 0 && (
                  <span
                    className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: 'var(--phase-menstrual)',
                      color: '#fff',
                    }}
                  >
                    {fav.flagged_triggers.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent meals section */}
      {filteredRecent.length > 0 && (
        <div className="space-y-1.5">
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
            Recent meals
          </span>
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {filteredRecent.map((meal, i) => (
              <button
                key={`recent-${i}`}
                type="button"
                onClick={() => fillFromMeal(meal)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-light)',
                  color: 'var(--text-primary)',
                  maxWidth: 200,
                }}
              >
                <span>{getMealIcon(meal.meal_type)}</span>
                <span className="truncate">
                  {meal.food_items.length > 30
                    ? meal.food_items.slice(0, 30) + '...'
                    : meal.food_items}
                </span>
                {meal.flagged_triggers.length > 0 && (
                  <span
                    className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: 'var(--phase-menstrual)',
                      color: '#fff',
                    }}
                  >
                    {meal.flagged_triggers.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Food input with optional database search */}
      <div className="space-y-2">
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
        {/* Food database search */}
        <FoodSearchAutocomplete
          placeholder="Or search food database..."
          onSelect={(food: FoodSearchResult) => {
            const label = food.brand ? `${food.name} (${food.brand})` : food.name
            setFoodText((prev) => prev ? `${prev}, ${label}` : label)
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

              {/* Action buttons: favorite + log again + delete */}
              <div className="ml-2 flex items-center gap-0.5">
                {/* Favorite toggle */}
                <button
                  type="button"
                  onClick={() =>
                    toggleFavorite({
                      meal_type: entry.meal_type,
                      food_items: entry.food_items ?? '',
                      flagged_triggers: entry.flagged_triggers ?? [],
                    })
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ minWidth: 32, minHeight: 32 }}
                  title={
                    isFavorite(entry.food_items ?? '')
                      ? 'Remove from favorites'
                      : 'Add to favorites'
                  }
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7 2L8.5 5.2L12 5.6L9.5 8L10.1 11.5L7 9.8L3.9 11.5L4.5 8L2 5.6L5.5 5.2L7 2Z"
                      fill={isFavorite(entry.food_items ?? '') ? 'var(--accent-sage)' : 'none'}
                      stroke={isFavorite(entry.food_items ?? '') ? 'var(--accent-sage)' : 'var(--text-muted)'}
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {/* Log again */}
                <button
                  type="button"
                  onClick={() =>
                    fillFromMeal({
                      meal_type: entry.meal_type,
                      food_items: entry.food_items ?? '',
                    })
                  }
                  className="flex h-7 items-center justify-center rounded-full px-2"
                  style={{
                    minHeight: 32,
                    color: 'var(--accent-sage)',
                  }}
                  title="Log again"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mr-0.5">
                    <path
                      d="M1.5 6.5C1.5 4 3.5 2 6 2C8.5 2 10.5 4 10.5 6.5C10.5 9 8.5 11 6 11C4.5 11 3.2 10.3 2.4 9.2"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <path d="M1 4.5L1.5 6.5L3.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[10px] font-medium">Again</span>
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    color: 'var(--text-muted)',
                    minWidth: 32,
                    minHeight: 32,
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
