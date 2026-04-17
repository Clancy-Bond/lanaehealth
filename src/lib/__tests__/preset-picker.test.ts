/**
 * PresetPicker module-level tests.
 *
 * The project's vitest config runs a node environment and only picks up
 * `*.test.ts` files (no JSX / DOM render tests). These tests exercise the
 * preset registry the component imports and the composed-output contract
 * the component relies on for its inline preview, so a regression in
 * either the preset data or the composer contract is caught here.
 *
 * End-to-end render coverage will come in Playwright once the PresetPicker
 * is mounted in /settings.
 */

import { describe, it, expect } from 'vitest'
import {
  ENDO_ANTI_INFLAMMATORY_PRESET,
  POTS_PRESET,
  listPresetKeys,
  applyPreset,
} from '@/lib/nutrition/diet-presets'
import { composePresets } from '@/lib/nutrition/preset-composer'

describe('PresetPicker — registry contract', () => {
  it('registers both presets the picker offers', () => {
    const keys = listPresetKeys()
    expect(keys).toContain(ENDO_ANTI_INFLAMMATORY_PRESET.key)
    expect(keys).toContain(POTS_PRESET.key)
  })

  it('applyPreset returns the expected ENDO bundle', () => {
    expect(applyPreset(ENDO_ANTI_INFLAMMATORY_PRESET.key)).toBe(
      ENDO_ANTI_INFLAMMATORY_PRESET,
    )
  })

  it('applyPreset returns the expected POTS bundle', () => {
    expect(applyPreset(POTS_PRESET.key)).toBe(POTS_PRESET)
  })
})

describe('PresetPicker — inline preview contract', () => {
  it('composed output is stable when zero presets are active', () => {
    expect(composePresets([])).toEqual([])
  })

  it('composed output surfaces the right sourcePresetName per target', () => {
    const out = composePresets([
      ENDO_ANTI_INFLAMMATORY_PRESET,
      POTS_PRESET,
    ])
    const iron = out.find((t) => t.nutrient === 'iron')
    const sodium = out.find((t) => t.nutrient === 'sodium')
    expect(iron?.sourcePresetName).toBe(
      ENDO_ANTI_INFLAMMATORY_PRESET.displayName,
    )
    expect(sodium?.sourcePresetName).toBe(POTS_PRESET.displayName)
  })

  it('composed output for ENDO+POTS includes exactly the expected nutrient keys', () => {
    const out = composePresets([
      ENDO_ANTI_INFLAMMATORY_PRESET,
      POTS_PRESET,
    ])
    const nutrients = out.map((t) => t.nutrient).sort()
    expect(nutrients).toEqual(
      [
        'fiber',
        'fluids',
        'iron',
        'omega_3',
        'potassium',
        'selenium',
        'sodium',
        'vitamin_d',
      ].sort(),
    )
  })
})
