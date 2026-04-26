import { describe, expect, it } from 'vitest'
import {
  CONDITIONS_CATALOG,
  CATEGORY_LABELS,
  searchConditions,
} from '../conditions-catalog'

describe('conditions catalog', () => {
  it('ships at least 50 conditions per spec', () => {
    expect(CONDITIONS_CATALOG.length).toBeGreaterThanOrEqual(50)
  })

  it('every condition has a unique slug', () => {
    const slugs = CONDITIONS_CATALOG.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every condition has a non-empty label', () => {
    for (const c of CONDITIONS_CATALOG) {
      expect(c.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('every condition category has a label entry', () => {
    for (const c of CONDITIONS_CATALOG) {
      expect(CATEGORY_LABELS[c.category]).toBeDefined()
    }
  })

  it('includes the spec-mentioned conditions', () => {
    const labels = CONDITIONS_CATALOG.map((c) => c.label.toLowerCase())
    for (const expected of [
      'pots',
      'mcas',
      'migraine',
      'endometriosis',
      'hypothyroid',
      'anxiety',
      'depression',
      'ibs',
      'fibromyalgia',
    ]) {
      expect(labels.some((l) => l.includes(expected))).toBe(true)
    }
  })

  it('includes both EDS hypermobile and classical', () => {
    const labels = CONDITIONS_CATALOG.map((c) => c.label.toLowerCase())
    expect(labels.some((l) => l.includes('hypermobile'))).toBe(true)
    expect(labels.some((l) => l.includes('classical'))).toBe(true)
  })
})

describe('searchConditions', () => {
  it('returns the full catalog when query is empty', () => {
    expect(searchConditions('')).toEqual(CONDITIONS_CATALOG)
    expect(searchConditions('   ')).toEqual(CONDITIONS_CATALOG)
  })

  it('matches case-insensitive substrings', () => {
    const results = searchConditions('migraine')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].label.toLowerCase()).toContain('migraine')
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchConditions('xyzzy nothing matches')).toEqual([])
  })

  it('finds POTS via lowercase query', () => {
    const results = searchConditions('pots')
    expect(results.some((r) => r.label.toLowerCase() === 'pots')).toBe(true)
  })
})
