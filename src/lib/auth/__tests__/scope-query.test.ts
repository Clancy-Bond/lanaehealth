/**
 * Tests for runScopedQuery: the helper that lets PHI loaders gracefully
 * degrade between the pre-migration (single-user, no user_id column) and
 * post-migration (multi-user, scoped) states.
 *
 * Coverage:
 *   - No userId → unfiltered call only
 *   - userId + column present → filtered call only, returns scoped data
 *   - userId + missing-column error → falls back to unfiltered, caches the
 *     decision so subsequent calls skip the filtered attempt
 *   - userId + non-schema error → bubbles up unchanged (no silent widening)
 *   - Multiple message shapes / error codes recognized as missing-column
 *
 * Companion to docs/research/multi-user-isolation-verified-2026-04-26.md
 * and the loader-level isolation tests under
 * src/lib/cycle/__tests__/load-cycle-context-multi-user.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetUserIdColumnCache,
  __setUserIdColumnPresent,
  isMissingColumnError,
  isUserIdColumnPresent,
  runScopedQuery,
  type ScopedQueryResult,
} from '@/lib/auth/scope-query'

interface Row {
  id: string
}

function ok(rows: Row[]): ScopedQueryResult<Row[]> {
  return { data: rows, error: null }
}

function missingColumn(message = 'column "user_id" does not exist'): ScopedQueryResult<Row[]> {
  return { data: null as unknown as Row[], error: { message, code: '42703' } }
}

function otherError(message = 'rls denied'): ScopedQueryResult<Row[]> {
  return { data: null as unknown as Row[], error: { message, code: 'PGRST301' } }
}

describe('isMissingColumnError', () => {
  it('detects PostgreSQL 42703 by code', () => {
    expect(isMissingColumnError({ code: '42703' })).toBe(true)
  })
  it('detects PostgREST PGRST204 by code', () => {
    expect(isMissingColumnError({ code: 'PGRST204' })).toBe(true)
  })
  it('detects "column ... does not exist" message variants', () => {
    expect(isMissingColumnError({ message: 'column "user_id" does not exist' })).toBe(true)
    expect(isMissingColumnError({ message: 'column user_id does not exist' })).toBe(true)
    expect(isMissingColumnError({ message: 'Could not find column user_id' })).toBe(true)
  })
  it('rejects unrelated errors', () => {
    expect(isMissingColumnError({ message: 'connection refused' })).toBe(false)
    expect(isMissingColumnError({ code: 'PGRST301', message: 'rls denied' })).toBe(false)
    expect(isMissingColumnError(null)).toBe(false)
    expect(isMissingColumnError(undefined)).toBe(false)
  })
})

describe('runScopedQuery', () => {
  beforeEach(() => {
    __resetUserIdColumnCache()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips the filtered branch entirely when no userId is supplied (legacy / cron path)', async () => {
    const withFilter = vi.fn().mockResolvedValue(ok([{ id: 'a' }]))
    const withoutFilter = vi.fn().mockResolvedValue(ok([{ id: 'a' }, { id: 'b' }]))

    const out = await runScopedQuery({
      table: 'cycle_entries',
      userId: null,
      withFilter,
      withoutFilter,
    })

    expect(withFilter).not.toHaveBeenCalled()
    expect(withoutFilter).toHaveBeenCalledOnce()
    expect(out.data).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('calls only the filtered branch when userId is supplied and the column exists', async () => {
    const withFilter = vi.fn().mockResolvedValue(ok([{ id: 'mine' }]))
    const withoutFilter = vi.fn().mockResolvedValue(ok([{ id: 'mine' }, { id: 'theirs' }]))

    const out = await runScopedQuery({
      table: 'cycle_entries',
      userId: 'user-a',
      withFilter,
      withoutFilter,
    })

    expect(withFilter).toHaveBeenCalledOnce()
    expect(withoutFilter).not.toHaveBeenCalled()
    expect(out.data).toEqual([{ id: 'mine' }])
    expect(isUserIdColumnPresent('cycle_entries')).toBe(true)
  })

  it('falls back to unfiltered when the column does not exist, and caches the decision', async () => {
    const withFilter = vi
      .fn()
      .mockResolvedValueOnce(missingColumn())
      .mockResolvedValue(ok([{ id: 'never' }]))
    const withoutFilter = vi.fn().mockResolvedValue(ok([{ id: 'lanae' }]))

    const first = await runScopedQuery({
      table: 'oura_daily',
      userId: 'user-a',
      withFilter,
      withoutFilter,
    })
    expect(first.data).toEqual([{ id: 'lanae' }])
    expect(withFilter).toHaveBeenCalledTimes(1)
    expect(withoutFilter).toHaveBeenCalledTimes(1)
    expect(isUserIdColumnPresent('oura_daily')).toBe(false)

    // Second call: should NOT retry the filtered branch.
    const second = await runScopedQuery({
      table: 'oura_daily',
      userId: 'user-a',
      withFilter,
      withoutFilter,
    })
    expect(second.data).toEqual([{ id: 'lanae' }])
    expect(withFilter).toHaveBeenCalledTimes(1) // unchanged
    expect(withoutFilter).toHaveBeenCalledTimes(2)
  })

  it('warns once when the column-missing fallback fires', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const withFilter = vi.fn().mockResolvedValue(missingColumn())
    const withoutFilter = vi.fn().mockResolvedValue(ok([]))

    await runScopedQuery({
      table: 'symptoms',
      userId: 'u',
      withFilter,
      withoutFilter,
    })
    await runScopedQuery({
      table: 'symptoms',
      userId: 'u',
      withFilter,
      withoutFilter,
    })

    // First call warns; second call is short-circuited by the cache so it
    // does NOT warn again.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/symptoms/)
    expect(warn.mock.calls[0][0]).toMatch(/migration 035/)
  })

  it('bubbles up non-schema errors WITHOUT silently widening to unfiltered', async () => {
    const withFilter = vi.fn().mockResolvedValue(otherError('rls denied'))
    const withoutFilter = vi.fn().mockResolvedValue(ok([{ id: 'leaked' }]))

    const out = await runScopedQuery({
      table: 'lab_results',
      userId: 'user-a',
      withFilter,
      withoutFilter,
    })

    expect(withFilter).toHaveBeenCalledOnce()
    expect(withoutFilter).not.toHaveBeenCalled()
    expect(out.error?.message).toBe('rls denied')
    expect(out.data).toBeNull()
    // Crucially: the column-presence cache is NOT poisoned by an RLS denial.
    expect(isUserIdColumnPresent('lab_results')).toBeUndefined()
  })

  it('skips the filtered branch when the column has been seeded as missing', async () => {
    __setUserIdColumnPresent('appointments', false)
    const withFilter = vi.fn().mockResolvedValue(ok([{ id: 'no' }]))
    const withoutFilter = vi.fn().mockResolvedValue(ok([{ id: 'yes' }]))

    const out = await runScopedQuery({
      table: 'appointments',
      userId: 'user-a',
      withFilter,
      withoutFilter,
    })

    expect(withFilter).not.toHaveBeenCalled()
    expect(withoutFilter).toHaveBeenCalledOnce()
    expect(out.data).toEqual([{ id: 'yes' }])
  })

  it('uses the filtered branch when the column has been seeded as present', async () => {
    __setUserIdColumnPresent('correlation_results', true)
    const withFilter = vi.fn().mockResolvedValue(ok([{ id: 'mine' }]))
    const withoutFilter = vi.fn().mockResolvedValue(ok([{ id: 'theirs' }]))

    const out = await runScopedQuery({
      table: 'correlation_results',
      userId: 'user-a',
      withFilter,
      withoutFilter,
    })

    expect(withFilter).toHaveBeenCalledOnce()
    expect(withoutFilter).not.toHaveBeenCalled()
    expect(out.data).toEqual([{ id: 'mine' }])
  })
})
