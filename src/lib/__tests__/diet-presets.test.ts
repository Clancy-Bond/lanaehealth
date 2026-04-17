import { describe, it, expect } from 'vitest'
import {
  ENDO_ANTI_INFLAMMATORY_PRESET,
  applyPreset,
  listPresetKeys,
  type DietPreset,
  type NutrientTarget,
} from '@/lib/nutrition/diet-presets'

describe('ENDO_ANTI_INFLAMMATORY_PRESET', () => {
  it('exports the expected shape', () => {
    expect(ENDO_ANTI_INFLAMMATORY_PRESET.key).toBe('endo_anti_inflammatory')
    expect(ENDO_ANTI_INFLAMMATORY_PRESET.displayName).toContain('Endometriosis')
    expect(typeof ENDO_ANTI_INFLAMMATORY_PRESET.description).toBe('string')
    expect(ENDO_ANTI_INFLAMMATORY_PRESET.description.length).toBeGreaterThan(0)
    expect(Array.isArray(ENDO_ANTI_INFLAMMATORY_PRESET.targets)).toBe(true)
  })

  it('defines exactly the five expected nutrient targets', () => {
    const nutrients = ENDO_ANTI_INFLAMMATORY_PRESET.targets.map((t) => t.nutrient)
    expect(nutrients).toEqual([
      'iron',
      'vitamin_d',
      'selenium',
      'omega_3',
      'fiber',
    ])
  })

  it('sets the iron target to exactly 27 mg', () => {
    const iron = ENDO_ANTI_INFLAMMATORY_PRESET.targets.find(
      (t) => t.nutrient === 'iron'
    )
    expect(iron).toBeDefined()
    expect(iron?.amount).toBe(27)
    expect(iron?.unit).toBe('mg')
  })

  it('sets the vitamin D target to 2000 IU', () => {
    const vitD = ENDO_ANTI_INFLAMMATORY_PRESET.targets.find(
      (t) => t.nutrient === 'vitamin_d'
    )
    expect(vitD?.amount).toBe(2000)
    expect(vitD?.unit).toBe('IU')
  })

  it('sets the selenium target to 200 mcg', () => {
    const se = ENDO_ANTI_INFLAMMATORY_PRESET.targets.find(
      (t) => t.nutrient === 'selenium'
    )
    expect(se?.amount).toBe(200)
    expect(se?.unit).toBe('mcg')
  })

  it('sets the omega-3 target to 2 g', () => {
    const omega = ENDO_ANTI_INFLAMMATORY_PRESET.targets.find(
      (t) => t.nutrient === 'omega_3'
    )
    expect(omega?.amount).toBe(2)
    expect(omega?.unit).toBe('g')
  })

  it('sets the fiber target to 35 g', () => {
    const fiber = ENDO_ANTI_INFLAMMATORY_PRESET.targets.find(
      (t) => t.nutrient === 'fiber'
    )
    expect(fiber?.amount).toBe(35)
    expect(fiber?.unit).toBe('g')
  })

  it('includes a non-empty rationale for each target', () => {
    for (const target of ENDO_ANTI_INFLAMMATORY_PRESET.targets) {
      expect(typeof target.rationale).toBe('string')
      expect(target.rationale.length).toBeGreaterThan(0)
    }
  })

  it('includes a non-empty citation for each target', () => {
    for (const target of ENDO_ANTI_INFLAMMATORY_PRESET.targets) {
      expect(typeof target.citation).toBe('string')
      expect(target.citation.length).toBeGreaterThan(0)
    }
  })

  it('cites the expected clinical sources', () => {
    const citations = ENDO_ANTI_INFLAMMATORY_PRESET.targets.map((t) => t.citation)
    expect(citations.some((c) => c.includes('ACOG'))).toBe(true)
    expect(citations.some((c) => c.includes('Endocrine Society'))).toBe(true)
    expect(citations.some((c) => c.includes('Mier-Cabrera'))).toBe(true)
    expect(citations.some((c) => c.includes('Missmer'))).toBe(true)
    expect(citations.some((c) => c.includes('USDA'))).toBe(true)
  })

  it('uses valid unit strings for every target', () => {
    const validUnits = ['mg', 'mcg', 'g', 'IU', 'kcal']
    for (const target of ENDO_ANTI_INFLAMMATORY_PRESET.targets) {
      expect(validUnits).toContain(target.unit)
    }
  })
})

describe('applyPreset', () => {
  it('returns the full preset for a known key', () => {
    const preset: DietPreset = applyPreset('endo_anti_inflammatory')
    expect(preset).toBe(ENDO_ANTI_INFLAMMATORY_PRESET)
    expect(preset.targets.length).toBe(5)
  })

  it('throws on an unknown preset key', () => {
    expect(() => applyPreset('does_not_exist')).toThrow(/Unknown diet preset/)
  })
})

describe('listPresetKeys', () => {
  it('includes the endo anti-inflammatory key', () => {
    const keys = listPresetKeys()
    expect(keys).toContain('endo_anti_inflammatory')
  })
})

describe('NutrientTarget type contract', () => {
  it('matches the shape used by consumers', () => {
    const sample: NutrientTarget = ENDO_ANTI_INFLAMMATORY_PRESET.targets[0]
    expect(sample).toHaveProperty('nutrient')
    expect(sample).toHaveProperty('displayName')
    expect(sample).toHaveProperty('amount')
    expect(sample).toHaveProperty('unit')
    expect(sample).toHaveProperty('rationale')
    expect(sample).toHaveProperty('citation')
  })
})
