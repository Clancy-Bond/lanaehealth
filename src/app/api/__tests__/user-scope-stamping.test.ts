/**
 * Regression: PHI write routes refactored in PR follow-up #81 must
 * stamp user_id on every insert/upsert, and must filter daily_logs
 * lookups by user_id. This catches a route that drops the user scope
 * during a future refactor.
 *
 * The Supabase mock captures every call so the test can assert the
 * payload shape without a real DB. We do NOT exercise full business
 * logic - only the auth + user-scoping contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insertCalls: Array<{ table: string; row: Record<string, unknown> }> = []
const upsertCalls: Array<{ table: string; row: Record<string, unknown>; opts?: { onConflict?: string } }> = []
const updateCalls: Array<{ table: string; patch: Record<string, unknown>; eqs: Array<[string, unknown]> }> = []
const dailyLogsByUserAndDate: Record<string, { id: string }> = {}

vi.mock('@/lib/supabase', () => {
  const buildSelect = (table: string) => {
    const filters: Array<[string, unknown]> = []
    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        filters.push([col, val])
        return chain
      },
      maybeSingle: async () => {
        if (table === 'daily_logs') {
          const u = filters.find((f) => f[0] === 'user_id')?.[1] as string | undefined
          const d = filters.find((f) => f[0] === 'date')?.[1] as string | undefined
          if (u && d) {
            const key = `${u}|${d}`
            const row = dailyLogsByUserAndDate[key]
            return { data: row ?? null, error: null }
          }
        }
        return { data: null, error: null }
      },
      single: async () => ({ data: null, error: null }),
    }
    return chain
  }

  const buildFrom = (table: string) => ({
    select: () => buildSelect(table),
    insert: (row: Record<string, unknown>) => {
      insertCalls.push({ table, row })
      const select = () => ({
        single: async () => ({ data: { id: 'new-row-id', ...row }, error: null }),
      })
      return {
        select,
      }
    },
    upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => {
      upsertCalls.push({ table, row, opts })
      return {
        select: () => ({
          single: async () => ({ data: { id: 'new-row-id', ...row }, error: null }),
        }),
      }
    },
    update: (patch: Record<string, unknown>) => {
      const eqs: Array<[string, unknown]> = []
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          eqs.push([col, val])
          return chain
        },
        select: () => ({
          single: async () => ({ data: { id: 'row', ...patch }, error: null }),
        }),
      }
      // capture once when the chain is awaited
      const orig = chain.eq as (c: string, v: unknown) => unknown
      chain.eq = (col: string, val: unknown) => {
        const r = orig(col, val)
        updateCalls.push({ table, patch, eqs: [...eqs] })
        return r
      }
      return chain
    },
  })
  return {
    createServiceClient: () => ({ from: (table: string) => buildFrom(table) }),
    supabase: new Proxy({}, { get: () => () => ({}) }),
  }
})

vi.mock('@/lib/api/usda-food', () => ({
  getFoodNutrients: async () => ({
    description: 'Test Apple',
    servingSize: 100,
    servingUnit: 'g',
    calories: 52,
    protein: 0.3,
    fat: 0.2,
    satFat: 0,
    transFat: 0,
    cholesterol: 0,
    carbs: 14,
    fiber: 2.4,
    sugar: 10,
    sodium: 1,
    iron: 0.1,
    calcium: 6,
    vitaminC: 4.6,
    vitaminD: 0,
    vitaminB12: 0,
    magnesium: 5,
    zinc: 0,
    potassium: 107,
    omega3: 0,
    folate: 3,
  }),
  UsdaApiError: class extends Error {},
  UsdaFoodNotFoundError: class extends Error {},
}))

vi.mock('@/lib/food-triggers', () => ({
  detectTriggers: () => [],
}))

vi.mock('@/lib/auth/get-user', () => ({
  getCurrentUser: async () => null, // Force the OWNER_USER_ID fallback path.
}))

import { POST as foodLogPost } from '@/app/api/food/log/route'
import { POST as painLogPost } from '@/app/api/log/pain/route'
import { POST as cycleLogPost } from '@/app/api/cycle/log/route'

const OWNER_ID = '11111111-1111-1111-1111-111111111111'

beforeEach(() => {
  insertCalls.length = 0
  upsertCalls.length = 0
  updateCalls.length = 0
  for (const k of Object.keys(dailyLogsByUserAndDate)) delete dailyLogsByUserAndDate[k]
  process.env.OWNER_USER_ID = OWNER_ID
})
afterEach(() => {
  delete process.env.OWNER_USER_ID
})

describe('PHI write routes stamp user_id', () => {
  it('food/log creates daily_logs and food_entries both carrying user_id', async () => {
    const req = new Request('http://x/api/food/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fdcId: 12345, meal_type: 'snack', date: '2026-04-12' }),
    })
    const res = await foodLogPost(req as unknown as Parameters<typeof foodLogPost>[0])
    expect(res.status).toBe(200)

    // daily_logs insert (because no existing row) carries user_id
    const dailyLogInsert = insertCalls.find((c) => c.table === 'daily_logs')
    expect(dailyLogInsert).toBeDefined()
    expect(dailyLogInsert!.row.user_id).toBe(OWNER_ID)
    expect(dailyLogInsert!.row.date).toBe('2026-04-12')

    // food_entries insert carries user_id (and log_id)
    const foodInsert = insertCalls.find((c) => c.table === 'food_entries')
    expect(foodInsert).toBeDefined()
    expect(foodInsert!.row.user_id).toBe(OWNER_ID)
    expect(foodInsert!.row.log_id).toBeDefined()
  })

  it('food/log returns 401 with no session and no OWNER_USER_ID', async () => {
    delete process.env.OWNER_USER_ID
    const req = new Request('http://x/api/food/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fdcId: 12345, meal_type: 'snack', date: '2026-04-12' }),
    })
    const res = await foodLogPost(req as unknown as Parameters<typeof foodLogPost>[0])
    expect(res.status).toBe(401)
  })

  it('log/pain creates daily_logs with user_id and stamps user_id on pain_points', async () => {
    const req = new Request('http://x/api/log/pain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        date: '2026-04-12',
        intensity: 7,
        scale_used: 'nrs',
        qualities: ['sharp'],
        body_region: 'right_lower_quadrant',
      }),
    })
    const res = await painLogPost(req)
    expect(res.status).toBe(200)
    const dailyLogInsert = insertCalls.find((c) => c.table === 'daily_logs')
    expect(dailyLogInsert!.row.user_id).toBe(OWNER_ID)
    const painInsert = insertCalls.find((c) => c.table === 'pain_points')
    expect(painInsert!.row.user_id).toBe(OWNER_ID)
  })

  it('cycle/log upserts cycle_entries with user_id stamped', async () => {
    const req = new Request('http://x/api/cycle/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-04-12', menstruation: true, flow_level: 'light' }),
    })
    const res = await cycleLogPost(req as unknown as Parameters<typeof cycleLogPost>[0])
    expect(res.status).toBe(200)
    const cycleUpsert = upsertCalls.find((c) => c.table === 'cycle_entries')
    expect(cycleUpsert).toBeDefined()
    expect(cycleUpsert!.row.user_id).toBe(OWNER_ID)
    expect(cycleUpsert!.row.date).toBe('2026-04-12')
  })
})
