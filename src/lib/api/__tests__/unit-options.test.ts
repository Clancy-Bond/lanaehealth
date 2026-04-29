/**
 * Unit conversions for the food detail portion picker.
 *
 * Mass conversions are exact (chemistry doesn't care). Volume
 * conversions assume water density (1 ml = 1 g), so the tests pin the
 * water-equivalent values; UI labels these as approximate.
 */
import { describe, it, expect } from 'vitest'
import {
  UNIT_OPTIONS,
  findUnitOption,
  unitAmountToGrams,
  gramsToUnitAmount,
} from '../unit-options'

describe('UNIT_OPTIONS', () => {
  it('exposes the eleven canonical units in display order', () => {
    const units = UNIT_OPTIONS.map((u) => u.unit)
    expect(units).toEqual([
      'g', 'mg', 'kg', 'oz', 'lb',
      'ml', 'L', 'fl oz', 'cup', 'tbsp', 'tsp',
    ])
  })

  it('marks volume units distinctly from mass units', () => {
    const mass = UNIT_OPTIONS.filter((u) => u.kind === 'mass').map((u) => u.unit)
    const volume = UNIT_OPTIONS.filter((u) => u.kind === 'volume').map((u) => u.unit)
    expect(mass).toEqual(['g', 'mg', 'kg', 'oz', 'lb'])
    expect(volume).toEqual(['ml', 'L', 'fl oz', 'cup', 'tbsp', 'tsp'])
    expect(mass.every((_, i) => UNIT_OPTIONS[i].isVolume === false)).toBe(true)
    expect(volume.every((u) => UNIT_OPTIONS.find((opt) => opt.unit === u)?.isVolume)).toBe(true)
  })
})

describe('findUnitOption', () => {
  it('finds known units by short label', () => {
    expect(findUnitOption('g')?.gramsPerUnit).toBe(1)
    expect(findUnitOption('oz')?.gramsPerUnit).toBeCloseTo(28.3495, 4)
    expect(findUnitOption('cup')?.gramsPerUnit).toBe(240)
  })

  it('returns null for unknown units', () => {
    expect(findUnitOption('parsec')).toBeNull()
    expect(findUnitOption('')).toBeNull()
  })
})

describe('unitAmountToGrams', () => {
  // Mass — exact
  it('converts mass exactly: 1 oz = 28.3495 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('oz')!)).toBeCloseTo(28.3495, 4)
  })
  it('converts mass exactly: 2.5 oz = 70.87 g', () => {
    expect(unitAmountToGrams(2.5, findUnitOption('oz')!)).toBeCloseTo(70.87, 2)
  })
  it('converts mass exactly: 1 lb = 453.592 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('lb')!)).toBeCloseTo(453.592, 3)
  })
  it('converts mass exactly: 500 mg = 0.5 g', () => {
    expect(unitAmountToGrams(500, findUnitOption('mg')!)).toBeCloseTo(0.5, 6)
  })
  it('converts mass exactly: 1 kg = 1000 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('kg')!)).toBe(1000)
  })

  // Volume — water-equivalent
  it('converts volume (water): 1 ml = 1 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('ml')!)).toBe(1)
  })
  it('converts volume (water): 1 L = 1000 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('L')!)).toBe(1000)
  })
  it('converts volume (water): 1 fl oz ≈ 29.5735 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('fl oz')!)).toBeCloseTo(29.5735, 4)
  })
  it('converts volume (water): 1 cup = 240 g (US standard)', () => {
    expect(unitAmountToGrams(1, findUnitOption('cup')!)).toBe(240)
  })
  it('converts volume (water): 1 tbsp ≈ 14.79 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('tbsp')!)).toBeCloseTo(14.7868, 4)
  })
  it('converts volume (water): 1 tsp ≈ 4.93 g', () => {
    expect(unitAmountToGrams(1, findUnitOption('tsp')!)).toBeCloseTo(4.92892, 4)
  })

  // Edge cases
  it('returns 0 for invalid amount', () => {
    expect(unitAmountToGrams(NaN, findUnitOption('g')!)).toBe(0)
    expect(unitAmountToGrams(-5, findUnitOption('g')!)).toBe(0)
    expect(unitAmountToGrams(0, findUnitOption('g')!)).toBe(0)
  })
})

describe('gramsToUnitAmount', () => {
  it('inverts unitAmountToGrams: 100 g back to oz ≈ 3.527', () => {
    expect(gramsToUnitAmount(100, findUnitOption('oz')!)).toBeCloseTo(3.527, 3)
  })
  it('inverts: 240 g back to 1 cup', () => {
    expect(gramsToUnitAmount(240, findUnitOption('cup')!)).toBe(1)
  })
  it('round-trips: 2 fl oz -> grams -> back to 2 fl oz', () => {
    const flOz = findUnitOption('fl oz')!
    const grams = unitAmountToGrams(2, flOz)
    expect(gramsToUnitAmount(grams, flOz)).toBeCloseTo(2, 6)
  })
  it('returns 0 for invalid grams', () => {
    expect(gramsToUnitAmount(NaN, findUnitOption('g')!)).toBe(0)
    expect(gramsToUnitAmount(-1, findUnitOption('g')!)).toBe(0)
  })
})
