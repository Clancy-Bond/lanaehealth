import { describe, it, expect } from 'vitest'
import {
  resolveTarget,
  resolveAllTargets,
  buildPresetRowsForPatient,
  endoPresetAsRows,
  type NutrientTargetRow,
} from '@/lib/nutrition/target-resolver'
import { NUTRIENTS } from '@/lib/nutrition/nutrients-list'

function rdaRow(nutrient: string, amount: number, unit: string): NutrientTargetRow {
  return {
    patient_id: 'lanae',
    nutrient,
    target_amount: amount,
    target_unit: unit,
    source: 'rda',
    rationale: 'Baseline RDA for adult female 19-30.',
    citation: 'NIH ODS',
    active: true,
  }
}

describe('resolveTarget', () => {
  it('returns user override when present', () => {
    const rows: NutrientTargetRow[] = [
      rdaRow('iron', 18, 'mg'),
      {
        patient_id: 'lanae',
        nutrient: 'iron',
        target_amount: 30,
        target_unit: 'mg',
        source: 'user',
        rationale: 'clinician adjusted',
        citation: null,
        active: true,
      },
    ]
    const r = resolveTarget('iron', rows)!
    expect(r.source).toBe('user')
    expect(r.amount).toBe(30)
  })

  it('returns preset over RDA when no user override', () => {
    const rows: NutrientTargetRow[] = [
      rdaRow('iron', 18, 'mg'),
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
    const r = resolveTarget('iron', rows)!
    expect(r.source).toBe('preset')
    expect(r.presetName).toBe('endo')
    expect(r.amount).toBe(27)
  })

  it('returns RDA when only RDA row present', () => {
    const rows: NutrientTargetRow[] = [rdaRow('folate', 400, 'mcg')]
    const r = resolveTarget('folate', rows)!
    expect(r.source).toBe('rda')
    expect(r.amount).toBe(400)
  })

  it('returns canonical fallback when no DB rows exist', () => {
    const r = resolveTarget('iron', [])!
    expect(r.source).toBe('fallback')
    expect(r.amount).toBe(18)
    expect(r.unit).toBe('mg')
    expect(r.citation).toContain('NIH ODS')
  })

  it('ignores inactive rows', () => {
    const rows: NutrientTargetRow[] = [
      {
        ...rdaRow('iron', 18, 'mg'),
        active: false,
      },
    ]
    const r = resolveTarget('iron', rows)!
    expect(r.source).toBe('fallback')
  })

  it('returns null for an unknown nutrient key', () => {
    expect(resolveTarget('nonexistent', [])).toBeNull()
  })
})

describe('resolveAllTargets', () => {
  it('returns one ResolvedTarget per canonical nutrient', () => {
    const out = resolveAllTargets([])
    expect(out.length).toBe(NUTRIENTS.length)
  })

  it('fills missing rows with the fallback source', () => {
    const out = resolveAllTargets([])
    for (const r of out) expect(r.source).toBe('fallback')
  })

  it('is order-stable with nutrients-list declaration order', () => {
    const out = resolveAllTargets([])
    expect(out.map((r) => r.nutrient)).toEqual(
      NUTRIENTS.map((n) => n.key),
    )
  })
})

describe('buildPresetRowsForPatient', () => {
  it('produces endo rows matching diet-presets.ts iron target of 27', () => {
    const rows = buildPresetRowsForPatient('lanae', 'endo')
    const iron = rows.find((r) => r.nutrient === 'iron')
    expect(iron?.target_amount).toBe(27)
    expect(iron?.source).toBe('preset:endo')
    expect(iron?.citation).toContain('ACOG')
  })

  it('produces POTS rows that elevate sodium to 8000 mg', () => {
    const rows = buildPresetRowsForPatient('lanae', 'pots')
    const sodium = rows.find((r) => r.nutrient === 'sodium')
    expect(sodium).toBeDefined()
    expect(sodium?.target_amount).toBe(8000)
    expect(sodium?.source).toBe('preset:pots')
  })

  it('returns rows tagged to the supplied patient', () => {
    const rows = buildPresetRowsForPatient('some-other-patient', 'endo')
    for (const r of rows) expect(r.patient_id).toBe('some-other-patient')
  })
})

describe('endoPresetAsRows', () => {
  it('converts the Wave 1C preset into target rows without mutating it', () => {
    const rows = endoPresetAsRows()
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.source).toBe('preset:endo')
      expect(r.active).toBe(true)
    }
  })
})
