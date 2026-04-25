import { describe, expect, it } from 'vitest'
import { getCorrectionsForRow, getRecentCorrections } from '../correction-history'
import { CORRECTION_KIND } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CapturedFilter {
  col: string
  val: unknown
}

interface CapturedQuery {
  table: string
  selectCols: string
  filters: CapturedFilter[]
  orderBy: { col: string; ascending: boolean } | null
  limit: number | null
}

/**
 * Build a fake supabase client whose builder records every chained
 * filter and finally resolves with the row payload supplied by the
 * test. This lets us assert both that the right filters were applied
 * (kind = user_correction, metadata->>tableName = X, etc.) AND that
 * the result rows are decoded into typed Correction objects.
 */
function buildSupabaseMock(rows: Array<Record<string, unknown>>) {
  const calls: CapturedQuery[] = []
  let current: CapturedQuery | null = null

  const builder: Record<string, unknown> = {}
  builder.eq = (col: string, val: unknown) => {
    current!.filters.push({ col, val })
    return builder
  }
  builder.gte = (col: string, val: unknown) => {
    current!.filters.push({ col, val })
    return builder
  }
  builder.order = (col: string, opts: { ascending: boolean }) => {
    current!.orderBy = { col, ascending: opts.ascending }
    return builder
  }
  builder.limit = (n: number) => {
    current!.limit = n
    return builder
  }
  // Chained queries are awaited at the end - the `then` shape mirrors
  // postgrest-js builders, which act as thenables.
  builder.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
    Promise.resolve(resolve({ data: rows, error: null }))

  const sb = {
    from(table: string) {
      return {
        select(cols: string) {
          current = {
            table,
            selectCols: cols,
            filters: [],
            orderBy: null,
            limit: null,
          }
          calls.push(current)
          return builder
        },
      }
    },
  } as unknown as SupabaseClient

  return { sb, calls }
}

const sampleRows = [
  {
    id: 'narrative-1',
    content: 'User correction (v2_cycle): menstruation on cycle_entries was false, corrected to true. Reason: I bled.',
    metadata: {
      tableName: 'cycle_entries',
      rowId: 'cycle-row-1',
      fieldName: 'menstruation',
      originalValue: false,
      correctedValue: true,
      reason: 'I bled.',
      source: 'v2_cycle',
    },
    created_at: '2026-04-21T10:00:00Z',
  },
  {
    id: 'narrative-2',
    content: 'User correction (v2_sleep): score on oura_daily was 0, corrected to 78. Reason: Oura missed the night.',
    metadata: {
      tableName: 'oura_daily',
      rowId: 'oura-row-1',
      fieldName: 'score',
      originalValue: 0,
      correctedValue: 78,
      reason: 'Oura missed the night.',
      source: 'v2_sleep',
    },
    created_at: '2026-04-22T09:00:00Z',
  },
]

describe('getCorrectionsForRow', () => {
  it('filters by kind, tableName, and rowId', async () => {
    const { sb, calls } = buildSupabaseMock([sampleRows[0]])
    await getCorrectionsForRow(
      { tableName: 'cycle_entries', rowId: 'cycle-row-1' },
      sb,
    )
    expect(calls).toHaveLength(1)
    const call = calls[0]
    expect(call.table).toBe('medical_narrative')
    const cols = call.filters.reduce<Record<string, unknown>>((acc, f) => {
      acc[f.col] = f.val
      return acc
    }, {})
    expect(cols.kind).toBe(CORRECTION_KIND)
    expect(cols['metadata->>tableName']).toBe('cycle_entries')
    expect(cols['metadata->>rowId']).toBe('cycle-row-1')
  })

  it('orders newest first', async () => {
    const { sb, calls } = buildSupabaseMock(sampleRows)
    await getCorrectionsForRow(
      { tableName: 'cycle_entries', rowId: 'cycle-row-1' },
      sb,
    )
    expect(calls[0].orderBy).toEqual({ col: 'created_at', ascending: false })
  })

  it('decodes the rows into typed Correction objects with metadata preserved', async () => {
    const { sb } = buildSupabaseMock([sampleRows[0]])
    const result = await getCorrectionsForRow(
      { tableName: 'cycle_entries', rowId: 'cycle-row-1' },
      sb,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('narrative-1')
    expect(result[0].createdAt).toBe('2026-04-21T10:00:00Z')
    expect(result[0].metadata.tableName).toBe('cycle_entries')
    expect(result[0].metadata.fieldName).toBe('menstruation')
    expect(result[0].metadata.correctedValue).toBe(true)
  })

  it('skips rows with missing metadata (defensive: legacy narrative rows might collide)', async () => {
    const { sb } = buildSupabaseMock([
      { id: 'legacy', content: 'old free-form note', metadata: null, created_at: '2026-01-01T00:00:00Z' },
      sampleRows[0],
    ])
    const result = await getCorrectionsForRow(
      { tableName: 'cycle_entries', rowId: 'cycle-row-1' },
      sb,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('narrative-1')
  })

  it('adds a user_id filter when userId is supplied', async () => {
    const { sb, calls } = buildSupabaseMock([])
    await getCorrectionsForRow(
      { tableName: 'cycle_entries', rowId: 'cycle-row-1', userId: 'user-uuid-9' },
      sb,
    )
    const userFilter = calls[0].filters.find((f) => f.col === 'user_id')
    expect(userFilter?.val).toBe('user-uuid-9')
  })
})

describe('getRecentCorrections', () => {
  it('orders newest first and applies the default limit of 30', async () => {
    const { sb, calls } = buildSupabaseMock(sampleRows)
    await getRecentCorrections({}, sb)
    expect(calls[0].orderBy).toEqual({ col: 'created_at', ascending: false })
    expect(calls[0].limit).toBe(30)
  })

  it('honors a custom limit', async () => {
    const { sb, calls } = buildSupabaseMock(sampleRows)
    await getRecentCorrections({ limit: 5 }, sb)
    expect(calls[0].limit).toBe(5)
  })

  it('applies the sinceISO filter when supplied', async () => {
    const { sb, calls } = buildSupabaseMock(sampleRows)
    await getRecentCorrections({ sinceISO: '2026-01-01T00:00:00Z' }, sb)
    const since = calls[0].filters.find((f) => f.col === 'created_at')
    expect(since?.val).toBe('2026-01-01T00:00:00Z')
  })

  it('returns rows decoded as Correction[] with metadata roundtrip', async () => {
    const { sb } = buildSupabaseMock(sampleRows)
    const out = await getRecentCorrections({}, sb)
    expect(out).toHaveLength(2)
    expect(out[0].metadata.tableName).toBe('cycle_entries')
    expect(out[1].metadata.fieldName).toBe('score')
    expect(out[1].metadata.correctedValue).toBe(78)
  })

  it('filters by kind = user_correction (does not leak free-form narrative)', async () => {
    const { sb, calls } = buildSupabaseMock(sampleRows)
    await getRecentCorrections({}, sb)
    const kindFilter = calls[0].filters.find((f) => f.col === 'kind')
    expect(kindFilter?.val).toBe(CORRECTION_KIND)
  })

  it('honors the userId filter', async () => {
    const { sb, calls } = buildSupabaseMock([])
    await getRecentCorrections({ userId: 'user-uuid-9' }, sb)
    const u = calls[0].filters.find((f) => f.col === 'user_id')
    expect(u?.val).toBe('user-uuid-9')
  })
})
