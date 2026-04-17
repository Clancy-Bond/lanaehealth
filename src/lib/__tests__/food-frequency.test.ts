import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing the module under test so the module-level
// `supabase` import resolves to our stub.
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
  createServiceClient: vi.fn(),
}))

// food-classification is pure, but we keep it real. If the classifier ever
// reaches into env or network we revisit.

import {
  normalizeFoodKey,
  getFrequentMeals,
  getFrequentMealsByType,
} from '@/lib/api/food'

// ---------------------------------------------------------------------------
// A hand-rolled query builder double that captures .eq/.gte/.order/.limit
// chain calls and resolves with a pre-seeded response. Much smaller than
// pulling in supabase-js test utilities, and exactly matches how food.ts
// walks the builder.
// ---------------------------------------------------------------------------

type Row = {
  meal_type: string
  food_items: string | null
  flagged_triggers: string[] | null
  logged_at: string
}

function makeBuilder(rows: Row[]) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = vi.fn(chain)
  b.eq = vi.fn(chain)
  b.gte = vi.fn(chain)
  b.lte = vi.fn(chain)
  b.in = vi.fn(chain)
  b.order = vi.fn(chain)
  b.limit = vi.fn(chain)
  b.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
  // thenable: getFrequentMeals awaits the builder after .limit(...)
  b.then = (resolve: (v: { data: Row[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null })
  return b
}

beforeEach(() => {
  mockFrom.mockReset()
})

// ---------------------------------------------------------------------------
// normalizeFoodKey -- documents the grouping contract used for chips
// ---------------------------------------------------------------------------

describe('normalizeFoodKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeFoodKey('  OatMeal  ')).toBe('oatmeal')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeFoodKey('Oatmeal  with   berries')).toBe('oatmeal with berries')
  })

  it('treats null and empty as empty string', () => {
    expect(normalizeFoodKey(null)).toBe('')
    expect(normalizeFoodKey(undefined)).toBe('')
    expect(normalizeFoodKey('')).toBe('')
  })

  it('does not normalize semantically different strings together', () => {
    // "oats" vs "oatmeal" deliberately stays split, documented trade-off.
    expect(normalizeFoodKey('oats')).not.toBe(normalizeFoodKey('oatmeal'))
  })
})

// ---------------------------------------------------------------------------
// getFrequentMeals -- frequency ranking + display-text recency
// ---------------------------------------------------------------------------

describe('getFrequentMeals', () => {
  it('returns top N grouped by normalized food_items', async () => {
    const rows: Row[] = [
      { meal_type: 'breakfast', food_items: 'Oatmeal', flagged_triggers: ['Gluten'], logged_at: '2026-04-15T08:00:00Z' },
      { meal_type: 'breakfast', food_items: 'oatmeal', flagged_triggers: [], logged_at: '2026-04-14T08:00:00Z' },
      { meal_type: 'breakfast', food_items: 'OATMEAL ', flagged_triggers: [], logged_at: '2026-04-13T08:00:00Z' },
      { meal_type: 'breakfast', food_items: 'Eggs and toast', flagged_triggers: ['Gluten'], logged_at: '2026-04-12T08:00:00Z' },
      { meal_type: 'breakfast', food_items: 'Eggs and toast', flagged_triggers: [], logged_at: '2026-04-11T08:00:00Z' },
      { meal_type: 'breakfast', food_items: 'Smoothie', flagged_triggers: [], logged_at: '2026-04-10T08:00:00Z' },
    ]
    mockFrom.mockReturnValue(makeBuilder(rows))

    const out = await getFrequentMeals('breakfast', 90, 5)

    expect(out.length).toBe(3)
    // Oatmeal group has 3 entries, wins
    expect(out[0].count).toBe(3)
    // Display text takes the most-recent surface form ("Oatmeal", not "OATMEAL")
    expect(out[0].food_items).toBe('Oatmeal')
    // Most recent matching row's triggers carry through
    expect(out[0].flagged_triggers).toEqual(['Gluten'])
    expect(out[1].count).toBe(2)
    expect(out[1].food_items).toBe('Eggs and toast')
    expect(out[2].count).toBe(1)
  })

  it('respects the limit parameter', async () => {
    const rows: Row[] = [
      { meal_type: 'lunch', food_items: 'A', flagged_triggers: [], logged_at: '2026-04-15T12:00:00Z' },
      { meal_type: 'lunch', food_items: 'B', flagged_triggers: [], logged_at: '2026-04-14T12:00:00Z' },
      { meal_type: 'lunch', food_items: 'C', flagged_triggers: [], logged_at: '2026-04-13T12:00:00Z' },
      { meal_type: 'lunch', food_items: 'D', flagged_triggers: [], logged_at: '2026-04-12T12:00:00Z' },
    ]
    mockFrom.mockReturnValue(makeBuilder(rows))

    const out = await getFrequentMeals('lunch', 90, 2)
    expect(out.length).toBe(2)
  })

  it('returns empty list when no matching rows', async () => {
    mockFrom.mockReturnValue(makeBuilder([]))
    const out = await getFrequentMeals('dinner', 90, 5)
    expect(out).toEqual([])
  })

  it('breaks ties by most-recent logged_at', async () => {
    const rows: Row[] = [
      { meal_type: 'snack', food_items: 'older', flagged_triggers: [], logged_at: '2026-04-10T00:00:00Z' },
      { meal_type: 'snack', food_items: 'newer', flagged_triggers: [], logged_at: '2026-04-15T00:00:00Z' },
    ]
    mockFrom.mockReturnValue(makeBuilder(rows))
    const out = await getFrequentMeals('snack', 90, 5)
    // Both count=1, tie broken by recency
    expect(out[0].food_items).toBe('newer')
    expect(out[1].food_items).toBe('older')
  })

  it('skips rows with empty/null food_items', async () => {
    const rows: Row[] = [
      { meal_type: 'breakfast', food_items: 'Oatmeal', flagged_triggers: [], logged_at: '2026-04-15T08:00:00Z' },
      { meal_type: 'breakfast', food_items: null, flagged_triggers: [], logged_at: '2026-04-14T08:00:00Z' },
      { meal_type: 'breakfast', food_items: '   ', flagged_triggers: [], logged_at: '2026-04-13T08:00:00Z' },
    ]
    mockFrom.mockReturnValue(makeBuilder(rows))
    const out = await getFrequentMeals('breakfast', 90, 5)
    expect(out.length).toBe(1)
    expect(out[0].food_items).toBe('Oatmeal')
  })

  it('surfaces database errors', async () => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.eq = vi.fn(chain)
    b.gte = vi.fn(chain)
    b.order = vi.fn(chain)
    b.limit = vi.fn(chain)
    b.then = (resolve: (v: { data: null; error: { message: string } }) => unknown) =>
      resolve({ data: null, error: { message: 'boom' } })
    mockFrom.mockReturnValue(b)

    await expect(getFrequentMeals('breakfast', 90, 5)).rejects.toThrow('boom')
  })
})

// ---------------------------------------------------------------------------
// getFrequentMealsByType -- parallel fetch keyed by MealType
// ---------------------------------------------------------------------------

describe('getFrequentMealsByType', () => {
  it('returns a map with all four meal types', async () => {
    mockFrom.mockReturnValue(makeBuilder([]))
    const out = await getFrequentMealsByType(90, 5)
    expect(Object.keys(out).sort()).toEqual(
      ['breakfast', 'dinner', 'lunch', 'snack'],
    )
    expect(out.breakfast).toEqual([])
  })
})
