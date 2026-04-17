import { describe, it, expect } from 'vitest'
import {
  composePresets,
  composeTargetFor,
} from '@/lib/nutrition/preset-composer'
import {
  ENDO_ANTI_INFLAMMATORY_PRESET,
  POTS_PRESET,
  type DietPreset,
} from '@/lib/nutrition/diet-presets'

describe('composePresets — single preset', () => {
  it('returns every target from a single preset unchanged', () => {
    const out = composePresets([ENDO_ANTI_INFLAMMATORY_PRESET])
    expect(out).toHaveLength(5)
    const iron = out.find((t) => t.nutrient === 'iron')
    expect(iron?.amount).toBe(27)
    expect(iron?.sourcePresetKey).toBe('endo_anti_inflammatory')
  })

  it('returns an empty list for no presets', () => {
    expect(composePresets([])).toEqual([])
  })
})

describe('composePresets — ENDO + POTS (Lanae use case)', () => {
  const composed = composePresets([
    ENDO_ANTI_INFLAMMATORY_PRESET,
    POTS_PRESET,
  ])

  it('preserves Endo-only nutrients (iron at 27 mg)', () => {
    const iron = composed.find((t) => t.nutrient === 'iron')
    expect(iron?.amount).toBe(27)
    expect(iron?.unit).toBe('mg')
    expect(iron?.sourcePresetKey).toBe('endo_anti_inflammatory')
  })

  it('preserves Endo-only vitamin D at 2000 IU', () => {
    const d = composed.find((t) => t.nutrient === 'vitamin_d')
    expect(d?.amount).toBe(2000)
    expect(d?.sourcePresetKey).toBe('endo_anti_inflammatory')
  })

  it('preserves Endo-only selenium at 200 mcg', () => {
    const se = composed.find((t) => t.nutrient === 'selenium')
    expect(se?.amount).toBe(200)
  })

  it('preserves Endo-only omega-3 at 2 g', () => {
    const o = composed.find((t) => t.nutrient === 'omega_3')
    expect(o?.amount).toBe(2)
  })

  it('preserves Endo-only fiber at 35 g', () => {
    const f = composed.find((t) => t.nutrient === 'fiber')
    expect(f?.amount).toBe(35)
  })

  it('adds POTS sodium at 5000 mg', () => {
    const sodium = composed.find((t) => t.nutrient === 'sodium')
    expect(sodium?.amount).toBe(5000)
    expect(sodium?.unit).toBe('mg')
    expect(sodium?.sourcePresetKey).toBe('pots')
  })

  it('adds POTS fluids at 3000 mL (3 L)', () => {
    const fluids = composed.find((t) => t.nutrient === 'fluids')
    expect(fluids?.amount).toBe(3000)
    expect(fluids?.unit).toBe('mL')
    expect(fluids?.sourcePresetKey).toBe('pots')
  })

  it('adds POTS potassium at 4700 mg', () => {
    const k = composed.find((t) => t.nutrient === 'potassium')
    expect(k?.amount).toBe(4700)
    expect(k?.unit).toBe('mg')
    expect(k?.sourcePresetKey).toBe('pots')
  })

  it('produces exactly 8 composed targets (5 endo + 3 pots, no overlap)', () => {
    expect(composed).toHaveLength(8)
  })
})

describe('composePresets — intake policy uses MAX for overlapping nutrients', () => {
  const LOW_SODIUM_PRESET: DietPreset = {
    key: 'low_sodium_test',
    displayName: 'Test Low Sodium',
    description: 'fixture',
    targets: [
      {
        nutrient: 'sodium',
        displayName: 'Sodium',
        amount: 1500,
        unit: 'mg',
        rationale: 'baseline',
        citation: 'test',
        policy: 'intake',
      },
    ],
  }

  it('POTS 5000 mg wins over a 1500 mg intake preset', () => {
    const out = composePresets([LOW_SODIUM_PRESET, POTS_PRESET])
    const sodium = out.find((t) => t.nutrient === 'sodium')
    expect(sodium?.amount).toBe(5000)
    expect(sodium?.sourcePresetKey).toBe('pots')
  })

  it('MAX selection is order-independent', () => {
    const outAB = composePresets([LOW_SODIUM_PRESET, POTS_PRESET])
    const outBA = composePresets([POTS_PRESET, LOW_SODIUM_PRESET])
    const a = outAB.find((t) => t.nutrient === 'sodium')
    const b = outBA.find((t) => t.nutrient === 'sodium')
    expect(a?.amount).toBe(5000)
    expect(b?.amount).toBe(5000)
  })

  it('tracks all contributing preset keys', () => {
    const out = composePresets([LOW_SODIUM_PRESET, POTS_PRESET])
    const sodium = out.find((t) => t.nutrient === 'sodium')
    expect(sodium?.contributingPresetKeys).toContain('low_sodium_test')
    expect(sodium?.contributingPresetKeys).toContain('pots')
  })
})

describe('composePresets — threshold policy uses LAST-WINS', () => {
  const CAP_A: DietPreset = {
    key: 'cap_a',
    displayName: 'Cap A',
    description: 'fixture',
    targets: [
      {
        nutrient: 'cholesterol_cap',
        displayName: 'Cholesterol Cap',
        amount: 300,
        unit: 'mg',
        rationale: 'default cap',
        citation: 'test',
        policy: 'threshold',
      },
    ],
  }
  const CAP_B: DietPreset = {
    key: 'cap_b',
    displayName: 'Cap B',
    description: 'fixture',
    targets: [
      {
        nutrient: 'cholesterol_cap',
        displayName: 'Cholesterol Cap',
        amount: 200,
        unit: 'mg',
        rationale: 'stricter cap',
        citation: 'test',
        policy: 'threshold',
      },
    ],
  }

  it('last preset in the list sets the threshold', () => {
    const out = composePresets([CAP_A, CAP_B])
    const cap = out.find((t) => t.nutrient === 'cholesterol_cap')
    expect(cap?.amount).toBe(200)
    expect(cap?.sourcePresetKey).toBe('cap_b')
  })

  it('order matters for threshold (reverse order flips winner)', () => {
    const out = composePresets([CAP_B, CAP_A])
    const cap = out.find((t) => t.nutrient === 'cholesterol_cap')
    expect(cap?.amount).toBe(300)
    expect(cap?.sourcePresetKey).toBe('cap_a')
  })
})

describe('composePresets — default policy is intake', () => {
  it('treats a target without explicit policy as intake (max wins)', () => {
    const PRESET_NO_POLICY: DietPreset = {
      key: 'no_policy',
      displayName: 'No Policy',
      description: 'fixture',
      targets: [
        {
          nutrient: 'sodium',
          displayName: 'Sodium',
          amount: 2000,
          unit: 'mg',
          rationale: 'baseline',
          citation: 'test',
        },
      ],
    }
    const out = composePresets([PRESET_NO_POLICY, POTS_PRESET])
    const sodium = out.find((t) => t.nutrient === 'sodium')
    expect(sodium?.amount).toBe(5000)
  })
})

describe('composePresets — duplicate preset keys are deduplicated', () => {
  it('applying POTS twice does not double the contributing list', () => {
    const out = composePresets([POTS_PRESET, POTS_PRESET])
    const sodium = out.find((t) => t.nutrient === 'sodium')
    expect(sodium?.amount).toBe(5000)
    expect(sodium?.contributingPresetKeys).toEqual(['pots'])
  })
})

describe('composeTargetFor helper', () => {
  it('returns the composed target for a known nutrient', () => {
    const sodium = composeTargetFor(
      [ENDO_ANTI_INFLAMMATORY_PRESET, POTS_PRESET],
      'sodium',
    )
    expect(sodium?.amount).toBe(5000)
  })

  it('returns null when no preset sets the nutrient', () => {
    const vitK = composeTargetFor(
      [ENDO_ANTI_INFLAMMATORY_PRESET, POTS_PRESET],
      'vitamin_k',
    )
    expect(vitK).toBeNull()
  })
})
