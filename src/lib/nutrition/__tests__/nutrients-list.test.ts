import { describe, it, expect } from 'vitest'
import {
  NUTRIENTS,
  NUTRIENT_COUNT,
  findNutrient,
  getPriorityNutrients,
  getPresetOverride,
} from '@/lib/nutrition/nutrients-list'
import { ENDO_ANTI_INFLAMMATORY_PRESET } from '@/lib/nutrition/diet-presets'

describe('NUTRIENTS registry', () => {
  it('contains exactly 25 priority nutrients', () => {
    expect(NUTRIENT_COUNT).toBe(25)
    expect(NUTRIENTS.length).toBe(25)
  })

  it('includes the core 25 required nutrients from the brief', () => {
    const required = [
      'protein', 'carbs', 'fat', 'fiber',
      'iron', 'vitamin_d', 'vitamin_b12', 'folate',
      'calcium', 'magnesium', 'selenium', 'zinc',
      'vitamin_c', 'vitamin_a', 'vitamin_e', 'vitamin_k',
      'omega_3', 'potassium', 'sodium', 'copper',
      'manganese', 'iodine', 'choline', 'chromium', 'molybdenum',
    ]
    const keys = NUTRIENTS.map((n) => n.key)
    for (const r of required) {
      expect(keys).toContain(r)
    }
  })

  it('has unique keys', () => {
    const keys = NUTRIENTS.map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has a non-empty rdaCitation for every nutrient', () => {
    for (const n of NUTRIENTS) {
      expect(typeof n.rdaCitation).toBe('string')
      expect(n.rdaCitation.length).toBeGreaterThan(0)
    }
  })

  it('has a positive finite rdaDefault for every nutrient', () => {
    for (const n of NUTRIENTS) {
      expect(Number.isFinite(n.rdaDefault)).toBe(true)
      expect(n.rdaDefault).toBeGreaterThan(0)
    }
  })

  it('uses only allowed units', () => {
    const allowed = new Set(['g', 'mg', 'mcg', 'IU', 'kcal'])
    for (const n of NUTRIENTS) {
      expect(allowed.has(n.unit)).toBe(true)
    }
  })
})

describe('findNutrient', () => {
  it('returns a known nutrient by key', () => {
    const iron = findNutrient('iron')
    expect(iron).not.toBeNull()
    expect(iron?.displayName).toBe('Iron')
    expect(iron?.unit).toBe('mg')
  })

  it('returns null for an unknown key', () => {
    expect(findNutrient('nonexistent')).toBeNull()
  })
})

describe('getPriorityNutrients', () => {
  it('returns only priority nutrients', () => {
    const priority = getPriorityNutrients()
    expect(priority.length).toBeGreaterThan(0)
    for (const n of priority) expect(n.priority).toBe(true)
  })

  it('puts iron, vitamin D, and magnesium in the priority set', () => {
    const keys = getPriorityNutrients().map((n) => n.key)
    expect(keys).toContain('iron')
    expect(keys).toContain('vitamin_d')
    expect(keys).toContain('magnesium')
  })
})

describe('getPresetOverride', () => {
  it('returns the endo iron override of 27 mg', () => {
    const o = getPresetOverride('iron', 'endo')
    expect(o).not.toBeNull()
    expect(o?.amount).toBe(27)
    expect(o?.citation).toContain('ACOG')
  })

  it('returns null for a preset that does not override the nutrient', () => {
    const o = getPresetOverride('molybdenum', 'pots')
    expect(o).toBeNull()
  })

  it('endo preset overrides in the list match diet-presets.ts values', () => {
    for (const t of ENDO_ANTI_INFLAMMATORY_PRESET.targets) {
      const o = getPresetOverride(t.nutrient, 'endo')
      expect(o).not.toBeNull()
      expect(o?.amount).toBe(t.amount)
    }
  })
})
