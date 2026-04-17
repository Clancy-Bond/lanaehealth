// ---------------------------------------------------------------------------
// micro-care api helper -- tests
//
// Mocked-Supabase tests that verify:
//   1. logMicroCareCompletion inserts into micro_care_completions with the
//      correct columns (and only those columns).
//   2. Unknown slugs are rejected BEFORE the DB call.
//   3. Supabase errors surface as clean Error instances.
//   4. countRecentMicroCareCompletions returns an integer count.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface InsertCapture {
  table: string
  payload: Record<string, unknown>
}

const capture: {
  lastInsert: InsertCapture | null
  insertError: unknown
  countResult: number | null
  countError: unknown
} = {
  lastInsert: null,
  insertError: null,
  countResult: 6,
  countError: null,
}

vi.mock('@/lib/supabase', () => {
  const buildQuery = (tableName: string) => ({
    insert: (payload: Record<string, unknown>) => {
      capture.lastInsert = { table: tableName, payload }
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: capture.insertError
                ? null
                : {
                    id: 'uuid-stub',
                    patient_id: 'lanae',
                    completed_at: '2026-04-17T12:00:00Z',
                    duration_seconds: null,
                    felt_better: null,
                    notes: null,
                    ...payload,
                  },
              error: capture.insertError,
            }),
        }),
      }
    },
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      void _cols
      void opts
      return {
        gte: (_col: string, _val: string) =>
          Promise.resolve({
            data: null,
            error: capture.countError,
            count: capture.countResult,
          }),
        order: () => ({
          limit: () =>
            Promise.resolve({
              data: [],
              error: null,
            }),
        }),
      }
    },
  })
  return {
    supabase: { from: (tableName: string) => buildQuery(tableName) },
  }
})

import {
  logMicroCareCompletion,
  countRecentMicroCareCompletions,
} from '@/lib/api/micro-care'

beforeEach(() => {
  capture.lastInsert = null
  capture.insertError = null
  capture.countResult = 6
  capture.countError = null
})

describe('logMicroCareCompletion', () => {
  it('inserts a minimal row with action_slug + nullable fields', async () => {
    const row = await logMicroCareCompletion({ actionSlug: 'salt-tablet' })
    expect(capture.lastInsert).not.toBeNull()
    expect(capture.lastInsert!.table).toBe('micro_care_completions')
    const keys = Object.keys(capture.lastInsert!.payload).sort()
    expect(keys).toEqual(
      ['action_slug', 'duration_seconds', 'felt_better', 'notes'].sort()
    )
    expect(capture.lastInsert!.payload.action_slug).toBe('salt-tablet')
    expect(capture.lastInsert!.payload.duration_seconds).toBeNull()
    expect(row.id).toBe('uuid-stub')
  })

  it('passes through duration, feltBetter, notes when provided', async () => {
    await logMicroCareCompletion({
      actionSlug: 'box-breathing',
      durationSeconds: 120,
      feltBetter: true,
      notes: 'calmer',
    })
    expect(capture.lastInsert!.payload.duration_seconds).toBe(120)
    expect(capture.lastInsert!.payload.felt_better).toBe(true)
    expect(capture.lastInsert!.payload.notes).toBe('calmer')
  })

  it('rejects unknown slugs BEFORE touching the DB', async () => {
    await expect(
      logMicroCareCompletion({ actionSlug: 'fake-action' })
    ).rejects.toThrow(/Unknown micro-care action slug/)
    // Ensures no insert was attempted.
    expect(capture.lastInsert).toBeNull()
  })

  it('surfaces Supabase failures as a descriptive Error', async () => {
    capture.insertError = { message: 'permission denied' }
    await expect(
      logMicroCareCompletion({ actionSlug: 'hydrate-500' })
    ).rejects.toThrow(/Failed to log micro-care completion/)
  })
})

describe('countRecentMicroCareCompletions', () => {
  it('returns the integer count for the default 7-day window', async () => {
    const n = await countRecentMicroCareCompletions()
    expect(n).toBe(6)
  })

  it('returns 0 when Supabase returns a null count (no rows)', async () => {
    capture.countResult = null
    const n = await countRecentMicroCareCompletions()
    expect(n).toBe(0)
  })

  it('throws on Supabase error with a clear message', async () => {
    capture.countError = { message: 'db down' }
    await expect(countRecentMicroCareCompletions()).rejects.toThrow(
      /Failed to count micro-care completions/
    )
  })
})
