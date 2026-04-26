/**
 * Multi-user isolation tests for loadCycleContext.
 *
 * The threat model (PR #115 isolation test): the cycle loader used to
 * pull cycle_entries / nc_imported / oura_daily without filtering by
 * user_id. Once a second auth user existed, every brand-new account
 * saw Lanae's cycle history.
 *
 * These tests pin three properties:
 *
 *   1. Pre-migration (column missing): the loader gracefully falls
 *      back to the unfiltered query so Lanae's view is untouched.
 *      No data widening, no thrown error.
 *
 *   2. Post-migration (column present, two users): each user sees only
 *      their own rows. New users (no rows yet) see EMPTY data, not a
 *      leak from the existing patient.
 *
 *   3. The userId is forwarded to the column-existence cache so the
 *      single-user-fallback warning fires at most once per process.
 *
 * The Supabase client is mocked at the table level so each test
 * controls exactly what each call returns. The pure helpers
 * (computeCycleStats, fuseOvulationSignal, etc.) are still real, which
 * gives the tests teeth: a leak would actually surface in
 * `current.lastPeriodStart` etc., not just in some opaque return
 * shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetUserIdColumnCache } from '@/lib/auth/scope-query'

// Per-test handle on the most recent calls + responses keyed by table.
type TableResponses = Map<string, { rows: unknown[]; missingColumn?: boolean }>
let tableResponses: TableResponses = new Map()
let calls: Array<{ table: string; filteredByUserId: string | null }> = []

interface Builder {
  select: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
}

function makeBuilder(table: string, scopedUserId: string | null = null): Builder {
  const builder = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn(function (this: Builder, col: string, val: string) {
      if (col === 'user_id') {
        return makeBuilder(table, val)
      }
      return this
    }),
    then(resolve: (value: unknown) => unknown) {
      calls.push({ table, filteredByUserId: scopedUserId })
      const cfg = tableResponses.get(table) ?? { rows: [] }
      if (cfg.missingColumn && scopedUserId != null) {
        return Promise.resolve(
          resolve({
            data: null,
            error: { message: 'column "user_id" does not exist', code: '42703' },
          }),
        )
      }
      const rows = filterRowsByUser(cfg.rows, scopedUserId)
      return Promise.resolve(resolve({ data: rows, error: null }))
    },
  } as Builder
  // Override eq so it returns a builder bound to the SAME table; the
  // initial helper above uses makeBuilder() which makes a fresh one,
  // but that fresh builder still needs its eq() to chain.
  builder.eq = vi.fn(function (col: string, val: string) {
    if (col === 'user_id') {
      return makeBuilder(table, val)
    }
    return builder
  })
  return builder
}

function filterRowsByUser(rows: unknown[], userId: string | null): unknown[] {
  if (userId == null) return rows
  return rows.filter((r) => (r as { user_id?: string }).user_id === userId)
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}))

// loadBbtLog reads health_profile, which we don't model here. Stub it.
vi.mock('@/lib/cycle/bbt-log', () => ({
  loadBbtLog: () => Promise.resolve({ entries: [] }),
  detectOvulationShift: () => false,
}))

const TODAY = '2026-04-25'
const LANAE = 'lanae-uuid-0000'
const NEW_USER = 'newuser-uuid-9999'

beforeEach(() => {
  tableResponses = new Map()
  calls = []
  __resetUserIdColumnCache()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadCycleContext: multi-user isolation', () => {
  it('pre-migration: column missing, no userId passed → returns Lanaes data unchanged', async () => {
    tableResponses.set('cycle_entries', {
      rows: [{ date: '2026-04-20', menstruation: true, lh_test_result: null }],
    })
    tableResponses.set('nc_imported', { rows: [] })
    tableResponses.set('oura_daily', { rows: [] })

    const { loadCycleContext } = await import('@/lib/cycle/load-cycle-context')
    const ctx = await loadCycleContext(TODAY)

    expect(ctx.current.lastPeriodStart).toBe('2026-04-20')
    // No filtered call attempted because no userId was passed.
    expect(calls.every((c) => c.filteredByUserId === null)).toBe(true)
  })

  it('pre-migration: userId passed but column missing → graceful fallback returns Lanaes data', async () => {
    tableResponses.set('cycle_entries', {
      rows: [{ date: '2026-04-20', menstruation: true, lh_test_result: null }],
      missingColumn: true,
    })
    tableResponses.set('nc_imported', { rows: [], missingColumn: true })
    tableResponses.set('oura_daily', { rows: [], missingColumn: true })

    const { loadCycleContext } = await import('@/lib/cycle/load-cycle-context')
    const ctx = await loadCycleContext(TODAY, LANAE)

    expect(ctx.current.lastPeriodStart).toBe('2026-04-20')
    // We tried filtered first (and it 42703'd), then unfiltered. Both
    // are recorded.
    const cycleCalls = calls.filter((c) => c.table === 'cycle_entries')
    expect(cycleCalls.some((c) => c.filteredByUserId === LANAE)).toBe(true)
    expect(cycleCalls.some((c) => c.filteredByUserId === null)).toBe(true)
  })

  it('post-migration: two users only see their own rows', async () => {
    tableResponses.set('cycle_entries', {
      rows: [
        { date: '2026-04-20', menstruation: true, lh_test_result: null, user_id: LANAE },
        { date: '2026-04-22', menstruation: true, lh_test_result: null, user_id: NEW_USER },
      ],
    })
    tableResponses.set('nc_imported', { rows: [] })
    tableResponses.set('oura_daily', { rows: [] })

    const { loadCycleContext } = await import('@/lib/cycle/load-cycle-context')
    const lanaeCtx = await loadCycleContext(TODAY, LANAE)
    expect(lanaeCtx.current.lastPeriodStart).toBe('2026-04-20')

    // Reset call log between users (cache is intentionally NOT reset:
    // we want to confirm the cache-hit path also stays scoped).
    calls = []
    const newUserCtx = await loadCycleContext(TODAY, NEW_USER)
    expect(newUserCtx.current.lastPeriodStart).toBe('2026-04-22')

    // Every cycle_entries call from the NEW user must have been filtered
    // by their id, never Lanae's.
    const cycleCalls = calls.filter((c) => c.table === 'cycle_entries')
    expect(cycleCalls.length).toBeGreaterThan(0)
    expect(cycleCalls.every((c) => c.filteredByUserId === NEW_USER)).toBe(true)
  })

  it('post-migration: brand-new user with no rows sees EMPTY data, not Lanaes leak', async () => {
    tableResponses.set('cycle_entries', {
      rows: [
        { date: '2026-04-20', menstruation: true, lh_test_result: null, user_id: LANAE },
      ],
    })
    tableResponses.set('nc_imported', { rows: [] })
    tableResponses.set('oura_daily', { rows: [] })

    const { loadCycleContext } = await import('@/lib/cycle/load-cycle-context')
    const newUserCtx = await loadCycleContext(TODAY, NEW_USER)

    expect(newUserCtx.current.lastPeriodStart).toBeNull()
    expect(newUserCtx.current.day).toBeNull()
    expect(newUserCtx.bbtReadings).toEqual([])
  })

  it('logs the pre-migration warning at most once per table', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    tableResponses.set('cycle_entries', { rows: [], missingColumn: true })
    tableResponses.set('nc_imported', { rows: [], missingColumn: true })
    tableResponses.set('oura_daily', { rows: [], missingColumn: true })

    const { loadCycleContext } = await import('@/lib/cycle/load-cycle-context')
    await loadCycleContext(TODAY, LANAE)
    await loadCycleContext(TODAY, LANAE)

    // Three tables × 1 warn each, NOT 6.
    const warnTexts = warn.mock.calls.map((c) => String(c[0]))
    const cycleEntriesWarns = warnTexts.filter((t) => t.includes('cycle_entries'))
    expect(cycleEntriesWarns.length).toBe(1)
  })
})
