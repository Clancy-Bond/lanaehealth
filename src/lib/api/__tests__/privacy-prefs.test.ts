/**
 * Unit tests for src/lib/api/privacy-prefs.ts (Wave 2e F10).
 *
 * We stub out the Supabase service client so these tests run without
 * any DB connection. Focus:
 *   - getPrivacyPrefs: row found, row missing, read error.
 *   - updatePrivacyPrefs: merge semantics + type validation.
 *   - Defaults preserve pre-migration behavior (all gates open).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeRow {
  patient_id: string
  allow_claude_context: boolean
  allow_correlation_analysis: boolean
  retain_history_beyond_2y: boolean
  updated_at: string
}

const state: {
  rows: Map<string, FakeRow>
  readError: string | null
  upserted: FakeRow[]
} = {
  rows: new Map(),
  readError: null,
  upserted: [],
}

function reset() {
  state.rows = new Map()
  state.readError = null
  state.upserted = []
}

vi.mock('@/lib/supabase', () => {
  const buildSelect = () => {
    let lookup: string | null = null
    const chain = {
      eq: (_col: string, value: string) => {
        lookup = value
        return chain
      },
      maybeSingle: async () => {
        if (state.readError) {
          return { data: null, error: { message: state.readError } }
        }
        if (!lookup) return { data: null, error: null }
        const row = state.rows.get(lookup) ?? null
        return { data: row, error: null }
      },
    }
    return chain
  }

  const buildUpsert = (row: FakeRow) => {
    state.upserted.push(row)
    state.rows.set(row.patient_id, row)
    const chain = {
      select: (_cols: string) => ({
        single: async () => ({ data: row, error: null }),
      }),
    }
    return chain
  }

  return {
    createServiceClient: () => ({
      from: (_t: string) => ({
        select: (_c: string) => buildSelect(),
        upsert: (row: FakeRow, _opts: { onConflict: string }) => buildUpsert(row),
      }),
    }),
    supabase: {},
  }
})

import {
  getPrivacyPrefs,
  updatePrivacyPrefs,
  DEFAULT_PREFS,
  DEFAULT_PATIENT_ID,
} from '@/lib/api/privacy-prefs'

beforeEach(() => reset())

describe('getPrivacyPrefs', () => {
  it('returns the row when present', async () => {
    state.rows.set('lanae', {
      patient_id: 'lanae',
      allow_claude_context: false,
      allow_correlation_analysis: true,
      retain_history_beyond_2y: true,
      updated_at: '2026-04-17T00:00:00Z',
    })
    const prefs = await getPrivacyPrefs()
    expect(prefs.allow_claude_context).toBe(false)
    expect(prefs.allow_correlation_analysis).toBe(true)
  })

  it('returns defaults when the row is missing (fails open)', async () => {
    const prefs = await getPrivacyPrefs()
    expect(prefs.allow_claude_context).toBe(true)
    expect(prefs.allow_correlation_analysis).toBe(true)
    expect(prefs.retain_history_beyond_2y).toBe(true)
    expect(prefs.patient_id).toBe(DEFAULT_PATIENT_ID)
  })

  it('returns defaults when the read errors (never throws)', async () => {
    state.readError = 'relation "privacy_prefs" does not exist'
    const prefs = await getPrivacyPrefs()
    expect(prefs).toMatchObject({
      allow_claude_context: DEFAULT_PREFS.allow_claude_context,
      allow_correlation_analysis: DEFAULT_PREFS.allow_correlation_analysis,
    })
  })

  it('honors a custom patient_id', async () => {
    state.rows.set('other', {
      patient_id: 'other',
      allow_claude_context: false,
      allow_correlation_analysis: false,
      retain_history_beyond_2y: false,
      updated_at: '2026-04-17T00:00:00Z',
    })
    const prefs = await getPrivacyPrefs('other')
    expect(prefs.patient_id).toBe('other')
    expect(prefs.allow_claude_context).toBe(false)
  })
})

describe('updatePrivacyPrefs', () => {
  it('merges partial updates on top of the existing row', async () => {
    state.rows.set('lanae', {
      patient_id: 'lanae',
      allow_claude_context: true,
      allow_correlation_analysis: true,
      retain_history_beyond_2y: true,
      updated_at: '2026-04-16T00:00:00Z',
    })
    const next = await updatePrivacyPrefs({ allow_claude_context: false })
    expect(next.allow_claude_context).toBe(false)
    // unchanged fields preserved
    expect(next.allow_correlation_analysis).toBe(true)
    expect(next.retain_history_beyond_2y).toBe(true)
    expect(state.upserted).toHaveLength(1)
  })

  it('seeds from defaults when no row exists yet', async () => {
    const next = await updatePrivacyPrefs({ allow_claude_context: false })
    expect(next.allow_claude_context).toBe(false)
    expect(next.allow_correlation_analysis).toBe(true) // default carried
  })

  it('rejects non-boolean values', async () => {
    await expect(
      // @ts-expect-error deliberate type violation
      updatePrivacyPrefs({ allow_claude_context: 'false' }),
    ).rejects.toThrow(/must be boolean/)
  })

  it('bumps updated_at to a new ISO timestamp', async () => {
    state.rows.set('lanae', {
      patient_id: 'lanae',
      allow_claude_context: true,
      allow_correlation_analysis: true,
      retain_history_beyond_2y: true,
      updated_at: '2020-01-01T00:00:00Z',
    })
    const before = Date.now()
    const next = await updatePrivacyPrefs({ allow_correlation_analysis: false })
    const after = Date.now()
    const ts = new Date(next.updated_at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before - 1000)
    expect(ts).toBeLessThanOrEqual(after + 1000)
  })
})

describe('DEFAULT_PREFS', () => {
  it('opens all gates (pre-migration behavior)', () => {
    expect(DEFAULT_PREFS.allow_claude_context).toBe(true)
    expect(DEFAULT_PREFS.allow_correlation_analysis).toBe(true)
    expect(DEFAULT_PREFS.retain_history_beyond_2y).toBe(true)
  })
})
