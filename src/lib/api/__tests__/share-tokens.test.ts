/**
 * Unit tests for src/lib/api/share-tokens.ts (Wave 2d D6).
 *
 * We stub out the Supabase service client so these tests can run without
 * any DB connection. The focus is on:
 *   - Token generation (entropy length, base64url alphabet).
 *   - Expiry math.
 *   - verifyShareToken branching: not_found, expired, revoked, consumed,
 *     one_time -> used_at update.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- Fake Supabase plumbing ----------

interface FakeRow {
  token: string
  resource_type: string
  resource_id: string | null
  issued_at: string
  expires_at: string
  revoked_at: string | null
  one_time: boolean
  used_at: string | null
}

const state: {
  rowsByToken: Map<string, FakeRow>
  inserted: FakeRow[]
  updates: Array<{ token: string; patch: Partial<FakeRow> }>
} = {
  rowsByToken: new Map(),
  inserted: [],
  updates: [],
}

function resetState() {
  state.rowsByToken = new Map()
  state.inserted = []
  state.updates = []
}

vi.mock('@/lib/supabase', () => {
  const buildSelect = () => {
    let lookupToken: string | null = null
    const chain = {
      eq: (_col: string, value: string) => {
        lookupToken = value
        return chain
      },
      maybeSingle: async () => {
        if (!lookupToken) return { data: null, error: null }
        const row = state.rowsByToken.get(lookupToken) ?? null
        return { data: row, error: null }
      },
    }
    return chain
  }

  const buildUpdate = (patch: Partial<FakeRow>) => {
    const chain = {
      eq: (_col: string, value: string) => {
        state.updates.push({ token: value, patch })
        const existing = state.rowsByToken.get(value)
        if (existing) {
          state.rowsByToken.set(value, { ...existing, ...patch })
        }
        return Promise.resolve({ error: null })
      },
    }
    return chain
  }

  return {
    createServiceClient: () => ({
      from: (_table: string) => ({
        select: (_cols: string) => buildSelect(),
        insert: async (row: FakeRow) => {
          state.inserted.push(row)
          state.rowsByToken.set(row.token, row)
          return { error: null }
        },
        update: (patch: Partial<FakeRow>) => buildUpdate(patch),
      }),
    }),
    supabase: {},
  }
})

import {
  createShareToken,
  verifyShareToken,
  revokeShareToken,
  generateTokenString,
} from '@/lib/api/share-tokens'

beforeEach(() => {
  resetState()
})

// ---------- generateTokenString ----------

describe('generateTokenString', () => {
  it('produces a base64url string', () => {
    const t = generateTokenString()
    // base64url alphabet: A-Z a-z 0-9 - _ (no padding)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('has >= 32 bytes of entropy (>= 43 chars base64url)', () => {
    const t = generateTokenString()
    expect(t.length).toBeGreaterThanOrEqual(43)
  })

  it('rejects byte lengths below 32', () => {
    expect(() => generateTokenString(16)).toThrow(/at least 32/i)
  })

  it('produces different tokens on successive calls', () => {
    const a = generateTokenString()
    const b = generateTokenString()
    expect(a).not.toEqual(b)
  })
})

// ---------- createShareToken ----------

describe('createShareToken', () => {
  it('inserts a row and returns token + expiresAt', async () => {
    const before = Date.now()
    const result = await createShareToken({ resourceType: 'care_card' })
    const after = Date.now()

    expect(state.inserted).toHaveLength(1)
    expect(state.inserted[0].token).toEqual(result.token)
    expect(state.inserted[0].resource_type).toEqual('care_card')
    expect(state.inserted[0].one_time).toBe(false)

    // 7-day expiry window sanity check.
    const expMs = new Date(result.expiresAt).getTime()
    const lower = before + 7 * 24 * 60 * 60 * 1000 - 1000
    const upper = after + 7 * 24 * 60 * 60 * 1000 + 1000
    expect(expMs).toBeGreaterThanOrEqual(lower)
    expect(expMs).toBeLessThanOrEqual(upper)
  })

  it('honors custom expiresInDays', async () => {
    const result = await createShareToken({
      resourceType: 'care_card',
      expiresInDays: 1,
    })
    const diff = new Date(result.expiresAt).getTime() - Date.now()
    // Should be roughly 1 day (give or take test runtime).
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000)
  })

  it('rejects invalid expiresInDays', async () => {
    await expect(
      createShareToken({ resourceType: 'care_card', expiresInDays: 0 }),
    ).rejects.toThrow()
    await expect(
      createShareToken({ resourceType: 'care_card', expiresInDays: 400 }),
    ).rejects.toThrow()
  })

  it('does not embed any input data inside the token string', async () => {
    const result = await createShareToken({
      resourceType: 'care_card',
      resourceId: 'lanae-super-secret-id',
    })
    expect(result.token).not.toContain('lanae')
    expect(result.token).not.toContain('care_card')
    expect(result.token).not.toContain('super')
  })
})

// ---------- verifyShareToken ----------

describe('verifyShareToken', () => {
  function insertRow(overrides: Partial<FakeRow> = {}) {
    const now = new Date()
    const exp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const row: FakeRow = {
      token: 'tok-abc',
      resource_type: 'care_card',
      resource_id: null,
      issued_at: now.toISOString(),
      expires_at: exp.toISOString(),
      revoked_at: null,
      one_time: false,
      used_at: null,
      ...overrides,
    }
    state.rowsByToken.set(row.token, row)
    return row
  }

  it('returns not_found for empty token', async () => {
    const r = await verifyShareToken('')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('returns not_found for unknown token', async () => {
    const r = await verifyShareToken('no-such-token')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('returns ok for a fresh, unrevoked token', async () => {
    insertRow()
    const r = await verifyShareToken('tok-abc')
    expect(r.ok).toBe(true)
  })

  it('returns expired for a past expires_at', async () => {
    insertRow({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    })
    const r = await verifyShareToken('tok-abc')
    expect(r).toEqual({ ok: false, reason: 'expired' })
  })

  it('returns revoked when revoked_at is set', async () => {
    insertRow({ revoked_at: new Date().toISOString() })
    const r = await verifyShareToken('tok-abc')
    expect(r).toEqual({ ok: false, reason: 'revoked' })
  })

  it('returns not_found when resource type mismatches', async () => {
    insertRow({ resource_type: 'other_type' })
    const r = await verifyShareToken('tok-abc', 'care_card')
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('consumes a one_time token on first valid view', async () => {
    insertRow({ one_time: true })
    const r1 = await verifyShareToken('tok-abc', 'care_card')
    expect(r1.ok).toBe(true)
    // used_at update captured
    expect(state.updates.some((u) => u.token === 'tok-abc' && u.patch.used_at)).toBe(true)

    // Second view should now report consumed (our mock persisted the patch).
    const r2 = await verifyShareToken('tok-abc', 'care_card')
    expect(r2).toEqual({ ok: false, reason: 'consumed' })
  })
})

// ---------- revokeShareToken ----------

describe('revokeShareToken', () => {
  it('writes revoked_at = now for the token', async () => {
    state.rowsByToken.set('rev-tok', {
      token: 'rev-tok',
      resource_type: 'care_card',
      resource_id: null,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      revoked_at: null,
      one_time: false,
      used_at: null,
    })
    await revokeShareToken('rev-tok')
    const updated = state.rowsByToken.get('rev-tok')!
    expect(updated.revoked_at).not.toBeNull()
  })
})
