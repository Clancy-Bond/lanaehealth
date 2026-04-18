/**
 * Unit tests for src/lib/api/favorites.ts (Wave 2e F5).
 *
 * Focus:
 *   - coerceFavorites: drops unknown metrics, dedupes, caps at MAX_FAVORITES,
 *     tolerates the legacy double-stringified jsonb shape (parseProfileContent).
 *   - getFavorites: reads health_profile row, falls back to [] on error.
 *   - setFavorites: validates the cap, upserts the EAV row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- fake supabase plumbing -----------------------------------------------

interface FakeRow {
  section: string
  content: unknown
  updated_at?: string
}

const state: {
  rows: Map<string, FakeRow>
  upserts: FakeRow[]
  forceSelectError: boolean
  forceUpsertError: boolean
} = {
  rows: new Map(),
  upserts: [],
  forceSelectError: false,
  forceUpsertError: false,
}

function resetState() {
  state.rows = new Map()
  state.upserts = []
  state.forceSelectError = false
  state.forceUpsertError = false
}

vi.mock('@/lib/supabase', () => {
  const buildSelect = () => {
    let lookupSection: string | null = null
    const chain = {
      eq: (_col: string, value: string) => {
        lookupSection = value
        return chain
      },
      maybeSingle: async () => {
        if (state.forceSelectError) {
          return { data: null, error: { message: 'boom' } }
        }
        const row = lookupSection ? state.rows.get(lookupSection) ?? null : null
        return { data: row, error: null }
      },
    }
    return chain
  }

  return {
    createServiceClient: () => ({
      from: (_table: string) => ({
        select: (_cols: string) => buildSelect(),
        upsert: async (row: FakeRow) => {
          if (state.forceUpsertError) {
            return { error: { message: 'upsert boom' } }
          }
          state.upserts.push(row)
          state.rows.set(row.section, row)
          return { error: null }
        },
      }),
    }),
    supabase: {},
  }
})

import {
  coerceFavorites,
  getFavorites,
  setFavorites,
  MAX_FAVORITES,
  FAVORITE_METRIC_DEFINITIONS,
  HEALTH_PROFILE_SECTION,
  type FavoriteItem,
} from '@/lib/api/favorites'

beforeEach(() => {
  resetState()
})

// --- coerceFavorites ------------------------------------------------------

describe('coerceFavorites', () => {
  it('returns [] for null/undefined/non-object input', () => {
    expect(coerceFavorites(null)).toEqual([])
    expect(coerceFavorites(undefined)).toEqual([])
    expect(coerceFavorites(42)).toEqual([])
    expect(coerceFavorites('notjson')).toEqual([])
  })

  it('returns [] when content is missing items[]', () => {
    expect(coerceFavorites({})).toEqual([])
    expect(coerceFavorites({ items: 'nope' })).toEqual([])
  })

  it('keeps only known metric ids', () => {
    const raw = {
      items: [
        { metric: 'hrv' },
        { metric: 'not_a_real_metric' },
        { metric: 'standing_pulse' },
      ],
    }
    const result = coerceFavorites(raw)
    expect(result.map((r) => r.metric)).toEqual(['hrv', 'standing_pulse'])
  })

  it('dedupes repeated metric ids, preserving first occurrence', () => {
    const raw = {
      items: [
        { metric: 'hrv', displayAs: 'Heart Var' },
        { metric: 'hrv', displayAs: 'Duplicate' },
        { metric: 'rhr' },
      ],
    }
    const result = coerceFavorites(raw)
    expect(result).toEqual([
      { metric: 'hrv', displayAs: 'Heart Var' },
      { metric: 'rhr' },
    ])
  })

  it(`caps the result at MAX_FAVORITES (${6})`, () => {
    const ids = FAVORITE_METRIC_DEFINITIONS.map((m) => ({ metric: m.id }))
    const result = coerceFavorites({ items: ids })
    expect(result).toHaveLength(MAX_FAVORITES)
  })

  it('trims + truncates displayAs to 24 chars', () => {
    const raw = {
      items: [
        {
          metric: 'hrv',
          displayAs: '   ' + 'x'.repeat(40) + '   ',
        },
      ],
    }
    const result = coerceFavorites(raw)
    expect(result[0].displayAs?.length).toBe(24)
    expect(result[0].displayAs?.startsWith('x')).toBe(true)
  })

  it('ignores empty/whitespace displayAs', () => {
    const raw = { items: [{ metric: 'hrv', displayAs: '   ' }] }
    const result = coerceFavorites(raw)
    expect(result[0].displayAs).toBeUndefined()
  })

  it('handles legacy double-stringified jsonb shape', () => {
    // PUT /api/profile used to JSON.stringify the content before upserting;
    // parseProfileContent transparently undoes that. coerceFavorites must
    // work on both shapes.
    const stringified = JSON.stringify({ items: [{ metric: 'fatigue' }] })
    const result = coerceFavorites(stringified)
    expect(result).toEqual([{ metric: 'fatigue' }])
  })
})

// --- getFavorites ---------------------------------------------------------

describe('getFavorites', () => {
  it('returns [] when no row exists', async () => {
    const result = await getFavorites()
    expect(result).toEqual([])
  })

  it('returns [] when supabase errors out', async () => {
    state.forceSelectError = true
    const result = await getFavorites()
    expect(result).toEqual([])
  })

  it('parses a normal row', async () => {
    state.rows.set(HEALTH_PROFILE_SECTION, {
      section: HEALTH_PROFILE_SECTION,
      content: { items: [{ metric: 'rhr' }, { metric: 'sleep_score' }] },
    })
    const result = await getFavorites()
    expect(result).toEqual([{ metric: 'rhr' }, { metric: 'sleep_score' }])
  })

  it('parses the legacy stringified content shape', async () => {
    state.rows.set(HEALTH_PROFILE_SECTION, {
      section: HEALTH_PROFILE_SECTION,
      content: JSON.stringify({ items: [{ metric: 'readiness' }] }),
    })
    const result = await getFavorites()
    expect(result).toEqual([{ metric: 'readiness' }])
  })
})

// --- setFavorites ---------------------------------------------------------

describe('setFavorites', () => {
  it('upserts the row with section=home_favorites', async () => {
    const items: FavoriteItem[] = [{ metric: 'hrv' }, { metric: 'rhr' }]
    const result = await setFavorites(items)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toEqual(items)

    expect(state.upserts).toHaveLength(1)
    expect(state.upserts[0].section).toBe(HEALTH_PROFILE_SECTION)
    expect(state.upserts[0].content).toEqual({ items })
  })

  it('rejects when asked to pin more than the cap', async () => {
    const tooMany: FavoriteItem[] = [
      { metric: 'hrv' },
      { metric: 'rhr' },
      { metric: 'standing_pulse' },
      { metric: 'body_temp' },
      { metric: 'sleep_score' },
      { metric: 'readiness' },
      { metric: 'fatigue' },
    ]
    const result = await setFavorites(tooMany)
    expect(result.ok).toBe(false)
    expect(state.upserts).toHaveLength(0)
  })

  it('surfaces supabase errors as {ok: false}', async () => {
    state.forceUpsertError = true
    const result = await setFavorites([{ metric: 'hrv' }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/upsert boom/)
  })

  it('persists an empty list (clearing favorites)', async () => {
    const result = await setFavorites([])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toEqual([])
    expect(state.upserts[0].content).toEqual({ items: [] })
  })

  it('drops unknown metric ids in the normalized output', async () => {
    const bad = [
      { metric: 'hrv' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { metric: 'made_up' } as any,
    ]
    const result = await setFavorites(bad)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toEqual([{ metric: 'hrv' }])
  })
})
