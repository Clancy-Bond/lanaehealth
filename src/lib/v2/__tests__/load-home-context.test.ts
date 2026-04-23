import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * load-home-context.ts is a fan-out loader that hits the database for
 * 7 different things and isolates each query's failure with a private
 * `safe()` helper. The two safety properties we care about most:
 *
 *   1. Date arithmetic for the 7-day window is correct across leap years
 *      and month boundaries (a wrong window silently corrupts every tile).
 *   2. A single rejecting query does not take the whole loader down: the
 *      home page must always render even if one table is unhappy.
 *
 * Both helpers are file-private, so we exercise them through the public
 * `loadHomeContext` surface with mocked Supabase + module deps. Mocks are
 * declared via vi.mock factories before the dynamic import to keep
 * hoisting safe.
 */

// Capture the most recent set of fake builders the loader saw, so each
// test can assert on what got called and inject success/failure shapes.
type Builder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: (resolve: (value: { data: unknown; count?: number }) => unknown) => Promise<unknown>
}

let lastFromCalls: string[] = []
let dailyLogsResult: { data: unknown } = { data: null }
let correlationsResult: { data: unknown } = { data: null }
let appointmentsResult: { data: unknown } = { data: null }
let symptomsResult: { count: number | null } = { count: 0 }

function makeBuilder(table: string): Builder {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then(resolve: (value: { data: unknown; count?: number }) => unknown) {
      let payload: { data: unknown; count?: number }
      if (table === 'daily_logs') payload = dailyLogsResult
      else if (table === 'correlation_results') payload = correlationsResult
      else if (table === 'appointments') payload = appointmentsResult
      else if (table === 'symptoms') payload = { data: null, count: symptomsResult.count ?? undefined }
      else payload = { data: null }
      return Promise.resolve(resolve(payload))
    },
  } as Builder
  return builder
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      lastFromCalls.push(table)
      return makeBuilder(table)
    },
  }),
}))

// Each downstream loader is mocked so the test focuses on the orchestration
// in load-home-context: window math + parallel-safe error isolation.
const cycleMock = vi.fn()
vi.mock('@/lib/cycle/load-cycle-context', () => ({
  loadCycleContext: (today: string) => cycleMock(today),
}))

const ouraMock = vi.fn()
vi.mock('@/lib/api/oura', () => ({
  getOuraData: (start: string, end: string) => ouraMock(start, end),
}))

const caloriesMock = vi.fn()
vi.mock('@/lib/calories/home-data', () => ({
  getDayTotals: (date: string) => caloriesMock(date),
}))

describe('loadHomeContext', () => {
  beforeEach(() => {
    lastFromCalls = []
    dailyLogsResult = { data: null }
    correlationsResult = { data: null }
    appointmentsResult = { data: null }
    symptomsResult = { count: 0 }
    cycleMock.mockReset().mockResolvedValue(null)
    ouraMock.mockReset().mockResolvedValue([])
    caloriesMock.mockReset().mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('seven-day window math', () => {
    it('subtracts exactly 7 days for an ordinary mid-month date', async () => {
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      await loadHomeContext('2026-04-21')
      expect(ouraMock).toHaveBeenCalledWith('2026-04-14', '2026-04-21')
    })

    it('crosses a month boundary correctly', async () => {
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      await loadHomeContext('2026-05-03')
      expect(ouraMock).toHaveBeenCalledWith('2026-04-26', '2026-05-03')
    })

    it('handles a leap-year February 29 reference date', async () => {
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      await loadHomeContext('2024-02-29')
      expect(ouraMock).toHaveBeenCalledWith('2024-02-22', '2024-02-29')
    })

    it('crosses a year boundary correctly', async () => {
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      await loadHomeContext('2026-01-03')
      expect(ouraMock).toHaveBeenCalledWith('2025-12-27', '2026-01-03')
    })
  })

  describe('error isolation via safe()', () => {
    it('returns null for the cycle slice when loadCycleContext rejects', async () => {
      cycleMock.mockRejectedValueOnce(new Error('boom'))
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      const ctx = await loadHomeContext('2026-04-21')
      expect(ctx.cycle).toBeNull()
    })

    it('returns the empty Oura array when getOuraData rejects', async () => {
      ouraMock.mockRejectedValueOnce(new Error('oura down'))
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      const ctx = await loadHomeContext('2026-04-21')
      expect(ctx.ouraTrend).toEqual([])
    })

    it('returns null for calories when getDayTotals rejects', async () => {
      caloriesMock.mockRejectedValueOnce(new Error('food parser blew up'))
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      const ctx = await loadHomeContext('2026-04-21')
      expect(ctx.calories).toBeNull()
    })

    it('returns the full HomeContext shape with safe defaults when EVERY loader fails', async () => {
      cycleMock.mockRejectedValue(new Error('x'))
      ouraMock.mockRejectedValue(new Error('x'))
      caloriesMock.mockRejectedValue(new Error('x'))
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      const ctx = await loadHomeContext('2026-04-21')
      expect(Object.keys(ctx).sort()).toEqual([
        'calories',
        'cycle',
        'dailyLog',
        'nextAppointment',
        'ouraTrend',
        'symptomsToday',
        'today',
        'topCorrelation',
      ])
      expect(ctx.today).toBe('2026-04-21')
      expect(ctx.dailyLog).toBeNull()
      expect(ctx.cycle).toBeNull()
      expect(ctx.ouraTrend).toEqual([])
      expect(ctx.calories).toBeNull()
      expect(ctx.topCorrelation).toBeNull()
      expect(ctx.nextAppointment).toBeNull()
      expect(ctx.symptomsToday).toBe(0)
    })
  })

  describe('happy-path shape', () => {
    it('returns the full HomeContext shape when nothing fails', async () => {
      const { loadHomeContext } = await import('@/lib/v2/load-home-context')
      const ctx = await loadHomeContext('2026-04-21')
      expect(ctx.today).toBe('2026-04-21')
      // Confirm we hit the 4 tables we expect plus the 3 mocked loaders.
      expect(lastFromCalls.sort()).toEqual([
        'appointments',
        'correlation_results',
        'daily_logs',
        'symptoms',
      ])
      expect(cycleMock).toHaveBeenCalledWith('2026-04-21')
      expect(caloriesMock).toHaveBeenCalledWith('2026-04-21')
    })
  })
})
