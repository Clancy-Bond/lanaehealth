// ---------------------------------------------------------------------------
// Unit tests for src/lib/api/prn-doses.ts (Wave 2e F7).
//
// Supabase is stubbed out so these tests run with zero DB. We exercise:
//   - resolvePollDelayMinutes default + per-med overrides
//   - computePollScheduledFor math
//   - recordPrnDose happy path, default delay, explicit delay <= 0
//   - recordPrnDose input validation (blank med, bad doseTime)
//   - recordEfficacyResponse invalid response, missing id, already-answered
//   - getPendingPolls filters + ordering
//   - markPollSent idempotency (only updates rows with poll_sent_at NULL)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Fake Supabase plumbing ------------------------------------------------

interface FakeRow {
  id: string
  patient_id: string
  medication_name: string
  dose_amount: number | null
  dose_unit: string | null
  dose_time: string
  reason: string | null
  poll_scheduled_for: string | null
  poll_sent_at: string | null
  poll_response: string | null
  poll_responded_at: string | null
}

interface State {
  rows: Map<string, FakeRow>
  insertedPayloads: Array<Record<string, unknown>>
  updates: Array<{
    id?: string
    patch: Partial<FakeRow>
    pollResponseIsNullFilter?: boolean
    pollSentAtIsNullFilter?: boolean
  }>
  updateError: { code?: string; message: string } | null
  insertError: { message: string } | null
  fetchError: { message: string } | null
  nextId: number
}

const state: State = {
  rows: new Map(),
  insertedPayloads: [],
  updates: [],
  updateError: null,
  insertError: null,
  fetchError: null,
  nextId: 1,
}

function resetState() {
  state.rows = new Map()
  state.insertedPayloads = []
  state.updates = []
  state.updateError = null
  state.insertError = null
  state.fetchError = null
  state.nextId = 1
}

function makeRow(overrides: Partial<FakeRow> = {}): FakeRow {
  const id = overrides.id ?? `row-${state.nextId++}`
  return {
    id,
    patient_id: 'lanae',
    medication_name: 'ibuprofen',
    dose_amount: null,
    dose_unit: null,
    dose_time: new Date().toISOString(),
    reason: null,
    poll_scheduled_for: null,
    poll_sent_at: null,
    poll_response: null,
    poll_responded_at: null,
    ...overrides,
  }
}

vi.mock('@/lib/supabase', () => {
  type Filter = { type: 'eq' | 'is' | 'not_is' | 'lte' | 'gte'; col: string; val: unknown }

  function buildSelectChain() {
    const filters: Filter[] = []
    let orderCol: string | null = null
    let orderAsc = true
    let limitN: number | null = null

    const applyFilters = (rows: FakeRow[]) => {
      let out = rows
      for (const f of filters) {
        if (f.type === 'eq') out = out.filter(r => (r as unknown as Record<string, unknown>)[f.col] === f.val)
        else if (f.type === 'is' && f.val === null) out = out.filter(r => (r as unknown as Record<string, unknown>)[f.col] === null)
        else if (f.type === 'not_is' && f.val === null) out = out.filter(r => (r as unknown as Record<string, unknown>)[f.col] !== null)
        else if (f.type === 'lte') out = out.filter(r => {
          const v = (r as unknown as Record<string, unknown>)[f.col]
          return typeof v === 'string' && typeof f.val === 'string' && v <= f.val
        })
        else if (f.type === 'gte') out = out.filter(r => {
          const v = (r as unknown as Record<string, unknown>)[f.col]
          return typeof v === 'string' && typeof f.val === 'string' && v >= f.val
        })
      }
      if (orderCol) {
        out = [...out].sort((a, b) => {
          const av = String((a as unknown as Record<string, unknown>)[orderCol!] ?? '')
          const bv = String((b as unknown as Record<string, unknown>)[orderCol!] ?? '')
          return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av)
        })
      }
      if (limitN !== null) out = out.slice(0, limitN)
      return out
    }

    const chain: Record<string, unknown> = {}
    chain.eq = (col: string, val: unknown) => { filters.push({ type: 'eq', col, val }); return chain }
    chain.is = (col: string, val: unknown) => { filters.push({ type: 'is', col, val }); return chain }
    chain.not = (col: string, _op: string, val: unknown) => {
      filters.push({ type: 'not_is', col, val })
      return chain
    }
    chain.lte = (col: string, val: unknown) => { filters.push({ type: 'lte', col, val }); return chain }
    chain.gte = (col: string, val: unknown) => { filters.push({ type: 'gte', col, val }); return chain }
    chain.order = (col: string, opts?: { ascending?: boolean }) => {
      orderCol = col
      orderAsc = opts?.ascending ?? true
      return chain
    }
    chain.limit = (n: number) => {
      limitN = n
      return chain
    }
    chain.maybeSingle = async () => {
      if (state.fetchError) return { data: null, error: state.fetchError }
      const rows = applyFilters(Array.from(state.rows.values()))
      return { data: rows[0] ?? null, error: null }
    }
    chain.then = (resolve: (arg: { data: FakeRow[]; error: unknown }) => unknown) => {
      if (state.fetchError) return resolve({ data: [], error: state.fetchError })
      return resolve({ data: applyFilters(Array.from(state.rows.values())), error: null })
    }
    return chain
  }

  function buildUpdateChain(patch: Partial<FakeRow>) {
    const filters: Filter[] = []
    const chain: Record<string, unknown> = {}

    const findMatch = (): FakeRow | null => {
      for (const row of state.rows.values()) {
        let ok = true
        for (const f of filters) {
          if (f.type === 'eq') {
            if ((row as unknown as Record<string, unknown>)[f.col] !== f.val) { ok = false; break }
          } else if (f.type === 'is' && f.val === null) {
            if ((row as unknown as Record<string, unknown>)[f.col] !== null) { ok = false; break }
          }
        }
        if (ok) return row
      }
      return null
    }

    const runUpdate = async () => {
      if (state.updateError) return { data: null, error: state.updateError }
      const match = findMatch()
      if (!match) {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' } }
      }
      const updated = { ...match, ...patch }
      state.rows.set(match.id, updated)
      state.updates.push({ id: match.id, patch })
      return { data: updated, error: null }
    }

    chain.eq = (col: string, val: unknown) => { filters.push({ type: 'eq', col, val }); return chain }
    chain.is = (col: string, val: unknown) => { filters.push({ type: 'is', col, val }); return chain }
    chain.select = () => ({
      single: runUpdate,
    })
    chain.then = (resolve: (arg: { data: FakeRow | null; error: unknown }) => unknown) => {
      return runUpdate().then(resolve)
    }
    return chain
  }

  const tableApi = {
    insert: (payload: Record<string, unknown>) => {
      if (state.insertError) {
        return {
          select: () => ({ single: async () => ({ data: null, error: state.insertError }) }),
        }
      }
      state.insertedPayloads.push(payload)
      const row = makeRow(payload as Partial<FakeRow>)
      state.rows.set(row.id, row)
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      }
    },
    select: (_cols: string) => buildSelectChain(),
    update: (patch: Partial<FakeRow>) => buildUpdateChain(patch),
  }

  return {
    createServiceClient: () => ({ from: () => tableApi }),
    supabase: { from: () => tableApi },
  }
})

import {
  recordPrnDose,
  recordEfficacyResponse,
  resolvePollDelayMinutes,
  computePollScheduledFor,
  getPendingPolls,
  markPollSent,
  DEFAULT_POLL_DELAY_MINUTES,
} from '@/lib/api/prn-doses'

beforeEach(() => {
  resetState()
})

// ---------- resolvePollDelayMinutes ----------

describe('resolvePollDelayMinutes', () => {
  it('returns the 90-min default for unknown meds', () => {
    expect(resolvePollDelayMinutes('random-unknown-med')).toBe(DEFAULT_POLL_DELAY_MINUTES)
    expect(DEFAULT_POLL_DELAY_MINUTES).toBe(90)
  })

  it('returns 60 min for tylenol (case-insensitive)', () => {
    expect(resolvePollDelayMinutes('Tylenol')).toBe(60)
    expect(resolvePollDelayMinutes('TYLENOL')).toBe(60)
    expect(resolvePollDelayMinutes('acetaminophen')).toBe(60)
  })

  it('returns 60 min for sumatriptan via substring match', () => {
    expect(resolvePollDelayMinutes('Sumatriptan 50mg')).toBe(60)
  })

  it('returns the default for blank/whitespace input', () => {
    expect(resolvePollDelayMinutes('')).toBe(DEFAULT_POLL_DELAY_MINUTES)
  })
})

// ---------- computePollScheduledFor ----------

describe('computePollScheduledFor', () => {
  it('adds delay in minutes to dose time', () => {
    const base = new Date('2026-04-17T12:00:00Z')
    const out = computePollScheduledFor(base, 90)
    expect(out.toISOString()).toBe('2026-04-17T13:30:00.000Z')
  })

  it('handles zero-delay', () => {
    const base = new Date('2026-04-17T12:00:00Z')
    const out = computePollScheduledFor(base, 0)
    expect(out.getTime()).toBe(base.getTime())
  })
})

// ---------- recordPrnDose ----------

describe('recordPrnDose', () => {
  it('inserts a row with poll_scheduled_for = dose_time + default delay for unknown med', async () => {
    const doseTimeIso = '2026-04-17T12:00:00.000Z'
    const row = await recordPrnDose({
      medicationName: 'UnknownMed',
      doseTime: doseTimeIso,
    })

    expect(state.insertedPayloads).toHaveLength(1)
    const payload = state.insertedPayloads[0]
    expect(payload.medication_name).toBe('UnknownMed')
    expect(payload.dose_time).toBe(doseTimeIso)
    // default 90-minute delay
    expect(payload.poll_scheduled_for).toBe('2026-04-17T13:30:00.000Z')
    expect(row.medication_name).toBe('UnknownMed')
  })

  it('uses the per-med override delay (ibuprofen = 90)', async () => {
    const doseTimeIso = '2026-04-17T12:00:00.000Z'
    await recordPrnDose({
      medicationName: 'Ibuprofen',
      doseTime: doseTimeIso,
    })
    expect(state.insertedPayloads[0].poll_scheduled_for).toBe(
      '2026-04-17T13:30:00.000Z',
    )
  })

  it('honors explicit pollDelayMinutes > 0', async () => {
    const doseTimeIso = '2026-04-17T12:00:00.000Z'
    await recordPrnDose({
      medicationName: 'Tylenol',
      doseTime: doseTimeIso,
      pollDelayMinutes: 120,
    })
    expect(state.insertedPayloads[0].poll_scheduled_for).toBe(
      '2026-04-17T14:00:00.000Z',
    )
  })

  it('leaves poll_scheduled_for NULL when pollDelayMinutes <= 0', async () => {
    await recordPrnDose({
      medicationName: 'Tylenol',
      pollDelayMinutes: 0,
    })
    expect(state.insertedPayloads[0].poll_scheduled_for).toBeNull()
  })

  it('rejects blank medicationName', async () => {
    await expect(recordPrnDose({ medicationName: '' }))
      .rejects.toThrow(/medicationName is required/)
    await expect(recordPrnDose({ medicationName: '   ' }))
      .rejects.toThrow(/cannot be blank/)
    // No insert was attempted.
    expect(state.insertedPayloads).toHaveLength(0)
  })

  it('rejects non-finite pollDelayMinutes', async () => {
    await expect(recordPrnDose({
      medicationName: 'Tylenol',
      pollDelayMinutes: Number.NaN,
    })).rejects.toThrow(/must be finite/)
    expect(state.insertedPayloads).toHaveLength(0)
  })

  it('rejects bogus doseTime', async () => {
    await expect(recordPrnDose({
      medicationName: 'Tylenol',
      doseTime: 'not-a-date',
    })).rejects.toThrow(/invalid doseTime/)
  })

  it('surfaces Supabase insert errors', async () => {
    state.insertError = { message: 'rls denied' }
    await expect(recordPrnDose({ medicationName: 'Tylenol' }))
      .rejects.toThrow(/Failed to record PRN dose.*rls denied/)
  })
})

// ---------- recordEfficacyResponse ----------

describe('recordEfficacyResponse', () => {
  it('rejects missing id and invalid response value', async () => {
    await expect(recordEfficacyResponse({ id: '', response: 'helped' }))
      .rejects.toThrow(/id is required/)
    await expect(recordEfficacyResponse({
      id: 'abc',
      // @ts-expect-error -- testing runtime validation
      response: 'maybe',
    })).rejects.toThrow(/invalid response/)
  })

  it('writes response + timestamp on a pending row', async () => {
    const row = makeRow({
      id: 'dose-1',
      poll_response: null,
      poll_scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    })
    state.rows.set(row.id, row)

    const result = await recordEfficacyResponse({
      id: 'dose-1',
      response: 'helped',
    })
    expect(result.poll_response).toBe('helped')
    expect(result.poll_responded_at).not.toBeNull()
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0].patch.poll_response).toBe('helped')
  })

  it('throws a clear error when the row is already answered', async () => {
    const row = makeRow({
      id: 'dose-1',
      poll_response: 'helped',
      poll_responded_at: new Date().toISOString(),
    })
    state.rows.set(row.id, row)

    await expect(recordEfficacyResponse({
      id: 'dose-1',
      response: 'worse',
    })).rejects.toThrow(/not found or already answered/)
  })
})

// ---------- getPendingPolls ----------

describe('getPendingPolls', () => {
  it('returns rows whose poll time has passed and are still unanswered, ordered oldest first', async () => {
    const past1 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const past2 = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    state.rows.set('a', makeRow({ id: 'a', poll_scheduled_for: past1 }))
    state.rows.set('b', makeRow({ id: 'b', poll_scheduled_for: past2 }))
    state.rows.set('c', makeRow({ id: 'c', poll_scheduled_for: future }))
    state.rows.set('d', makeRow({
      id: 'd',
      poll_scheduled_for: past1,
      poll_response: 'helped',
    }))
    state.rows.set('e', makeRow({
      id: 'e',
      poll_scheduled_for: past1,
      poll_sent_at: new Date().toISOString(),
    }))

    const result = await getPendingPolls(50)
    const ids = result.map(r => r.id)
    expect(ids).toEqual(['a', 'b'])
  })
})

// ---------- markPollSent ----------

describe('markPollSent', () => {
  it('updates poll_sent_at for the given row', async () => {
    state.rows.set('x', makeRow({ id: 'x' }))
    await markPollSent('x')
    const row = state.rows.get('x')!
    expect(row.poll_sent_at).not.toBeNull()
  })

  it('rejects empty id before touching the DB', async () => {
    await expect(markPollSent('')).rejects.toThrow(/id is required/)
    expect(state.updates).toHaveLength(0)
  })
})
