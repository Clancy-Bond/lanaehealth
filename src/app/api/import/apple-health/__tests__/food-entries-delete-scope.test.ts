/**
 * Tests for /api/import/apple-health food_entries dedupe-delete scoping.
 *
 * Bug (QA W2.10): the importer dedupe-deletes existing Apple Health summary
 * rows before re-inserting. The original filter was only
 *   log_id = X AND meal_type = 'snack' AND food_items ILIKE 'Daily total:%'
 * which would also match a user-typed snack row that happened to begin with
 * "Daily total:". food_entries has no `source`/`import_source` column, so the
 * fix narrows the filter with a jsonb tag written on every Apple Health row:
 *   macros->>source = 'apple_health_export'
 *
 * These tests replay the delete filter against an in-memory fixture that
 * contains both an Apple Health row (tagged) and a user-entered row that
 * starts with "Daily total:" (untagged). Only the Apple row must be deleted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Captured calls on the supabase mock
type DeleteFilterChain = {
  table: string
  filters: Array<{ op: 'eq' | 'ilike' | 'filter'; col: string; value: unknown; rawOp?: string }>
}
type InsertCall = { table: string; payload: Record<string, unknown> }

const deleteChains: DeleteFilterChain[] = []
const insertCalls: InsertCall[] = []

// Minimal DailySummary fixture -- one day with nutrition that triggers
// upsertNutrition and thus the delete+insert path on food_entries.
const fixtureSummary = {
  date: '2026-04-10',
  basalTemp: null,
  menstrualFlow: null,
  cervicalMucus: null,
  ovulationTest: null,
  sexualActivity: false,
  heartRateAvg: null,
  heartRateMin: null,
  heartRateMax: null,
  restingHR: null,
  hrv: null,
  bloodOxygen: null,
  respiratoryRate: null,
  bpSystolic: null,
  bpDiastolic: null,
  bloodGlucose: null,
  vo2Max: null,
  bodyTemp: null,
  weight: null,
  bmi: null,
  bodyFat: null,
  height: null,
  steps: null,
  walkingDistance: null,
  flightsClimbed: null,
  activeEnergy: null,
  exerciseMinutes: null,
  sleepHours: null,
  calories: 2100,
  protein: 95,
  fat: 70,
  carbs: 250,
  fiber: 30,
  sugar: 40,
  sodium: 2400,
  iron: 12,
  calcium: 1000,
  vitaminD: 600,
  vitaminC: 80,
  caffeine: 100,
  water: 2000,
}

vi.mock('@/lib/importers/apple-health', () => ({
  parseAppleHealthXml: () => ({
    recordCount: 1,
    dailySummaries: new Map([[fixtureSummary.date, fixtureSummary]]),
    dateRange: { start: fixtureSummary.date, end: fixtureSummary.date },
    sources: ['apple_health_export'],
  }),
}))

vi.mock('@/lib/food-triggers', () => ({
  detectTriggers: () => [],
}))

// Fake supabase client. The only table the test needs to drive carefully is
// food_entries (delete-then-insert). Everything else is a no-op.
vi.mock('@/lib/supabase', () => {
  const buildQuery = (table: string) => {
    const deleteChain: DeleteFilterChain = { table, filters: [] }
    let mode: 'idle' | 'delete' | 'select' | 'upsert' = 'idle'

    const chain: Record<string, unknown> = {
      delete: () => {
        mode = 'delete'
        deleteChains.push(deleteChain)
        return chain
      },
      select: (_cols?: string) => {
        mode = 'select'
        return chain
      },
      eq: (col: string, value: unknown) => {
        if (mode === 'delete') deleteChain.filters.push({ op: 'eq', col, value })
        return chain
      },
      ilike: (col: string, value: unknown) => {
        if (mode === 'delete') deleteChain.filters.push({ op: 'ilike', col, value })
        return chain
      },
      filter: (col: string, rawOp: string, value: unknown) => {
        if (mode === 'delete') deleteChain.filters.push({ op: 'filter', col, value, rawOp })
        // Must be awaitable when used as the terminal link in the delete chain.
        const thenable = {
          ...chain,
          then: (resolve: (v: { data: null; error: null }) => unknown) =>
            resolve({ data: null, error: null }),
        }
        return thenable
      },
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: { id: 'log-1' }, error: null }),
      insert: (payload: Record<string, unknown>) => {
        insertCalls.push({ table, payload })
        // Must support three call shapes from the route:
        //   await supabase.from(T).insert(x)                       -- food_entries
        //   supabase.from(T).insert(x).select('id').single()       -- daily_logs
        //   .from(T).insert(x)                                     -- oura_daily
        // So the returned object must be both awaitable AND chainable.
        const res: Record<string, unknown> = {
          data: null,
          error: null,
          select: (_cols: string) => ({
            single: async () => ({ data: { id: 'log-1' }, error: null }),
          }),
          then: (resolve: (v: { data: null; error: null }) => unknown) =>
            resolve({ data: null, error: null }),
        }
        return res
      },
      upsert: async (_payload: Record<string, unknown>, _opts?: { onConflict?: string }) => ({
        data: null,
        error: null,
      }),
      update: () => ({
        eq: async () => ({ data: null, error: null }),
      }),
    }
    return chain
  }

  return {
    createServiceClient: () => ({
      from: (table: string) => buildQuery(table),
    }),
    supabase: {},
  }
})

// Helper: run the captured filter chain against an in-memory fixture table
// and return the rows it would delete.
type FoodRow = {
  id: string
  log_id: string
  meal_type: string
  food_items: string
  macros: Record<string, unknown> | null
}
function applyFilters(rows: FoodRow[], chain: DeleteFilterChain): FoodRow[] {
  return rows.filter((row) => {
    for (const f of chain.filters) {
      if (f.op === 'eq') {
        if ((row as unknown as Record<string, unknown>)[f.col] !== f.value) return false
      } else if (f.op === 'ilike') {
        // Supabase ilike: case-insensitive match, `%` wildcard.
        const pattern = String(f.value)
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/%/g, '.*')
        const re = new RegExp('^' + pattern + '$', 'i')
        if (!re.test(String((row as unknown as Record<string, unknown>)[f.col] ?? ''))) return false
      } else if (f.op === 'filter') {
        // We only support `macros->>source` eq 'value' here.
        if (f.col === 'macros->>source' && f.rawOp === 'eq') {
          const src = (row.macros as Record<string, unknown> | null)?.source
          if (src !== f.value) return false
        } else {
          // Unknown filter: fail closed so tests catch any drift.
          return false
        }
      }
    }
    return true
  })
}

function makeXmlFormData(): FormData {
  const fd = new FormData()
  fd.append('file', new Blob(['<HealthData><Record/></HealthData>'], { type: 'text/xml' }), 'export.xml')
  return fd
}

describe('POST /api/import/apple-health food_entries delete scope', () => {
  beforeEach(() => {
    deleteChains.length = 0
    insertCalls.length = 0
    vi.clearAllMocks()
  })

  it('captures a delete on food_entries with the apple_health_export source filter', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost:3005/api/import/apple-health', {
      method: 'POST',
      body: makeXmlFormData(),
    })
    await POST(req as never)

    const foodDeletes = deleteChains.filter((c) => c.table === 'food_entries')
    expect(foodDeletes.length).toBeGreaterThan(0)

    // Every food_entries delete must carry the jsonb source tag filter so it
    // cannot match user-entered rows.
    for (const del of foodDeletes) {
      const hasSourceFilter = del.filters.some(
        (f) =>
          f.op === 'filter' &&
          f.col === 'macros->>source' &&
          f.rawOp === 'eq' &&
          f.value === 'apple_health_export',
      )
      expect(hasSourceFilter).toBe(true)
    }
  })

  it('deletes only the Apple-Health-tagged row and spares the user-entered row', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost:3005/api/import/apple-health', {
      method: 'POST',
      body: makeXmlFormData(),
    })
    await POST(req as never)

    // Simulated food_entries contents for log_id='log-1' at the import date
    const fixture: FoodRow[] = [
      {
        id: 'apple-1',
        log_id: 'log-1',
        meal_type: 'snack',
        food_items: 'Daily total: 1950 cal',
        macros: { source: 'apple_health_export', protein: 80, carbs: 210 },
      },
      {
        id: 'user-1',
        log_id: 'log-1',
        meal_type: 'snack',
        food_items: 'Daily total: what I ate today (manual log)',
        macros: { protein: 90, carbs: 240 }, // no source tag -- user-entered
      },
      // Off-log row, same name -- different day's daily log
      {
        id: 'other-log',
        log_id: 'log-2',
        meal_type: 'snack',
        food_items: 'Daily total: 2400 cal',
        macros: { source: 'apple_health_export' },
      },
      // Breakfast row, not snack, should not match
      {
        id: 'breakfast-1',
        log_id: 'log-1',
        meal_type: 'breakfast',
        food_items: 'Daily total: morning',
        macros: { source: 'apple_health_export' },
      },
    ]

    const foodDeletes = deleteChains.filter((c) => c.table === 'food_entries')
    // Combine across all delete chains (one per day processed -- here just 1)
    const deletedIds = new Set<string>()
    for (const chain of foodDeletes) {
      for (const row of applyFilters(fixture, chain)) {
        deletedIds.add(row.id)
      }
    }

    expect(Array.from(deletedIds).sort()).toEqual(['apple-1'])
    expect(deletedIds.has('user-1')).toBe(false)
    expect(deletedIds.has('other-log')).toBe(false)
    expect(deletedIds.has('breakfast-1')).toBe(false)
  })

  it('tags the inserted food_entries row with macros.source = apple_health_export', async () => {
    const { POST } = await import('../route')
    const req = new Request('http://localhost:3005/api/import/apple-health', {
      method: 'POST',
      body: makeXmlFormData(),
    })
    await POST(req as never)

    const foodInserts = insertCalls.filter((c) => c.table === 'food_entries')
    expect(foodInserts.length).toBeGreaterThan(0)
    for (const ins of foodInserts) {
      const macros = ins.payload.macros as Record<string, unknown> | undefined
      expect(macros).toBeTruthy()
      expect(macros?.source).toBe('apple_health_export')
    }
  })
})
