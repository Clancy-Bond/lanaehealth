import { describe, it, expect } from 'vitest'
import { normalizeMedicationName } from '@/lib/import/normalize-medication'

// Emulates the dedupe check now used inside importMedications in
// src/app/api/import/myah/route.ts. Kept inline so the test exercises
// exactly the normalization contract the route depends on.
function isDuplicate(existingMeds: string[], incoming: { name: string; dose?: string | null }): boolean {
  const incomingName = normalizeMedicationName(incoming.name)
  const incomingDose = normalizeMedicationName(incoming.dose || '')
  const incomingKey = incomingDose
    ? `${incomingName} ${incomingDose}`
    : incomingName
  return existingMeds.some((m) => {
    const existingNormalized = normalizeMedicationName(m)
    if (existingNormalized === incomingKey) return true
    if (existingNormalized.startsWith(`${incomingKey} `)) return true
    if (existingNormalized.startsWith(`${incomingKey}-`)) return true
    return false
  })
}

describe('normalizeMedicationName', () => {
  it('lowercases and trims', () => {
    expect(normalizeMedicationName('Tylenol 500mg')).toBe('tylenol 500mg')
    expect(normalizeMedicationName('  Tylenol  500mg  ')).toBe('tylenol 500mg')
  })

  it('collapses whitespace inside dose units', () => {
    expect(normalizeMedicationName('tylenol 500 mg')).toBe('tylenol 500mg')
    expect(normalizeMedicationName('TYLENOL 500 MG')).toBe('tylenol 500mg')
    expect(normalizeMedicationName('Vitamin D 2000 IU')).toBe('vitamin d 2000iu')
    expect(normalizeMedicationName('B12 1000 mcg')).toBe('b12 1000mcg')
  })

  it('strips trailing action verbs and everything after', () => {
    expect(normalizeMedicationName('TYLENOL 500 MG taken')).toBe('tylenol 500mg')
    expect(normalizeMedicationName('Tylenol 500mg logged today')).toBe('tylenol 500mg')
    expect(normalizeMedicationName('Tylenol 500mg dose 2x')).toBe('tylenol 500mg')
  })

  it('collapses the canonical test-case variants to the same key', () => {
    const variants = [
      'Tylenol 500mg',
      'tylenol 500 mg',
      'TYLENOL 500 MG',
      'TYLENOL 500 MG taken',
      '  Tylenol  500mg  ',
      '  TYLENOL   500  MG   logged  ',
    ]
    const normalized = variants.map(normalizeMedicationName)
    for (const n of normalized) {
      expect(n).toBe('tylenol 500mg')
    }
  })

  it('handles empty and null-ish input without throwing', () => {
    expect(normalizeMedicationName('')).toBe('')
    expect(normalizeMedicationName('   ')).toBe('')
  })
})

describe('myAH medication dedupe (normalized)', () => {
  it('returns exists=true for every pairing of canonical variants', () => {
    const variants = [
      'Tylenol 500mg',
      'tylenol 500 mg',
      'TYLENOL 500 MG',
      'TYLENOL 500 MG taken',
      '  Tylenol  500mg  ',
    ]
    // For each variant as the existing entry, every other variant
    // should dedupe to it.
    for (const existing of variants) {
      for (const incoming of variants) {
        const hit = isDuplicate([existing], { name: incoming })
        expect(hit, `existing=${existing} incoming=${incoming}`).toBe(true)
      }
    }
  })

  it('treats separate name+dose fields the same as a combined string', () => {
    // Typical payload from the parser is split into name and dose.
    const existingStored = ['Tylenol - 500mg - 2x daily']
    expect(
      isDuplicate(existingStored, { name: 'tylenol', dose: '500 mg' })
    ).toBe(true)
    expect(
      isDuplicate(existingStored, { name: 'TYLENOL', dose: '500MG' })
    ).toBe(true)
    expect(
      isDuplicate(existingStored, { name: 'Tylenol', dose: '500mg' })
    ).toBe(true)
  })

  it('does not merge distinct medications that share a prefix', () => {
    const existing = ['Tylenol PM - 500mg - nightly']
    // "Tylenol 500mg" must NOT dedupe into "Tylenol PM 500mg".
    // The old `.includes()` check would have wrongly collapsed these.
    expect(
      isDuplicate(existing, { name: 'Tylenol', dose: '500mg' })
    ).toBe(false)
  })

  it('does not merge different doses of the same medication', () => {
    const existing = ['Acetaminophen - 325mg - every 6 hours']
    expect(
      isDuplicate(existing, { name: 'Acetaminophen', dose: '500mg' })
    ).toBe(false)
  })

  it('returns false for completely different medications', () => {
    const existing = ['Tylenol 500mg']
    expect(
      isDuplicate(existing, { name: 'Lisinopril', dose: '10mg' })
    ).toBe(false)
  })
})
