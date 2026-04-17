import { describe, it, expect } from 'vitest'
import {
  NUTRIENT_LAB_MAPPINGS,
  NUTRIENT_LAB_MAPPING_COUNT,
  findMappingsForTestName,
  labNameMatches,
  normalizeTestName,
} from '@/lib/nutrition/nutrient-lab-map'

describe('nutrient-lab-map seed integrity', () => {
  it('registers a non-empty catalog', () => {
    expect(NUTRIENT_LAB_MAPPING_COUNT).toBeGreaterThanOrEqual(10)
    expect(NUTRIENT_LAB_MAPPINGS.length).toBe(NUTRIENT_LAB_MAPPING_COUNT)
  })

  it('gives every mapping a unique id', () => {
    const ids = new Set(NUTRIENT_LAB_MAPPINGS.map((m) => m.id))
    expect(ids.size).toBe(NUTRIENT_LAB_MAPPINGS.length)
  })

  it('cites a source for every mapping', () => {
    for (const m of NUTRIENT_LAB_MAPPINGS) {
      expect(m.citation.length).toBeGreaterThan(5)
      expect(m.advisory.length).toBeGreaterThan(20)
    }
  })

  it('lists at least one nutrient per mapping', () => {
    for (const m of NUTRIENT_LAB_MAPPINGS) {
      expect(m.nutrients.length).toBeGreaterThan(0)
    }
  })

  it('uses only supported directions', () => {
    const allowed = new Set([
      'below_range',
      'above_range',
      'borderline_high',
      'borderline_low',
    ])
    for (const m of NUTRIENT_LAB_MAPPINGS) {
      expect(allowed.has(m.direction)).toBe(true)
    }
  })

  it('contains Lanae-relevant mappings for iron, TSH, cholesterol, and vitamin D', () => {
    const ids = NUTRIENT_LAB_MAPPINGS.map((m) => m.id)
    expect(ids).toContain('ferritin_below_range')
    expect(ids).toContain('tsh_borderline_high')
    expect(ids).toContain('total_cholesterol_above_range')
    expect(ids).toContain('vitamin_d_below_range')
  })
})

describe('normalizeTestName', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeTestName('  Ferritin  ')).toBe('ferritin')
    expect(normalizeTestName('25-OH  Vitamin D')).toBe('25-oh vitamin d')
    expect(normalizeTestName(null)).toBe('')
    expect(normalizeTestName(undefined)).toBe('')
  })
})

describe('labNameMatches', () => {
  it('matches exact', () => {
    expect(
      labNameMatches('TSH', [{ kind: 'exact', value: 'tsh' }]),
    ).toBe(true)
    expect(
      labNameMatches('tsh, reflex', [{ kind: 'exact', value: 'tsh' }]),
    ).toBe(false)
  })

  it('matches includes case-insensitively', () => {
    expect(
      labNameMatches('Ferritin, serum', [
        { kind: 'includes', value: 'ferritin' },
      ]),
    ).toBe(true)
  })

  it('matches regex', () => {
    expect(
      labNameMatches('HbA1c', [{ kind: 'regex', value: 'hb[ ]?a1c' }]),
    ).toBe(true)
    expect(
      labNameMatches('Hb A1c', [{ kind: 'regex', value: 'hb[ ]?a1c' }]),
    ).toBe(true)
  })

  it('returns false for empty input', () => {
    expect(labNameMatches(null, [{ kind: 'exact', value: 'tsh' }])).toBe(false)
    expect(labNameMatches('', [{ kind: 'exact', value: 'tsh' }])).toBe(false)
  })
})

describe('findMappingsForTestName', () => {
  it('finds the ferritin mapping', () => {
    const res = findMappingsForTestName('Ferritin')
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res.some((m) => m.id === 'ferritin_below_range')).toBe(true)
  })

  it('finds the TSH borderline mapping by exact match', () => {
    const res = findMappingsForTestName('TSH')
    expect(res.some((m) => m.id === 'tsh_borderline_high')).toBe(true)
  })

  it('finds the cholesterol mapping', () => {
    const res = findMappingsForTestName('Total Cholesterol')
    expect(res.some((m) => m.id === 'total_cholesterol_above_range')).toBe(true)
  })

  it('returns empty for unknown tests', () => {
    expect(findMappingsForTestName('Sodium chloride pH blah').length).toBe(0)
  })
})
