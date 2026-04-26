/**
 * Tests for /api/context/sync-status
 *
 * Regression guard for the 1000-row cap bug
 * (docs/qa/2026-04-16-sync-status-type-count-capped.md):
 *   Before: `sb.from('health_embeddings').select('content_type')` truncated
 *           at Supabase's implicit 1000-row limit, so byType hid non-daily_log
 *           types and reported `{ daily_log: 1000 }` for 1,196-row tables.
 *   After:  per-content_type HEAD queries using count: 'exact' return true
 *           COUNT(*) totals with no row payload and no cap.
 *
 * These tests assert:
 *   1. Each known content_type gets its own .eq('content_type', t) HEAD query
 *   2. No unbounded `.select('content_type')` call is issued
 *   3. byType reflects the per-type counts returned by the mock
 *   4. totalRecords is emitted independently from the sum of byType
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

const TEST_TOKEN = 'sync-status-test-token-long-enough'

function authedReq(): Request {
  return new Request('http://x/api/context/sync-status', {
    headers: { authorization: `Bearer ${TEST_TOKEN}` },
  })
}

// Track every .from().select() interaction the route performs so we can
// distinguish count-only HEAD queries (head: true) from unbounded selects.
interface SelectCall {
  columns: string
  options?: { count?: string; head?: boolean }
  // We now record an array of (col, value) eq filters because every read is
  // user_id-scoped AND may carry content_type, so a single eqField is not
  // enough.
  eqs: Array<[string, unknown]>
  orderField?: string
  limit?: number
  awaited: boolean
}
const selectCalls: SelectCall[] = []

function makeQuery(call: SelectCall) {
  // Minimal chainable stub. Each terminal returns a fixed shape based on
  // what the route asks for:
  //   - head + count                 -> { count, data: null, error: null }
  //   - .order().limit(1)            -> { data: [{...}], error: null }
  const findEq = (col: string) => call.eqs.find((e) => e[0] === col)?.[1] as string | undefined
  const resolve = () => {
    call.awaited = true
    // HEAD count queries (with or without .eq)
    if (call.options?.head && call.options.count === 'exact') {
      const ctValue = findEq('content_type')
      if (ctValue) {
        // Deterministic per-type counts.
        const map: Record<string, number> = {
          daily_log: 1181,
          lab_result: 11,
          imaging: 4,
        }
        return Promise.resolve({ count: map[ctValue] ?? 0, data: null, error: null })
      }
      // Total count (only user_id filter, no content_type)
      return Promise.resolve({ count: 1196, data: null, error: null })
    }
    // .order().limit() queries
    if (call.orderField === 'content_date') {
      const row = call.columns.includes('content_date')
        ? [{ content_date: '2022-09-02' }]
        : [{}]
      return Promise.resolve({ data: row, error: null })
    }
    if (call.orderField === 'updated_at') {
      return Promise.resolve({ data: [{ updated_at: '2026-04-17T00:00:00Z' }], error: null })
    }
    return Promise.resolve({ data: [], error: null })
  }

  const chain = {
    eq(field: string, value: string) {
      call.eqs.push([field, value])
      return Object.assign(Promise.resolve().then(async () => resolve()), chain)
    },
    order(field: string) {
      call.orderField = field
      return chain
    },
    limit(n: number) {
      call.limit = n
      return Object.assign(Promise.resolve().then(async () => resolve()), chain)
    },
    not() {
      return chain
    },
    // Allow awaiting the select directly (e.g. total HEAD query)
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return resolve().then(onFulfilled, onRejected)
    },
  }
  return chain
}

vi.mock('@/lib/supabase', () => {
  return {
    createServiceClient: () => ({
      from: () => ({
        select: (columns: string, options?: { count?: string; head?: boolean }) => {
          const call: SelectCall = { columns, options, eqs: [], awaited: false }
          selectCalls.push(call)
          return makeQuery(call)
        },
      }),
    }),
    supabase: {},
  }
})

// Mock auth so resolveUserId picks up the OWNER_USER_ID env fallback.
vi.mock('@/lib/auth/get-user', () => ({
  getCurrentUser: async () => null,
}))

import { GET } from '../sync-status/route'

describe('GET /api/context/sync-status', () => {
  const previousToken = process.env.APP_AUTH_TOKEN

  beforeAll(() => {
    process.env.APP_AUTH_TOKEN = TEST_TOKEN
  })

  afterAll(() => {
    if (previousToken === undefined) delete process.env.APP_AUTH_TOKEN
    else process.env.APP_AUTH_TOKEN = previousToken
  })

  beforeEach(() => {
    selectCalls.length = 0
    process.env.OWNER_USER_ID = '11111111-1111-1111-1111-111111111111'
  })

  it('issues one count-only HEAD query per known content_type (no unbounded content_type select)', async () => {
    const res = await GET(authedReq())
    const body = await res.json()

    // Regression guard: the pre-fix route issued
    //   sb.from('health_embeddings').select('content_type')
    // with no count, no head, and no .eq -- which Supabase truncates at 1000
    // rows. That shape must never appear again.
    const unboundedContentType = selectCalls.find(
      (c) => c.columns === 'content_type' && !c.options?.head,
    )
    expect(unboundedContentType).toBeUndefined()

    // Positive assertion: each known type got its own HEAD count query
    // scoped by content_type. (After PR #87 the query also carries an
    // eq('user_id', ...) so we look for content_type among the eq filters
    // rather than as a single field.)
    const knownTypes = ['daily_log', 'lab_result', 'imaging']
    for (const t of knownTypes) {
      const hit = selectCalls.find(
        (c) =>
          c.options?.head === true &&
          c.options.count === 'exact' &&
          c.eqs.some(([col, val]) => col === 'content_type' && val === t),
      )
      expect(hit, `expected HEAD count query for content_type=${t}`).toBeDefined()
    }

    // byType should surface the per-type numbers from our mock, not the
    // capped 1000.
    expect(body.byType).toEqual({
      daily_log: 1181,
      lab_result: 11,
      imaging: 4,
    })
  })

  it('emits totalRecords independently of byType so untyped rows are still counted', async () => {
    const res = await GET(authedReq())
    const body = await res.json()

    // Mock total is 1196, sum of per-type is 1196 in this fixture, but the
    // contract is that totalRecords comes from its own HEAD count query so
    // untyped rows (if they ever appeared) would not be silently dropped.
    // Total HEAD query: head + count exact + only user_id filter (no
    // content_type narrowing). After PR #87 every query carries user_id
    // so we identify the "total" query by the absence of content_type.
    const totalHeadQueries = selectCalls.filter(
      (c) =>
        c.options?.head === true &&
        c.options.count === 'exact' &&
        !c.eqs.some(([col]) => col === 'content_type'),
    )
    expect(totalHeadQueries.length).toBeGreaterThanOrEqual(1)

    expect(body.totalRecords).toBe(1196)
  })

  it('returns the full payload shape with dateRange and sync metadata', async () => {
    const res = await GET(authedReq())
    const body = await res.json()

    expect(body).toHaveProperty('totalRecords')
    expect(body).toHaveProperty('dateRange')
    expect(body.dateRange).toHaveProperty('earliest')
    expect(body.dateRange).toHaveProperty('latest')
    expect(body).toHaveProperty('byType')
    expect(body).toHaveProperty('syncRunning')
    expect(body).toHaveProperty('lastSyncAt')
  })
})
