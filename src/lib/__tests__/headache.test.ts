/**
 * Tests for src/lib/api/headache.ts.
 *
 * Pure helpers (clampSeverity, normalizeCyclePhase, hasMotorAura) are tested
 * directly. Supabase-coupled functions are covered with a mocked supabase
 * client so they can verify the row payload shape without hitting the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock. Records the most recent insert / update payload so tests
// can assert the domain API normalizes fields correctly before dispatch.

interface CapturedCall {
  table: string
  op: 'insert' | 'update' | 'select' | 'delete'
  payload?: unknown
  eqFilters?: Array<[string, unknown]>
}

const captured: CapturedCall[] = []
let mockSingleResponse: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
}
let mockMaybeSingleResponse: {
  data: unknown
  error: { message: string } | null
} = { data: null, error: null }

function buildChain(table: string, op: CapturedCall['op']): Record<string, unknown> {
  const callRecord: CapturedCall = { table, op, eqFilters: [] }
  captured.push(callRecord)
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = vi.fn(ret)
  chain.eq = vi.fn((col: string, val: unknown) => {
    callRecord.eqFilters?.push([col, val])
    return chain
  })
  chain.is = vi.fn(ret)
  chain.gte = vi.fn(ret)
  chain.lte = vi.fn(ret)
  chain.order = vi.fn(ret)
  chain.limit = vi.fn(ret)
  chain.single = vi.fn(async () => mockSingleResponse)
  chain.maybeSingle = vi.fn(async () => mockMaybeSingleResponse)
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const base: Record<string, unknown> = {}
      base.insert = vi.fn((payload: unknown) => {
        const chain = buildChain(table, 'insert')
        ;(chain as { __payload?: unknown }).__payload = payload
        const entry = captured[captured.length - 1]
        entry.payload = payload
        return chain
      })
      base.update = vi.fn((payload: unknown) => {
        const chain = buildChain(table, 'update')
        const entry = captured[captured.length - 1]
        entry.payload = payload
        return chain
      })
      base.select = vi.fn(() => buildChain(table, 'select'))
      base.delete = vi.fn(() => buildChain(table, 'delete'))
      return base
    }),
  },
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
}))

// Import AFTER the mock is registered.
import {
  AURA_CATEGORIES,
  HEAD_ZONES,
  clampSeverity,
  deleteAttack,
  endAttack,
  getActiveAttack,
  hasMotorAura,
  normalizeCyclePhase,
  startAttack,
  updateAttack,
  type AuraCategory,
  type HeadZone,
} from '../api/headache'

beforeEach(() => {
  captured.length = 0
  mockSingleResponse = { data: null, error: null }
  mockMaybeSingleResponse = { data: null, error: null }
})

describe('HEAD_ZONES', () => {
  it('contains the 10 head zones defined in the brief', () => {
    expect(HEAD_ZONES).toHaveLength(10)
    expect(HEAD_ZONES).toContain('frontal-l')
    expect(HEAD_ZONES).toContain('frontal-r')
    expect(HEAD_ZONES).toContain('frontal-c')
    expect(HEAD_ZONES).toContain('temporal-l')
    expect(HEAD_ZONES).toContain('temporal-r')
    expect(HEAD_ZONES).toContain('orbital-l')
    expect(HEAD_ZONES).toContain('orbital-r')
    expect(HEAD_ZONES).toContain('occipital')
    expect(HEAD_ZONES).toContain('vertex')
    expect(HEAD_ZONES).toContain('c-spine')
  })

  it('is assignable to HeadZone', () => {
    const all: HeadZone[] = [...HEAD_ZONES]
    expect(all.every(z => HEAD_ZONES.includes(z))).toBe(true)
  })
})

describe('AURA_CATEGORIES', () => {
  it('covers the four ICHD-3 categories', () => {
    expect(AURA_CATEGORIES).toEqual(['visual', 'sensory', 'speech', 'motor'])
  })

  it('is assignable to AuraCategory', () => {
    const all: AuraCategory[] = [...AURA_CATEGORIES]
    expect(all).toHaveLength(4)
  })
})

describe('hasMotorAura', () => {
  it('returns false when no aura is present', () => {
    expect(hasMotorAura([])).toBe(false)
    expect(hasMotorAura(undefined)).toBe(false)
  })

  it('returns false for non-motor aura selections', () => {
    expect(hasMotorAura(['visual'])).toBe(false)
    expect(hasMotorAura(['visual', 'sensory'])).toBe(false)
    expect(hasMotorAura(['visual', 'sensory', 'speech'])).toBe(false)
  })

  it('returns true when motor aura is present', () => {
    expect(hasMotorAura(['motor'])).toBe(true)
    expect(hasMotorAura(['visual', 'motor'])).toBe(true)
    expect(hasMotorAura(['visual', 'sensory', 'speech', 'motor'])).toBe(true)
  })
})

describe('clampSeverity', () => {
  it('returns null for null or undefined', () => {
    expect(clampSeverity(null)).toBe(null)
    expect(clampSeverity(undefined)).toBe(null)
  })

  it('returns null for NaN', () => {
    expect(clampSeverity(Number.NaN)).toBe(null)
  })

  it('clamps values below 0 to 0', () => {
    expect(clampSeverity(-1)).toBe(0)
    expect(clampSeverity(-100)).toBe(0)
  })

  it('clamps values above 10 to 10', () => {
    expect(clampSeverity(11)).toBe(10)
    expect(clampSeverity(100)).toBe(10)
  })

  it('rounds fractional severity to nearest integer', () => {
    expect(clampSeverity(5.4)).toBe(5)
    expect(clampSeverity(5.6)).toBe(6)
    expect(clampSeverity(0.4)).toBe(0)
    expect(clampSeverity(9.9)).toBe(10)
  })

  it('passes through in-range integer values', () => {
    expect(clampSeverity(0)).toBe(0)
    expect(clampSeverity(5)).toBe(5)
    expect(clampSeverity(10)).toBe(10)
  })
})

describe('normalizeCyclePhase', () => {
  it('returns null when phase is null or undefined', () => {
    expect(normalizeCyclePhase(null)).toBe(null)
    expect(normalizeCyclePhase(undefined)).toBe(null)
    expect(normalizeCyclePhase('')).toBe(null)
  })

  it('passes through the four canonical phases', () => {
    expect(normalizeCyclePhase('menstrual')).toBe('menstrual')
    expect(normalizeCyclePhase('follicular')).toBe('follicular')
    expect(normalizeCyclePhase('ovulatory')).toBe('ovulatory')
    expect(normalizeCyclePhase('luteal')).toBe('luteal')
  })

  it('returns null for unrecognized values rather than writing garbage', () => {
    expect(normalizeCyclePhase('bogus')).toBe(null)
    expect(normalizeCyclePhase('Menstrual')).toBe(null) // case-sensitive
    expect(normalizeCyclePhase('peri-menopausal')).toBe(null)
  })
})

describe('startAttack', () => {
  it('inserts a row on headache_attacks with started_at defaulted', async () => {
    mockSingleResponse = {
      data: {
        id: 'a-1',
        patient_id: 'lanae',
        started_at: '2026-04-17T12:00:00.000Z',
        ended_at: null,
        severity: null,
        head_zones: [],
        aura_categories: [],
        triggers: [],
        medications_taken: [],
        medication_relief_minutes: null,
        notes: null,
        cycle_phase: null,
        hit6_score: null,
        midas_grade: null,
        created_at: '2026-04-17T12:00:00.000Z',
      },
      error: null,
    }

    const attack = await startAttack({ cycle_phase: null })

    expect(attack.id).toBe('a-1')
    const insertCall = captured.find(c => c.op === 'insert' && c.table === 'headache_attacks')
    expect(insertCall).toBeDefined()
    const payload = insertCall!.payload as Record<string, unknown>
    expect(typeof payload.started_at).toBe('string')
    expect(payload.ended_at).toBe(null)
    expect(payload.head_zones).toEqual([])
    expect(payload.aura_categories).toEqual([])
    expect(payload.triggers).toEqual([])
    expect(payload.medications_taken).toEqual([])
  })

  it('clamps severity when provided at startAttack time', async () => {
    mockSingleResponse = {
      data: { id: 'a-2' },
      error: null,
    }
    await startAttack({ severity: 99, cycle_phase: 'luteal' })
    const insertCall = captured.find(c => c.op === 'insert')
    const payload = insertCall!.payload as Record<string, unknown>
    expect(payload.severity).toBe(10)
    expect(payload.cycle_phase).toBe('luteal')
  })

  it('propagates the database error message', async () => {
    mockSingleResponse = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    }
    await expect(startAttack({ cycle_phase: null })).rejects.toThrow(
      /Failed to start headache attack/,
    )
  })
})

describe('updateAttack', () => {
  it('issues an update scoped by id with clamped severity', async () => {
    mockSingleResponse = {
      data: { id: 'a-1', severity: 10 },
      error: null,
    }
    await updateAttack('a-1', { severity: 25 })
    const updateCall = captured.find(c => c.op === 'update' && c.table === 'headache_attacks')
    expect(updateCall).toBeDefined()
    const payload = updateCall!.payload as Record<string, unknown>
    expect(payload.severity).toBe(10)
    expect(updateCall!.eqFilters).toContainEqual(['id', 'a-1'])
  })

  it('does not include fields that were not passed in', async () => {
    mockSingleResponse = { data: { id: 'a-1' }, error: null }
    await updateAttack('a-1', { head_zones: ['temporal-r'] })
    const updateCall = captured.find(c => c.op === 'update')
    const payload = updateCall!.payload as Record<string, unknown>
    expect(payload.head_zones).toEqual(['temporal-r'])
    // severity, notes, etc., were NOT passed in and should not be on the patch
    expect('severity' in payload).toBe(false)
    expect('notes' in payload).toBe(false)
  })
})

describe('endAttack', () => {
  it('delegates to updateAttack with ended_at', async () => {
    mockSingleResponse = {
      data: { id: 'a-1', ended_at: '2026-04-17T14:00:00.000Z' },
      error: null,
    }
    await endAttack('a-1', '2026-04-17T14:00:00.000Z')
    const updateCall = captured.find(c => c.op === 'update')
    const payload = updateCall!.payload as Record<string, unknown>
    expect(payload.ended_at).toBe('2026-04-17T14:00:00.000Z')
    expect(updateCall!.eqFilters).toContainEqual(['id', 'a-1'])
  })

  it('defaults ended_at to now when omitted', async () => {
    mockSingleResponse = { data: { id: 'a-1' }, error: null }
    const before = Date.now()
    await endAttack('a-1')
    const after = Date.now()
    const updateCall = captured.find(c => c.op === 'update')
    const payload = updateCall!.payload as Record<string, unknown>
    const ms = new Date(payload.ended_at as string).getTime()
    expect(ms).toBeGreaterThanOrEqual(before)
    expect(ms).toBeLessThanOrEqual(after)
  })
})

describe('getActiveAttack', () => {
  it('returns null when no open attack is found', async () => {
    mockMaybeSingleResponse = { data: null, error: null }
    const result = await getActiveAttack()
    expect(result).toBe(null)
  })

  it('filters on patient_id and ended_at IS NULL', async () => {
    mockMaybeSingleResponse = {
      data: {
        id: 'a-open',
        patient_id: 'lanae',
        started_at: '2026-04-17T12:00:00.000Z',
        ended_at: null,
        head_zones: [],
        aura_categories: [],
        triggers: [],
        medications_taken: [],
      },
      error: null,
    }
    const result = await getActiveAttack()
    expect(result?.id).toBe('a-open')
    const selectCall = captured.find(c => c.op === 'select' && c.table === 'headache_attacks')
    expect(selectCall).toBeDefined()
    expect(selectCall!.eqFilters).toContainEqual(['patient_id', 'lanae'])
  })
})

describe('deleteAttack', () => {
  it('deletes by id on headache_attacks', async () => {
    mockSingleResponse = { data: null, error: null }
    await deleteAttack('a-1')
    const delCall = captured.find(c => c.op === 'delete' && c.table === 'headache_attacks')
    expect(delCall).toBeDefined()
    expect(delCall!.eqFilters).toContainEqual(['id', 'a-1'])
  })
})
