/**
 * Tests for src/lib/labs/ranges.ts.
 *
 * Covers normalizeTestName / normalizeUnit, lookupCanonicalRange fall-through,
 * resolveRefRange precedence (row > canonical > none), and flagForValue
 * boundary behavior.
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTestName,
  normalizeUnit,
  lookupCanonicalRange,
  resolveRefRange,
  flagForValue,
} from '@/lib/labs/ranges'

describe('normalizeTestName', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeTestName('  Vitamin   D  ')).toBe('vitamin d')
    expect(normalizeTestName('TSH')).toBe('tsh')
    expect(normalizeTestName('Hs-CRP')).toBe('hs-crp')
  })
})

describe('normalizeUnit', () => {
  it('strips whitespace and lowercases', () => {
    expect(normalizeUnit('ng/mL')).toBe('ng/ml')
    expect(normalizeUnit(' U /L ')).toBe('u/l')
    expect(normalizeUnit(null)).toBe('')
    expect(normalizeUnit(undefined)).toBe('')
  })
})

describe('lookupCanonicalRange', () => {
  it('finds a unit-exact match when provided', () => {
    const r = lookupCanonicalRange('Ferritin', 'ng/mL')
    expect(r).not.toBeNull()
    expect(r?.low).toBe(13)
    expect(r?.high).toBe(150)
  })

  it('falls back to the first test-name match when unit is unknown', () => {
    const r = lookupCanonicalRange('Ferritin', 'totally-made-up')
    expect(r).not.toBeNull()
    // First canonical row for Ferritin is ng/mL
    expect(r?.unit).toBe('ng/mL')
  })

  it('returns null for unknown tests', () => {
    expect(lookupCanonicalRange('Not A Real Test', 'mg/dL')).toBeNull()
  })

  it('treats case and spacing as insignificant', () => {
    const a = lookupCanonicalRange('HEMOGLOBIN', 'g/dL')
    const b = lookupCanonicalRange('hemoglobin', 'g/dL')
    expect(a?.low).toBe(b?.low)
    expect(a?.high).toBe(b?.high)
  })
})

describe('resolveRefRange', () => {
  it('prefers row values over canonical when either bound is present', () => {
    const r = resolveRefRange('Ferritin', 'ng/mL', 25, 200)
    expect(r.source).toBe('row')
    expect(r.low).toBe(25)
    expect(r.high).toBe(200)
  })

  it('treats a row with only one bound as row-sourced (does not mix with canonical)', () => {
    const r = resolveRefRange('Ferritin', 'ng/mL', null, 160)
    expect(r.source).toBe('row')
    expect(r.low).toBeNull()
    expect(r.high).toBe(160)
  })

  it('falls back to canonical when both bounds are missing', () => {
    const r = resolveRefRange('TSH', 'uIU/mL', null, null)
    expect(r.source).toBe('canonical')
    expect(r.low).toBe(0.4)
    expect(r.high).toBe(4.5)
  })

  it('returns none when no canonical exists and no row bounds', () => {
    const r = resolveRefRange('Unknown Assay', 'arb', null, null)
    expect(r.source).toBe('none')
    expect(r.low).toBeNull()
    expect(r.high).toBeNull()
  })
})

describe('flagForValue', () => {
  it('returns null when value is null or range is fully null', () => {
    expect(flagForValue(null, 10, 20)).toBeNull()
    expect(flagForValue(15, null, null)).toBeNull()
  })

  it('classifies low / high / normal relative to the range', () => {
    expect(flagForValue(5, 10, 20)).toBe('low')
    expect(flagForValue(25, 10, 20)).toBe('high')
    expect(flagForValue(15, 10, 20)).toBe('normal')
  })

  it('treats the boundaries as inclusive (not flagged at exact bound)', () => {
    expect(flagForValue(10, 10, 20)).toBe('normal')
    expect(flagForValue(20, 10, 20)).toBe('normal')
  })

  it('handles half-open ranges (one bound null)', () => {
    expect(flagForValue(2, null, 5)).toBe('normal')
    expect(flagForValue(6, null, 5)).toBe('high')
    expect(flagForValue(6, 5, null)).toBe('normal')
    expect(flagForValue(2, 5, null)).toBe('low')
  })
})
