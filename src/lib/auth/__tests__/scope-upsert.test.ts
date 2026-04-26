/**
 * Tests for upsertProfileSection: the write counterpart to runScopedQuery.
 *
 * The helper has to behave correctly across three migration states:
 *
 *   1. Post-035 + post-041: native upsert with onConflict='user_id,section'
 *   2. Post-035 + pre-041:  upsert with onConflict='section', user_id row
 *   3. Pre-035 + pre-041:   upsert with onConflict='section', no user_id
 *
 * Plus a manual SELECT-then-UPDATE/INSERT fallback when no constraint
 * survives.
 *
 * Coverage:
 *   - Happy path: every row passes through with the modern shape
 *   - Missing user_id column → drops user_id, retries with legacy shape
 *   - Missing (user_id,section) UNIQUE → retries with legacy `section` UNIQUE
 *   - Both missing simultaneously → manual upsert path
 *   - Schema state cached so the second call goes straight to the working
 *     strategy (no double round-trip)
 *   - userId omitted → never includes user_id, never tries the modern shape
 *   - Unrelated errors bubble up unchanged (no silent widening)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetSchemaCache,
  upsertProfileSection,
} from '@/lib/auth/scope-upsert'

interface FakeUpsertCall {
  row: Record<string, unknown>
  onConflict: string
}

interface ResponseShape {
  error: { code?: string; message?: string } | null
}

/**
 * Build a stub Supabase client whose `.from(table).upsert(row, {onConflict})`
 * returns successive responses from the queue. Captures every call for later
 * assertion. Also supports `.select().eq().eq().maybeSingle()` and
 * `.update().eq()` and `.insert(row)` for the manual-upsert fallback path.
 */
function makeStub(opts: {
  upsertResponses: ResponseShape[]
  // For manual upsert fallback only.
  selectResponse?: { data: { id: string } | null; error: ResponseShape['error'] }
  updateResponse?: ResponseShape
  insertResponse?: ResponseShape
}): {
  client: any
  upsertCalls: FakeUpsertCall[]
  selectCalls: number
  updateCalls: number
  insertCalls: number
} {
  const upsertCalls: FakeUpsertCall[] = []
  let selectCalls = 0
  let updateCalls = 0
  let insertCalls = 0
  let upsertIdx = 0

  const client = {
    from(_table: string) {
      return {
        upsert(row: Record<string, unknown>, options: { onConflict: string }) {
          upsertCalls.push({ row, onConflict: options.onConflict })
          const resp = opts.upsertResponses[upsertIdx] ?? { error: null }
          upsertIdx += 1
          return Promise.resolve(resp)
        },
        select(_cols: string) {
          selectCalls += 1
          const chain = {
            eq() {
              return chain
            },
            maybeSingle() {
              return Promise.resolve(opts.selectResponse ?? { data: null, error: null })
            },
          }
          return chain
        },
        update(_row: Record<string, unknown>) {
          return {
            eq() {
              updateCalls += 1
              return Promise.resolve(opts.updateResponse ?? { error: null })
            },
          }
        },
        insert(_row: unknown) {
          insertCalls += 1
          return Promise.resolve(opts.insertResponse ?? { error: null })
        },
      }
    },
  }

  return {
    client,
    upsertCalls,
    get selectCalls() {
      return selectCalls
    },
    get updateCalls() {
      return updateCalls
    },
    get insertCalls() {
      return insertCalls
    },
  } as ReturnType<typeof makeStub>
}

afterEach(() => {
  __resetSchemaCache()
  vi.restoreAllMocks()
})

describe('upsertProfileSection', () => {
  it('post-migration: writes with user_id + onConflict=user_id,section', async () => {
    const { client, upsertCalls } = makeStub({ upsertResponses: [{ error: null }] })

    const result = await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { full_name: 'Lanae' },
    })

    expect(result).toEqual({ ok: true })
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].onConflict).toBe('user_id,section')
    expect(upsertCalls[0].row).toMatchObject({
      user_id: 'u-123',
      section: 'personal',
      content: { full_name: 'Lanae' },
    })
    expect(upsertCalls[0].row.updated_at).toBeTruthy()
  })

  it('pre-035: drops user_id and retries with legacy section conflict on PGRST204', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, upsertCalls } = makeStub({
      upsertResponses: [
        {
          error: {
            code: 'PGRST204',
            message: "Could not find the 'user_id' column of 'health_profile' in the schema cache",
          },
        },
        { error: null },
      ],
    })

    const result = await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { full_name: 'Lanae' },
    })

    expect(result).toEqual({ ok: true })
    expect(upsertCalls).toHaveLength(2)
    expect(upsertCalls[1].onConflict).toBe('section')
    expect(upsertCalls[1].row.user_id).toBeUndefined()
    expect(upsertCalls[1].row).toMatchObject({
      section: 'personal',
      content: { full_name: 'Lanae' },
    })
    // Operator visibility on legacy fallback.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/legacy strategy/)
  })

  it('pre-041 only: keeps user_id but switches conflict target to section on 42P10', async () => {
    const { client, upsertCalls } = makeStub({
      upsertResponses: [
        {
          error: {
            code: '42P10',
            message: 'no unique or exclusion constraint matching the ON CONFLICT specification',
          },
        },
        { error: null },
      ],
    })

    const result = await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { age: 24 },
    })

    expect(result).toEqual({ ok: true })
    expect(upsertCalls).toHaveLength(2)
    expect(upsertCalls[1].onConflict).toBe('section')
    expect(upsertCalls[1].row.user_id).toBe('u-123')
  })

  it('caches the post-migration success so subsequent writes skip the fallback chain', async () => {
    const { client, upsertCalls } = makeStub({
      upsertResponses: [{ error: null }, { error: null }],
    })

    await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { x: 1 },
    })
    await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'medications',
      content: { y: 2 },
    })

    expect(upsertCalls).toHaveLength(2)
    expect(upsertCalls[0].onConflict).toBe('user_id,section')
    expect(upsertCalls[1].onConflict).toBe('user_id,section')
  })

  it('caches the pre-035 fallback so subsequent writes go straight to legacy', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, upsertCalls } = makeStub({
      upsertResponses: [
        // First call: modern attempt fails on missing column.
        {
          error: { code: '42703', message: 'column "user_id" does not exist' },
        },
        // First call retry: legacy succeeds.
        { error: null },
        // Second call: should go straight to legacy, no missing-column attempt.
        { error: null },
      ],
    })

    await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { a: 1 },
    })
    await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'medications',
      content: { b: 2 },
    })

    expect(upsertCalls).toHaveLength(3)
    expect(upsertCalls[2].onConflict).toBe('section')
    expect(upsertCalls[2].row.user_id).toBeUndefined()
  })

  it('falls through to manual SELECT/UPDATE when both unique constraints are gone', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client, upsertCalls } = makeStub({
      upsertResponses: [
        // Modern attempt fails: no constraint.
        {
          error: { code: '42P10', message: 'no unique or exclusion constraint matching' },
        },
        // Legacy fallback fails: also no constraint.
        {
          error: { code: '42P10', message: 'no unique or exclusion constraint matching' },
        },
      ],
      selectResponse: { data: { id: 'existing-row-id' }, error: null },
      updateResponse: { error: null },
    })

    const result = await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { x: 1 },
    })

    expect(result).toEqual({ ok: true })
    expect(upsertCalls).toHaveLength(2)
  })

  it('omits user_id entirely when no userId is provided', async () => {
    const { client, upsertCalls } = makeStub({ upsertResponses: [{ error: null }] })

    await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: null,
      section: 'personal',
      content: { x: 1 },
    })

    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].onConflict).toBe('section')
    expect(upsertCalls[0].row.user_id).toBeUndefined()
  })

  it('bubbles non-schema errors unchanged so callers can react', async () => {
    const { client, upsertCalls } = makeStub({
      upsertResponses: [{ error: { code: '23505', message: 'duplicate key' } }],
    })

    const result = await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: 'personal',
      content: { x: 1 },
    })

    expect(result).toEqual({ ok: false, error: 'duplicate key' })
    expect(upsertCalls).toHaveLength(1)
  })

  it('rejects an empty section without hitting the database', async () => {
    const { client, upsertCalls } = makeStub({ upsertResponses: [] })

    const result = await upsertProfileSection({
      sb: client,
      table: 'health_profile',
      userId: 'u-123',
      section: '',
      content: {},
    })

    expect(result).toEqual({ ok: false, error: 'section required' })
    expect(upsertCalls).toHaveLength(0)
  })
})
