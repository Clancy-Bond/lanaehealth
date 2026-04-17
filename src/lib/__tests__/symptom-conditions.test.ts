/**
 * Tests for src/lib/api/symptom-conditions.ts (migration 018, Wave 2d D5).
 *
 * Covers the pure helper `normalizeConfidence` directly, and wraps the
 * Supabase-coupled CRUD functions with a chain-recording mock so tests
 * can assert the exact payload, table, and filter chain without hitting
 * the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface CapturedCall {
  table: string
  op: 'insert' | 'update' | 'select' | 'delete'
  payload?: unknown
  eqFilters?: Array<[string, unknown]>
  gteFilters?: Array<[string, unknown]>
  lteFilters?: Array<[string, unknown]>
  orderCalls?: Array<[string, { ascending: boolean } | undefined]>
}

const captured: CapturedCall[] = []
let mockSelectResponse: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
}
let mockInsertResponse: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
}
let mockDeleteResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}
let mockSingleResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}

function buildChain(table: string, op: CapturedCall['op']): Record<string, unknown> {
  const callRecord: CapturedCall = {
    table,
    op,
    eqFilters: [],
    gteFilters: [],
    lteFilters: [],
    orderCalls: [],
  }
  captured.push(callRecord)
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = vi.fn(ret)
  chain.eq = vi.fn((col: string, val: unknown) => {
    callRecord.eqFilters?.push([col, val])
    return chain
  })
  chain.gte = vi.fn((col: string, val: unknown) => {
    callRecord.gteFilters?.push([col, val])
    return chain
  })
  chain.lte = vi.fn((col: string, val: unknown) => {
    callRecord.lteFilters?.push([col, val])
    return chain
  })
  chain.order = vi.fn((col: string, opts?: { ascending: boolean }) => {
    callRecord.orderCalls?.push([col, opts])
    return chain
  })
  chain.limit = vi.fn(ret)
  chain.single = vi.fn(async () => mockSingleResponse)
  chain.maybeSingle = vi.fn(async () => mockSingleResponse)
  chain.then = (resolve: (value: unknown) => unknown) => {
    if (op === 'select') return Promise.resolve(mockSelectResponse).then(resolve)
    if (op === 'insert') return Promise.resolve(mockInsertResponse).then(resolve)
    if (op === 'delete') return Promise.resolve(mockDeleteResponse).then(resolve)
    return Promise.resolve({ data: null, error: null }).then(resolve)
  }
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const base: Record<string, unknown> = {}
      base.insert = vi.fn((payload: unknown) => {
        const chain = buildChain(table, 'insert')
        const entry = captured[captured.length - 1]
        entry.payload = payload
        return chain
      })
      base.select = vi.fn(() => buildChain(table, 'select'))
      base.delete = vi.fn(() => buildChain(table, 'delete'))
      base.update = vi.fn((payload: unknown) => {
        const chain = buildChain(table, 'update')
        const entry = captured[captured.length - 1]
        entry.payload = payload
        return chain
      })
      return base
    }),
  },
}))

// Import AFTER the mock is registered.
import {
  addSymptomConditionTag,
  getConditionsForSymptom,
  getSymptomsForCondition,
  normalizeConfidence,
  tagSymptomWithConditions,
} from '../api/symptom-conditions'

beforeEach(() => {
  captured.length = 0
  mockSelectResponse = { data: [], error: null }
  mockInsertResponse = { data: [], error: null }
  mockDeleteResponse = { data: null, error: null }
  mockSingleResponse = { data: null, error: null }
})

describe('normalizeConfidence', () => {
  it("returns 'explicit' by default for null / undefined / empty", () => {
    expect(normalizeConfidence(null)).toBe('explicit')
    expect(normalizeConfidence(undefined)).toBe('explicit')
    expect(normalizeConfidence('')).toBe('explicit')
  })

  it("collapses unknown strings to 'explicit' rather than passing garbage", () => {
    expect(normalizeConfidence('bogus')).toBe('explicit')
    expect(normalizeConfidence('Explicit')).toBe('explicit')
    expect(normalizeConfidence('EXPLICIT')).toBe('explicit')
    expect(normalizeConfidence('Inferred')).toBe('explicit')
  })

  it("returns 'inferred' only for the exact lowercase match", () => {
    expect(normalizeConfidence('inferred')).toBe('inferred')
  })

  it("returns 'explicit' for an explicit request", () => {
    expect(normalizeConfidence('explicit')).toBe('explicit')
  })
})

describe('getConditionsForSymptom', () => {
  it('queries symptom_conditions, filters by symptom_id, newest first', async () => {
    mockSelectResponse = {
      data: [
        {
          id: 'tag-1',
          symptom_id: 'sym-1',
          condition_id: 'cond-a',
          confidence: 'explicit',
          tagged_at: '2026-04-17T12:00:00Z',
        },
      ],
      error: null,
    }
    const rows = await getConditionsForSymptom('sym-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].condition_id).toBe('cond-a')

    const call = captured.find(c => c.op === 'select' && c.table === 'symptom_conditions')
    expect(call).toBeDefined()
    expect(call!.eqFilters).toContainEqual(['symptom_id', 'sym-1'])
    expect(call!.orderCalls?.[0]).toEqual(['tagged_at', { ascending: false }])
  })

  it('returns [] when the symptom has never been tagged', async () => {
    mockSelectResponse = { data: null, error: null }
    const rows = await getConditionsForSymptom('sym-untagged')
    expect(rows).toEqual([])
  })

  it('surfaces the database error message to callers', async () => {
    mockSelectResponse = {
      data: null,
      error: { message: 'permission denied' },
    }
    await expect(getConditionsForSymptom('sym-1')).rejects.toThrow(
      /Failed to fetch conditions for symptom/
    )
  })
})

describe('tagSymptomWithConditions', () => {
  it('deletes existing tags then inserts the new set (replace semantics)', async () => {
    mockInsertResponse = {
      data: [
        { id: 't1', symptom_id: 'sym-1', condition_id: 'c1', confidence: 'explicit', tagged_at: 'now' },
        { id: 't2', symptom_id: 'sym-1', condition_id: 'c2', confidence: 'explicit', tagged_at: 'now' },
      ],
      error: null,
    }

    const rows = await tagSymptomWithConditions('sym-1', ['c1', 'c2'])
    expect(rows).toHaveLength(2)

    const delCall = captured.find(c => c.op === 'delete' && c.table === 'symptom_conditions')
    expect(delCall).toBeDefined()
    expect(delCall!.eqFilters).toContainEqual(['symptom_id', 'sym-1'])

    const insertCall = captured.find(c => c.op === 'insert' && c.table === 'symptom_conditions')
    expect(insertCall).toBeDefined()
    const payload = insertCall!.payload as Array<Record<string, unknown>>
    expect(payload).toHaveLength(2)
    expect(payload[0]).toEqual({
      symptom_id: 'sym-1',
      condition_id: 'c1',
      confidence: 'explicit',
    })
    expect(payload[1].condition_id).toBe('c2')
  })

  it('de-duplicates the input ids so the UNIQUE constraint never trips', async () => {
    mockInsertResponse = { data: [{ id: 't1' }], error: null }
    await tagSymptomWithConditions('sym-1', ['c1', 'c1', 'c1', ''])
    const insertCall = captured.find(c => c.op === 'insert')
    const payload = insertCall!.payload as Array<unknown>
    expect(payload).toHaveLength(1)
  })

  it('returns [] and skips insert when the selection is empty (untag)', async () => {
    const rows = await tagSymptomWithConditions('sym-1', [])
    expect(rows).toEqual([])
    const delCall = captured.find(c => c.op === 'delete')
    expect(delCall).toBeDefined()
    const insertCall = captured.find(c => c.op === 'insert')
    expect(insertCall).toBeUndefined()
  })

  it("threads 'inferred' confidence through to every inserted row", async () => {
    mockInsertResponse = { data: [{ id: 't1' }], error: null }
    await tagSymptomWithConditions('sym-1', ['c1', 'c2'], 'inferred')
    const insertCall = captured.find(c => c.op === 'insert')
    const payload = insertCall!.payload as Array<Record<string, unknown>>
    expect(payload.every(r => r.confidence === 'inferred')).toBe(true)
  })

  it('rejects with a clear message when delete fails', async () => {
    mockDeleteResponse = {
      data: null,
      error: { message: 'connection reset' },
    }
    await expect(
      tagSymptomWithConditions('sym-1', ['c1'])
    ).rejects.toThrow(/Failed to clear symptom tags/)
  })

  it('rejects with a clear message when insert fails', async () => {
    mockDeleteResponse = { data: null, error: null }
    mockInsertResponse = {
      data: null,
      error: { message: 'violates foreign key constraint' },
    }
    await expect(
      tagSymptomWithConditions('sym-1', ['c1'])
    ).rejects.toThrow(/Failed to tag symptom with conditions/)
  })
})

describe('getSymptomsForCondition', () => {
  it('filters by condition_id only when no date range is provided', async () => {
    mockSelectResponse = { data: [], error: null }
    await getSymptomsForCondition('cond-pots')

    const call = captured.find(c => c.op === 'select' && c.table === 'symptom_conditions')
    expect(call).toBeDefined()
    expect(call!.eqFilters).toContainEqual(['condition_id', 'cond-pots'])
    expect(call!.gteFilters).toEqual([])
    expect(call!.lteFilters).toEqual([])
  })

  it('applies gte/lte on tagged_at when a date range is provided', async () => {
    mockSelectResponse = { data: [], error: null }
    await getSymptomsForCondition('cond-pots', {
      fromISO: '2026-04-01T00:00:00Z',
      toISO: '2026-04-17T23:59:59Z',
    })

    const call = captured.find(c => c.op === 'select' && c.table === 'symptom_conditions')
    expect(call!.gteFilters).toContainEqual(['tagged_at', '2026-04-01T00:00:00Z'])
    expect(call!.lteFilters).toContainEqual(['tagged_at', '2026-04-17T23:59:59Z'])
  })

  it('returns [] for a condition that has no tagged symptoms', async () => {
    mockSelectResponse = { data: null, error: null }
    const rows = await getSymptomsForCondition('cond-cold')
    expect(rows).toEqual([])
  })

  it('wraps the database error in a user-facing message', async () => {
    mockSelectResponse = {
      data: null,
      error: { message: 'relation does not exist' },
    }
    await expect(getSymptomsForCondition('cond-x')).rejects.toThrow(
      /Failed to fetch symptoms for condition/
    )
  })
})

describe('addSymptomConditionTag', () => {
  it("defaults confidence to 'explicit' when omitted", async () => {
    mockSingleResponse = {
      data: {
        id: 'tag-1',
        symptom_id: 'sym-1',
        condition_id: 'cond-a',
        confidence: 'explicit',
        tagged_at: '2026-04-17T12:00:00Z',
      },
      error: null,
    }
    const tag = await addSymptomConditionTag({
      symptomId: 'sym-1',
      conditionId: 'cond-a',
    })
    expect(tag.confidence).toBe('explicit')
    const insertCall = captured.find(c => c.op === 'insert')
    const payload = insertCall!.payload as Record<string, unknown>
    expect(payload.confidence).toBe('explicit')
  })

  it('normalizes a garbage confidence value back to explicit', async () => {
    mockSingleResponse = {
      data: { id: 'tag-1', confidence: 'explicit' },
      error: null,
    }
    await addSymptomConditionTag({
      symptomId: 'sym-1',
      conditionId: 'cond-a',
      confidence: 'Nope' as unknown as 'explicit',
    })
    const insertCall = captured.find(c => c.op === 'insert')
    const payload = insertCall!.payload as Record<string, unknown>
    expect(payload.confidence).toBe('explicit')
  })

  it("writes 'inferred' when the caller opts in", async () => {
    mockSingleResponse = { data: { id: 'tag-1' }, error: null }
    await addSymptomConditionTag({
      symptomId: 'sym-1',
      conditionId: 'cond-a',
      confidence: 'inferred',
    })
    const insertCall = captured.find(c => c.op === 'insert')
    const payload = insertCall!.payload as Record<string, unknown>
    expect(payload.confidence).toBe('inferred')
  })

  it('rejects with a clear message on duplicate / FK errors', async () => {
    mockSingleResponse = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    }
    await expect(
      addSymptomConditionTag({ symptomId: 'sym-1', conditionId: 'cond-a' })
    ).rejects.toThrow(/Failed to add symptom-condition tag/)
  })
})
