/**
 * Tests for parseProfileContent().
 *
 * W2.6 (session-2-matrix.md): PUT /api/profile used to JSON.stringify(content)
 * into a jsonb column, so existing rows are a mix of raw objects and
 * JSON-stringified strings. parseProfileContent is the shared helper every
 * reader runs values through so both shapes are transparent indefinitely.
 */

import { describe, it, expect } from 'vitest'
import { parseProfileContent } from '@/lib/profile/parse-content'

describe('parseProfileContent', () => {
  it('returns a raw object unchanged (importer-written shape)', () => {
    const raw = {
      full_name: 'Lanae A. Bond',
      age: 24,
      sex: 'female',
    }
    const parsed = parseProfileContent(raw)
    expect(parsed).toEqual(raw)
    // Identity preserved: readers can safely mutate the result only if they
    // expect a fresh object; parser does not clone.
    expect(parsed).toBe(raw)
  })

  it('parses a JSON-stringified object (legacy PUT /api/profile shape)', () => {
    const original = {
      current_medications: ['Hydroxyzine - 25mg', 'Cetirizine - 10mg'],
    }
    const stringified = JSON.stringify(original)
    const parsed = parseProfileContent(stringified)
    expect(parsed).toEqual(original)
  })

  it('returns the raw string when it is not valid JSON', () => {
    // Some sections legitimately store free-text (e.g. a narrative blob).
    // If the column happens to hold a non-JSON string, the parser must not
    // throw -- it must return the string as-is so readers can still display
    // it.
    const raw = 'free form narrative with no JSON structure'
    const parsed = parseProfileContent(raw)
    expect(parsed).toBe(raw)
  })

  it('passes through arrays and primitives (non-object jsonb shapes)', () => {
    expect(parseProfileContent(['a', 'b'])).toEqual(['a', 'b'])
    expect(parseProfileContent(null)).toBeNull()
    expect(parseProfileContent(undefined)).toBeUndefined()
  })
})
