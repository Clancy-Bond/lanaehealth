/**
 * Tests for ProviderBadge specialty canonicalization.
 *
 * The visual rendering is out of scope here (no DOM environment); what we
 * care about is that varied free-text specialty strings always collapse to
 * the same canonical color-coding bucket so Lanae's records never show two
 * different badge colors for "OB/GYN" vs "Obgyn" vs "Gynecology".
 */

import { describe, it, expect } from 'vitest'
import { canonicalSpecialty, getProviderColor } from '../ProviderBadge'

describe('canonicalSpecialty', () => {
  it('maps null/undefined/empty to null', () => {
    expect(canonicalSpecialty(null)).toBeNull()
    expect(canonicalSpecialty(undefined)).toBeNull()
    expect(canonicalSpecialty('')).toBeNull()
    expect(canonicalSpecialty('   ')).toBeNull()
  })

  it('collapses OB/GYN variants into one bucket', () => {
    expect(canonicalSpecialty('OB/GYN')).toBe('obgyn')
    expect(canonicalSpecialty('obgyn')).toBe('obgyn')
    expect(canonicalSpecialty('Gynecology')).toBe('obgyn')
    expect(canonicalSpecialty('OB GYN')).toBe('obgyn')
    expect(canonicalSpecialty('Endometriosis Specialist')).toBe('obgyn')
  })

  it('identifies cardiology variants', () => {
    expect(canonicalSpecialty('Cardiology')).toBe('cardio')
    expect(canonicalSpecialty('Cardiologist')).toBe('cardio')
    expect(canonicalSpecialty('CARDIO')).toBe('cardio')
  })

  it('identifies neurology including headache/migraine subspecialties', () => {
    expect(canonicalSpecialty('Neurology')).toBe('neuro')
    expect(canonicalSpecialty('Headache Clinic')).toBe('neuro')
    expect(canonicalSpecialty('Migraine Specialist')).toBe('neuro')
  })

  it('identifies primary care variants', () => {
    expect(canonicalSpecialty('PCP')).toBe('pcp')
    expect(canonicalSpecialty('Primary Care')).toBe('pcp')
    expect(canonicalSpecialty('Internal Medicine')).toBe('pcp')
    expect(canonicalSpecialty('IM')).toBe('pcp')
    expect(canonicalSpecialty('Family Medicine')).toBe('pcp')
  })

  it('returns null for unknown specialties so the badge falls back to neutral', () => {
    expect(canonicalSpecialty('Podiatry')).toBeNull()
    expect(canonicalSpecialty('Whatever')).toBeNull()
  })
})

describe('getProviderColor', () => {
  it('returns stable colors for the same canonical specialty', () => {
    const a = getProviderColor('OB/GYN')
    const b = getProviderColor('Gynecology')
    expect(a).toBe(b)
  })

  it('returns different colors for different specialties', () => {
    const obgyn = getProviderColor('OB/GYN')
    const cardio = getProviderColor('Cardiology')
    expect(obgyn).not.toBe(cardio)
  })

  it('returns the neutral fallback color for unknown specialties', () => {
    const unknown = getProviderColor('Podiatry')
    // The neutral fallback uses var(--text-secondary)
    expect(unknown).toBe('var(--text-secondary)')
  })
})
