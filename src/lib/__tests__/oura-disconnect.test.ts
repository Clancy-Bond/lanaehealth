/**
 * Tests for disconnectOura() and storeTokens() delete semantics.
 *
 * Verifies the delete chain is unambiguously scoped: fetch token ids first,
 * then `.delete().in('id', ids)`. This guards against the previous
 * `.neq('id', zero-uuid)` pattern, which was a blanket delete disguised as a
 * scoped filter and violated the Zero Data Loss principle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the filter methods used against the delete chain so we can assert
// the new pattern is present and the old `.neq` is gone.
const calls = {
  selectColumns: [] as string[],
  deleteCalledOn: [] as string[],
  neqFilters: [] as Array<{ column: string; value: unknown }>,
  inFilters: [] as Array<{ column: string; values: unknown[] }>,
  insertPayloads: [] as Array<Record<string, unknown>>,
}

// Controls what the select() returns for the id lookup
const selectResult = {
  value: [] as Array<{ id: string }>,
}

vi.mock('@/lib/supabase', () => {
  const buildQuery = (tableName: string) => ({
    select: (cols: string) => {
      calls.selectColumns.push(cols)
      return Promise.resolve({ data: selectResult.value, error: null })
    },
    delete: () => {
      calls.deleteCalledOn.push(tableName)
      return {
        neq: (column: string, value: unknown) => {
          calls.neqFilters.push({ column, value })
          return Promise.resolve({ data: null, error: null })
        },
        in: (column: string, values: unknown[]) => {
          calls.inFilters.push({ column, values })
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
    insert: (payload: Record<string, unknown>) => {
      calls.insertPayloads.push(payload)
      return Promise.resolve({ data: null, error: null })
    },
  })
  return {
    createServiceClient: () => ({
      from: (tableName: string) => buildQuery(tableName),
    }),
    supabase: {},
  }
})

import { disconnectOura, storeTokens } from '@/lib/oura'

beforeEach(() => {
  calls.selectColumns = []
  calls.deleteCalledOn = []
  calls.neqFilters = []
  calls.inFilters = []
  calls.insertPayloads = []
  selectResult.value = []
})

describe('disconnectOura', () => {
  it('fetches token ids first, then deletes scoped by id (no blanket .neq)', async () => {
    selectResult.value = [{ id: 'aaaa-1111' }, { id: 'bbbb-2222' }]

    await disconnectOura()

    // Must have selected the id column from oura_tokens
    expect(calls.selectColumns).toContain('id')

    // Must have issued a .delete().in('id', [...]) against oura_tokens
    expect(calls.deleteCalledOn).toContain('oura_tokens')
    expect(calls.inFilters.length).toBe(1)
    expect(calls.inFilters[0].column).toBe('id')
    expect(calls.inFilters[0].values).toEqual(['aaaa-1111', 'bbbb-2222'])

    // The old unsafe pattern must be gone
    expect(calls.neqFilters.length).toBe(0)
    for (const f of calls.neqFilters) {
      expect(f).not.toMatchObject({ column: 'id', value: '00000000-0000-0000-0000-000000000000' })
    }
  })

  it('is a no-op when there are no token rows to delete', async () => {
    selectResult.value = []

    await disconnectOura()

    // Selected the id column, but never issued a delete (no rows to delete)
    expect(calls.selectColumns).toContain('id')
    expect(calls.deleteCalledOn.length).toBe(0)
    expect(calls.inFilters.length).toBe(0)
    expect(calls.neqFilters.length).toBe(0)
  })
})

describe('storeTokens', () => {
  it('replaces prior tokens using scoped .in(id) delete, not a blanket .neq', async () => {
    selectResult.value = [{ id: 'prior-row-1' }]

    await storeTokens({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    })

    // Scoped delete by id
    expect(calls.deleteCalledOn).toContain('oura_tokens')
    expect(calls.inFilters.length).toBe(1)
    expect(calls.inFilters[0]).toMatchObject({ column: 'id', values: ['prior-row-1'] })

    // Never the old pattern
    expect(calls.neqFilters.length).toBe(0)

    // Followed by an insert of the new token row
    expect(calls.insertPayloads.length).toBe(1)
    expect(calls.insertPayloads[0]).toMatchObject({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    })
  })

  it('skips the delete step when no prior token rows exist', async () => {
    selectResult.value = []

    await storeTokens({
      access_token: 'first-access',
      refresh_token: 'first-refresh',
      expires_in: 3600,
    })

    expect(calls.deleteCalledOn.length).toBe(0)
    expect(calls.inFilters.length).toBe(0)
    expect(calls.neqFilters.length).toBe(0)

    // Insert still runs so the first token can land
    expect(calls.insertPayloads.length).toBe(1)
  })
})
