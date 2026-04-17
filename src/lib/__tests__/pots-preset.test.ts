import { describe, it, expect } from 'vitest'
import {
  POTS_PRESET,
  ENDO_ANTI_INFLAMMATORY_PRESET,
  applyPreset,
  listPresetKeys,
} from '@/lib/nutrition/diet-presets'

describe('POTS_PRESET', () => {
  it('exports the expected shape', () => {
    expect(POTS_PRESET.key).toBe('pots')
    expect(POTS_PRESET.displayName).toBe('POTS Protocol')
    expect(typeof POTS_PRESET.description).toBe('string')
    expect(POTS_PRESET.description.length).toBeGreaterThan(0)
    expect(Array.isArray(POTS_PRESET.targets)).toBe(true)
  })

  it('defines sodium, fluids, and potassium targets', () => {
    const nutrients = POTS_PRESET.targets.map((t) => t.nutrient)
    expect(nutrients).toContain('sodium')
    expect(nutrients).toContain('fluids')
    expect(nutrients).toContain('potassium')
  })

  it('sets sodium to 5000 mg', () => {
    const sodium = POTS_PRESET.targets.find((t) => t.nutrient === 'sodium')
    expect(sodium?.amount).toBe(5000)
    expect(sodium?.unit).toBe('mg')
  })

  it('sets fluids to 3000 mL (3 L)', () => {
    const fluids = POTS_PRESET.targets.find((t) => t.nutrient === 'fluids')
    expect(fluids?.amount).toBe(3000)
    expect(fluids?.unit).toBe('mL')
  })

  it('sets potassium to 4700 mg', () => {
    const k = POTS_PRESET.targets.find((t) => t.nutrient === 'potassium')
    expect(k?.amount).toBe(4700)
    expect(k?.unit).toBe('mg')
  })

  it('cites Vanderbilt on sodium and fluids', () => {
    const sodium = POTS_PRESET.targets.find((t) => t.nutrient === 'sodium')
    const fluids = POTS_PRESET.targets.find((t) => t.nutrient === 'fluids')
    expect(sodium?.citation).toContain('Vanderbilt')
    expect(fluids?.citation).toContain('Vanderbilt')
  })

  it('cites AHA on potassium', () => {
    const k = POTS_PRESET.targets.find((t) => t.nutrient === 'potassium')
    expect(k?.citation).toContain('American Heart Association')
  })

  it('includes non-empty rationale for every target', () => {
    for (const target of POTS_PRESET.targets) {
      expect(typeof target.rationale).toBe('string')
      expect(target.rationale.length).toBeGreaterThan(0)
    }
  })

  it('uses intake policy for all targets (POTS is intake-style)', () => {
    for (const target of POTS_PRESET.targets) {
      expect(target.policy).toBe('intake')
    }
  })
})

describe('POTS preset does not rewrite ENDO preset', () => {
  it('ENDO preset still has exactly 5 targets', () => {
    expect(ENDO_ANTI_INFLAMMATORY_PRESET.targets).toHaveLength(5)
  })

  it('ENDO iron is still 27 mg', () => {
    const iron = ENDO_ANTI_INFLAMMATORY_PRESET.targets.find(
      (t) => t.nutrient === 'iron',
    )
    expect(iron?.amount).toBe(27)
  })

  it('ENDO and POTS are distinct objects', () => {
    expect(ENDO_ANTI_INFLAMMATORY_PRESET.key).not.toBe(POTS_PRESET.key)
  })
})

describe('applyPreset supports POTS', () => {
  it('returns the POTS preset for key "pots"', () => {
    expect(applyPreset('pots')).toBe(POTS_PRESET)
  })
})

describe('listPresetKeys includes both presets', () => {
  it('lists endo and pots', () => {
    const keys = listPresetKeys()
    expect(keys).toContain('endo_anti_inflammatory')
    expect(keys).toContain('pots')
  })
})
