/**
 * Regression tests for the Natural Cycles importer normalization
 * (Phase 1 audit, Bug 2).
 *
 * Why: NC exports after roughly 2026-03 stopped setting the menstruation
 * tag for some recorded periods, leaving flow_quantity (HEAVY/MEDIUM/LIGHT)
 * populated while menstruation = null. Any caller that filters
 * menstruation = 'MENSTRUATION' silently lost those periods. The importer
 * now backfills the tag at write time. The matching one-shot UPDATE for
 * already-imported rows lives at
 * src/lib/migrations/029_normalize_nc_imported_menstruation.sql.
 */

import { describe, it, expect } from 'vitest'
import { normalizeMenstruation } from '@/lib/importers/natural-cycles'

describe('normalizeMenstruation (NC import normalization, Bug 2)', () => {
  it('fills MENSTRUATION when flow=HEAVY and menstruation=null', () => {
    expect(normalizeMenstruation(null, 'HEAVY')).toBe('MENSTRUATION')
  })

  it('fills MENSTRUATION when flow=MEDIUM and menstruation=null', () => {
    expect(normalizeMenstruation(null, 'MEDIUM')).toBe('MENSTRUATION')
  })

  it('fills MENSTRUATION when flow=LIGHT and menstruation=null', () => {
    expect(normalizeMenstruation(null, 'LIGHT')).toBe('MENSTRUATION')
  })

  it('handles lower-case flow values from variant exports', () => {
    expect(normalizeMenstruation(null, 'heavy')).toBe('MENSTRUATION')
    expect(normalizeMenstruation(null, ' Light ')).toBe('MENSTRUATION')
  })

  it('does NOT fill when flow=SPOTTING (spotting is not menstruation)', () => {
    expect(normalizeMenstruation(null, 'SPOTTING')).toBeNull()
  })

  it('does NOT fill when flow=NONE', () => {
    expect(normalizeMenstruation(null, 'NONE')).toBeNull()
  })

  it('does NOT fill when flow=UNCATEGORIZED', () => {
    expect(normalizeMenstruation(null, 'UNCATEGORIZED')).toBeNull()
  })

  it('does NOT fill when flow_quantity is null or empty', () => {
    expect(normalizeMenstruation(null, null)).toBeNull()
    expect(normalizeMenstruation(null, '')).toBeNull()
  })

  it('preserves explicit menstruation values verbatim (never overwrites)', () => {
    // Idempotency: a user-confirmed SPOTTING tag must survive even when
    // flow_quantity is also set to a real-flow value.
    expect(normalizeMenstruation('SPOTTING', 'LIGHT')).toBe('SPOTTING')
    expect(normalizeMenstruation('MENSTRUATION', 'HEAVY')).toBe('MENSTRUATION')
    expect(normalizeMenstruation('CUSTOM_TAG', 'MEDIUM')).toBe('CUSTOM_TAG')
  })

  it('preserves explicit menstruation when flow is also empty', () => {
    expect(normalizeMenstruation('MENSTRUATION', null)).toBe('MENSTRUATION')
    expect(normalizeMenstruation('SPOTTING', null)).toBe('SPOTTING')
  })

  it('treats whitespace-only menstruation as missing and applies normalization', () => {
    // Defensive: empty-after-trim should behave like null so a stray space
    // does not block the backfill.
    expect(normalizeMenstruation('   ', 'HEAVY')).toBe('MENSTRUATION')
  })
})
