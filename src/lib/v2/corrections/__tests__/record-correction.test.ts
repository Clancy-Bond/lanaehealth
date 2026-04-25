import { describe, expect, it, vi } from 'vitest'
import { recordCorrection } from '../record-correction'
import { CORRECTION_KIND } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * recordCorrection has two halves:
 *
 *   1. The durable narrative insert (must always succeed for the
 *      function to resolve).
 *   2. The convenience source-table update (best-effort; failure is
 *      surfaced via sourceUpdateError but doesn't reject).
 *
 * Mock both halves at the supabase-client level. Capture every call so
 * we can assert payload shape, allowlist enforcement, and the formatted
 * narrative the AI will see.
 */

interface CapturedInsert {
  table: string
  payload: Record<string, unknown>
}

interface CapturedUpdate {
  table: string
  payload: Record<string, unknown>
  filterCol: string
  filterVal: string
}

function buildSupabaseMock(opts: {
  insertResult?: { data: { id: string; created_at: string } | null; error: { message: string } | null }
  updateError?: { message: string } | null
} = {}) {
  const inserts: CapturedInsert[] = []
  const updates: CapturedUpdate[] = []

  const insertResult = opts.insertResult ?? {
    data: { id: 'narrative-row-1', created_at: '2026-04-24T12:00:00Z' },
    error: null,
  }

  const sb = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload })
          return {
            select() {
              return {
                async single() {
                  return insertResult
                },
              }
            },
          }
        },
        update(payload: Record<string, unknown>) {
          return {
            async eq(filterCol: string, filterVal: string) {
              updates.push({ table, payload, filterCol, filterVal })
              return { error: opts.updateError ?? null }
            },
          }
        },
      }
    },
  } as unknown as SupabaseClient

  return { sb, inserts, updates }
}

describe('recordCorrection', () => {
  const baseInput = {
    userId: 'user-uuid-1',
    tableName: 'cycle_entries' as const,
    rowId: 'row-uuid-1',
    fieldName: 'menstruation',
    originalValue: false,
    correctedValue: true,
    reason: 'I bled on the 21st but forgot to log it',
    source: 'v2_cycle' as const,
  }

  it('writes a kind=user_correction row to medical_narrative with structured metadata', async () => {
    const { sb, inserts } = buildSupabaseMock()
    const result = await recordCorrection(baseInput, sb)

    expect(result.id).toBe('narrative-row-1')
    expect(result.createdAt).toBe('2026-04-24T12:00:00Z')
    expect(result.sourceUpdateError).toBeNull()

    expect(inserts).toHaveLength(1)
    const insert = inserts[0]
    expect(insert.table).toBe('medical_narrative')
    expect(insert.payload.kind).toBe(CORRECTION_KIND)
    expect(insert.payload.user_id).toBe('user-uuid-1')

    const meta = insert.payload.metadata as Record<string, unknown>
    expect(meta).toMatchObject({
      tableName: 'cycle_entries',
      rowId: 'row-uuid-1',
      fieldName: 'menstruation',
      originalValue: false,
      correctedValue: true,
      reason: 'I bled on the 21st but forgot to log it',
      source: 'v2_cycle',
    })
  })

  it('writes a human-readable narrative the AI can quote back later', async () => {
    const { sb, inserts } = buildSupabaseMock()
    await recordCorrection(baseInput, sb)
    const content = inserts[0].payload.content as string
    expect(content).toContain('User correction (v2_cycle)')
    expect(content).toContain('menstruation on cycle_entries')
    expect(content).toContain('Reason: I bled on the 21st but forgot to log it')
    // Original value (false) and corrected value (true) both quoted.
    expect(content).toContain('false')
    expect(content).toContain('true')
  })

  it('also patches the source row so the next page render shows the corrected value', async () => {
    const { sb, updates } = buildSupabaseMock()
    await recordCorrection(baseInput, sb)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      table: 'cycle_entries',
      payload: { menstruation: true },
      filterCol: 'id',
      filterVal: 'row-uuid-1',
    })
  })

  it('still resolves with a sourceUpdateError when the source patch fails', async () => {
    const { sb } = buildSupabaseMock({ updateError: { message: 'permission denied' } })
    const result = await recordCorrection(baseInput, sb)
    expect(result.id).toBe('narrative-row-1')
    expect(result.sourceUpdateError).toBe('permission denied')
  })

  it('rejects an unknown table name (allowlist enforcement)', async () => {
    const { sb } = buildSupabaseMock()
    await expect(
      recordCorrection(
        // Cast to bypass the static check; we are testing the runtime
        // gate that the API route relies on for safety.
        { ...baseInput, tableName: 'auth.users' as unknown as 'cycle_entries' },
        sb,
      ),
    ).rejects.toThrow(/correctable allowlist/)
  })

  it('rejects an empty reason - the AI needs context to quote back', async () => {
    const { sb } = buildSupabaseMock()
    await expect(
      recordCorrection({ ...baseInput, reason: '   ' }, sb),
    ).rejects.toThrow(/reason is required/)
  })

  it('rejects missing userId, rowId, and fieldName', async () => {
    const { sb } = buildSupabaseMock()
    await expect(
      recordCorrection({ ...baseInput, userId: '' }, sb),
    ).rejects.toThrow(/userId/)
    await expect(
      recordCorrection({ ...baseInput, rowId: '' }, sb),
    ).rejects.toThrow(/rowId/)
    await expect(
      recordCorrection({ ...baseInput, fieldName: '' }, sb),
    ).rejects.toThrow(/fieldName/)
  })

  it('preserves original_value (zero data loss) even when corrected value is null', async () => {
    const { sb, inserts } = buildSupabaseMock()
    await recordCorrection(
      {
        ...baseInput,
        originalValue: 7.5,
        correctedValue: null,
      },
      sb,
    )
    const meta = inserts[0].payload.metadata as Record<string, unknown>
    expect(meta.originalValue).toBe(7.5)
    expect(meta.correctedValue).toBeNull()
  })

  it('throws when the narrative insert itself fails', async () => {
    const { sb } = buildSupabaseMock({
      insertResult: { data: null, error: { message: 'unique violation' } },
    })
    await expect(recordCorrection(baseInput, sb)).rejects.toThrow(/unique violation/)
  })

  it('does not update the source table if the narrative insert fails (no orphan patch)', async () => {
    const { sb, updates } = buildSupabaseMock({
      insertResult: { data: null, error: { message: 'down' } },
    })
    await expect(recordCorrection(baseInput, sb)).rejects.toThrow()
    expect(updates).toHaveLength(0)
  })

  it('falls back to the default service client when one is not injected', async () => {
    // Verify the default-client path lazily calls createServiceClient
    // by mocking it to throw immediately so we never hit the network.
    const supaMod = await import('@/lib/supabase')
    const spy = vi
      .spyOn(supaMod, 'createServiceClient')
      .mockImplementation(() => {
        throw new Error('client-construction-blocked-in-test')
      })
    try {
      await expect(
        recordCorrection({
          userId: 'u',
          tableName: 'cycle_entries',
          rowId: 'r',
          fieldName: 'f',
          originalValue: 1,
          correctedValue: 2,
          reason: 'x',
          source: 'v2_cycle',
        }),
      ).rejects.toThrow(/client-construction-blocked-in-test/)
    } finally {
      spy.mockRestore()
    }
  })
})
