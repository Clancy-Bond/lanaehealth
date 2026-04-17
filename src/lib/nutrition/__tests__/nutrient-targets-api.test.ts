import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase module so we can feed the API a fake client without
// hitting the network. Must be declared before the import of the module
// under test so vi.mock is hoisted properly.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
  createServiceClient: () => ({ from: vi.fn() }),
}))

import {
  listTargets,
  upsertUserOverride,
  upsertPresetRows,
  deactivateTarget,
  getResolvedTargets,
} from '@/lib/api/nutrient-targets'
import type { NutrientTargetRow } from '@/lib/nutrition/target-resolver'

// Minimal chainable builder the tests use to mimic the Supabase client.
function makeBuilder(options: {
  selectData?: unknown
  selectError?: { message: string } | null
  singleData?: unknown
  singleError?: { message: string } | null
  updateError?: { message: string } | null
}) {
  const chain: Record<string, unknown> = {}
  const then = Promise.resolve({
    data: options.selectData ?? null,
    error: options.selectError ?? null,
  })
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.upsert = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.single = vi.fn(() =>
    Promise.resolve({
      data: options.singleData ?? null,
      error: options.singleError ?? null,
    }),
  )
  // the non-single final await returns selectData / selectError
  ;(chain as unknown as { then: Promise<unknown>['then'] }).then = then.then.bind(then)
  return chain
}

function fakeClient(dispatch: () => unknown) {
  return {
    from: vi.fn(() => dispatch()),
  } as unknown as Parameters<typeof listTargets>[1]['client']
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listTargets', () => {
  it('filters on patient_id and active=true', async () => {
    const data: NutrientTargetRow[] = [
      {
        patient_id: 'lanae',
        nutrient: 'iron',
        target_amount: 18,
        target_unit: 'mg',
        source: 'rda',
        rationale: null,
        citation: null,
        active: true,
      },
    ]
    const builder = makeBuilder({ selectData: data })
    const client = fakeClient(() => builder)
    const out = await listTargets('lanae', { client })
    expect(out).toEqual(data)
    expect(builder.select).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('patient_id', 'lanae')
    expect(builder.eq).toHaveBeenCalledWith('active', true)
  })

  it('throws a descriptive error on supabase failure', async () => {
    const builder = makeBuilder({
      selectError: { message: 'connection refused' },
    })
    const client = fakeClient(() => builder)
    await expect(listTargets('lanae', { client })).rejects.toThrow(
      /connection refused/,
    )
  })
})

describe('upsertUserOverride', () => {
  it('writes source=user and returns the inserted row', async () => {
    const insertedRow: NutrientTargetRow = {
      patient_id: 'lanae',
      nutrient: 'iron',
      target_amount: 30,
      target_unit: 'mg',
      source: 'user',
      rationale: 'clinician adjusted',
      citation: null,
      active: true,
    }
    const builder = makeBuilder({ singleData: insertedRow })
    const client = fakeClient(() => builder)
    const out = await upsertUserOverride(
      {
        nutrient: 'iron',
        targetAmount: 30,
        targetUnit: 'mg',
        rationale: 'clinician adjusted',
      },
      { client },
    )
    expect(out).toEqual(insertedRow)
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'user',
        nutrient: 'iron',
        target_amount: 30,
      }),
      expect.objectContaining({ onConflict: 'patient_id,nutrient' }),
    )
  })

  it('rejects unknown nutrient keys', async () => {
    const builder = makeBuilder({})
    const client = fakeClient(() => builder)
    await expect(
      upsertUserOverride(
        { nutrient: 'definitely_not_real', targetAmount: 5, targetUnit: 'mg' },
        { client },
      ),
    ).rejects.toThrow(/Unknown nutrient key/)
  })

  it('rejects negative or non-finite amounts', async () => {
    const builder = makeBuilder({})
    const client = fakeClient(() => builder)
    await expect(
      upsertUserOverride(
        { nutrient: 'iron', targetAmount: -1, targetUnit: 'mg' },
        { client },
      ),
    ).rejects.toThrow(/non-negative/)
    await expect(
      upsertUserOverride(
        { nutrient: 'iron', targetAmount: Number.NaN, targetUnit: 'mg' },
        { client },
      ),
    ).rejects.toThrow(/non-negative/)
  })
})

describe('upsertPresetRows preservation', () => {
  it('skips preset writes for nutrients already overridden by the user', async () => {
    // Existing rows: iron has a user override, calcium does not.
    const existing = [
      { patient_id: 'lanae', nutrient: 'iron', source: 'user', active: true },
      { patient_id: 'lanae', nutrient: 'calcium', source: 'rda', active: true },
    ]
    // Write attempts from a preset apply.
    const presetRows: NutrientTargetRow[] = [
      {
        patient_id: 'lanae',
        nutrient: 'iron',
        target_amount: 27,
        target_unit: 'mg',
        source: 'preset:endo',
        rationale: 'endo preset',
        citation: 'ACOG',
        active: true,
      },
      {
        patient_id: 'lanae',
        nutrient: 'calcium',
        target_amount: 1200,
        target_unit: 'mg',
        source: 'preset:endo',
        rationale: 'elevated calcium',
        citation: 'NIH ODS',
        active: true,
      },
    ]

    // Builder returns existing on select and echoes upsert input on insert.
    let upsertCall: NutrientTargetRow[] | null = null
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    ;(chain as unknown as { then: unknown }).then = (
      onf: (v: unknown) => unknown,
    ) =>
      Promise.resolve({ data: existing, error: null }).then(onf)
    chain.upsert = vi.fn((rows: NutrientTargetRow[]) => {
      upsertCall = rows
      return {
        select: vi.fn(() =>
          Promise.resolve({ data: rows, error: null }),
        ),
      }
    })

    const client = fakeClient(() => chain)
    const written = await upsertPresetRows(presetRows, undefined, { client })

    // iron should be preserved (user override), only calcium should write.
    expect(upsertCall).not.toBeNull()
    expect((upsertCall as unknown as NutrientTargetRow[]).length).toBe(1)
    expect((upsertCall as unknown as NutrientTargetRow[])[0].nutrient).toBe(
      'calcium',
    )
    expect(written.length).toBe(1)
  })

  it('force=true overrides user protection', async () => {
    const existing = [
      { patient_id: 'lanae', nutrient: 'iron', source: 'user', active: true },
    ]
    const presetRows: NutrientTargetRow[] = [
      {
        patient_id: 'lanae',
        nutrient: 'iron',
        target_amount: 27,
        target_unit: 'mg',
        source: 'preset:endo',
        rationale: 'endo preset',
        citation: 'ACOG',
        active: true,
      },
    ]

    let upsertCall: NutrientTargetRow[] | null = null
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn(() => chain)
    chain.in = vi.fn(() => chain)
    ;(chain as unknown as { then: unknown }).then = (
      onf: (v: unknown) => unknown,
    ) =>
      Promise.resolve({ data: existing, error: null }).then(onf)
    chain.upsert = vi.fn((rows: NutrientTargetRow[]) => {
      upsertCall = rows
      return {
        select: vi.fn(() =>
          Promise.resolve({ data: rows, error: null }),
        ),
      }
    })
    const client = fakeClient(() => chain)
    await upsertPresetRows(presetRows, { force: true }, { client })
    expect((upsertCall as unknown as NutrientTargetRow[]).length).toBe(1)
    expect((upsertCall as unknown as NutrientTargetRow[])[0].nutrient).toBe('iron')
  })
})

describe('deactivateTarget', () => {
  it('updates active=false on the matching row', async () => {
    const builder: Record<string, unknown> = {}
    builder.update = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    ;(builder as unknown as { then: unknown }).then = (
      onf: (v: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(onf)
    const client = fakeClient(() => builder)
    await deactivateTarget({ nutrient: 'iron' }, { client })
    expect(builder.update).toHaveBeenCalledWith({ active: false })
    expect(builder.eq).toHaveBeenCalledWith('patient_id', 'lanae')
    expect(builder.eq).toHaveBeenCalledWith('nutrient', 'iron')
  })
})

describe('getResolvedTargets', () => {
  it('returns 25 entries even when no rows exist', async () => {
    const builder = makeBuilder({ selectData: [] })
    const client = fakeClient(() => builder)
    const out = await getResolvedTargets('lanae', { client })
    expect(out.length).toBe(25)
  })

  it('surfaces a user override through resolution', async () => {
    const data: NutrientTargetRow[] = [
      {
        patient_id: 'lanae',
        nutrient: 'iron',
        target_amount: 27,
        target_unit: 'mg',
        source: 'user',
        rationale: 'clinician',
        citation: null,
        active: true,
      },
    ]
    const builder = makeBuilder({ selectData: data })
    const client = fakeClient(() => builder)
    const out = await getResolvedTargets('lanae', { client })
    const iron = out.find((r) => r.nutrient === 'iron')
    expect(iron?.source).toBe('user')
    expect(iron?.amount).toBe(27)
  })
})
