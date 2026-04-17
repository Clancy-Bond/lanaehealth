/**
 * Tests for src/lib/lite-log/activities.ts (Wave 2e F2).
 *
 * The registry is the single source of truth for the Lite Log grid, the
 * seed migration, and downstream best-vs-worst aggregation. These tests
 * lock in the shape so accidental edits to activities.ts fail loudly in
 * CI.
 *
 * Spec: docs/plans/2026-04-17-wave-2e-briefs.md brief F2.
 */

import { describe, it, expect } from 'vitest'
import {
  LITE_LOG_ACTIVITIES,
  groupActivitiesByCategory,
  findActivityByName,
  categoryLabel,
} from '@/lib/lite-log/activities'

describe('LITE_LOG_ACTIVITIES registry', () => {
  it('contains 25-30 curated entries', () => {
    expect(LITE_LOG_ACTIVITIES.length).toBeGreaterThanOrEqual(25)
    expect(LITE_LOG_ACTIVITIES.length).toBeLessThanOrEqual(30)
  })

  it('has unique names so the UNIQUE(name) seed constraint holds', () => {
    const names = LITE_LOG_ACTIVITIES.map((a) => a.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('has unique display_order values within each category', () => {
    const groups = groupActivitiesByCategory()
    for (const g of groups) {
      const orders = g.items.map((i) => i.displayOrder)
      expect(new Set(orders).size).toBe(orders.length)
    }
  })

  it('covers POTS-specific coping items Lanae actually uses', () => {
    const names = LITE_LOG_ACTIVITIES.map((a) => a.name.toLowerCase())
    expect(names).toContain('compression socks')
    expect(names).toContain('salt + electrolytes')
    expect(names).toContain('lying flat')
    expect(names.some((n) => n.includes('standing'))).toBe(true)
  })

  it('covers endometriosis-specific symptoms', () => {
    const names = LITE_LOG_ACTIVITIES.map((a) => a.name.toLowerCase())
    expect(names).toContain('cramps')
    expect(names).toContain('heat pad')
    expect(names.some((n) => n.includes('heavy flow'))).toBe(true)
  })

  it('covers migraine / brain fog for chronic headache tracking', () => {
    const names = LITE_LOG_ACTIVITIES.map((a) => a.name.toLowerCase())
    expect(names.some((n) => n.includes('migraine') || n.includes('headache'))).toBe(true)
    expect(names).toContain('brain fog')
  })

  it('labels are short enough to fit the 64x72 tile', () => {
    for (const activity of LITE_LOG_ACTIVITIES) {
      expect(activity.label.length).toBeLessThanOrEqual(14)
    }
  })

  it('assigns every item a sage or blush palette accent', () => {
    for (const activity of LITE_LOG_ACTIVITIES) {
      expect(['sage', 'blush']).toContain(activity.palette)
    }
  })

  it('distributes across activity / symptom / factor / supplement buckets', () => {
    const counts: Record<string, number> = {}
    for (const a of LITE_LOG_ACTIVITIES) {
      counts[a.category] = (counts[a.category] ?? 0) + 1
    }
    // Positive-framed activities should dominate: Lite Log is a positive
    // choice on a bad day, not a symptom audit.
    expect(counts.activity ?? 0).toBeGreaterThanOrEqual(10)
    expect(counts.symptom ?? 0).toBeGreaterThanOrEqual(4)
    expect(counts.factor ?? 0).toBeGreaterThanOrEqual(4)
  })
})

describe('groupActivitiesByCategory', () => {
  it('preserves intended section order', () => {
    const groups = groupActivitiesByCategory()
    const cats = groups.map((g) => g.category)
    // Only the categories present in the registry appear, in this order.
    const validOrder = ['activity', 'symptom', 'factor', 'supplement', 'other']
    let lastIdx = -1
    for (const cat of cats) {
      const idx = validOrder.indexOf(cat)
      expect(idx).toBeGreaterThan(lastIdx)
      lastIdx = idx
    }
  })

  it('sorts items inside each group by displayOrder ascending', () => {
    const groups = groupActivitiesByCategory()
    for (const g of groups) {
      const orders = g.items.map((i) => i.displayOrder)
      const sorted = [...orders].sort((a, b) => a - b)
      expect(orders).toEqual(sorted)
    }
  })

  it('returns every activity exactly once across all groups', () => {
    const groups = groupActivitiesByCategory()
    const flattened = groups.flatMap((g) => g.items)
    expect(flattened.length).toBe(LITE_LOG_ACTIVITIES.length)
  })
})

describe('findActivityByName', () => {
  it('returns the activity when the name matches', () => {
    const found = findActivityByName('Compression socks')
    expect(found).not.toBeNull()
    expect(found?.icon).toBe('socks')
  })

  it('returns null for unknown trackables (user-authored rows)', () => {
    expect(findActivityByName('Totally made up trackable')).toBeNull()
  })
})

describe('categoryLabel', () => {
  it('uses affirming, non-shaming labels', () => {
    expect(categoryLabel('activity')).toBe('What helped')
    expect(categoryLabel('symptom')).toBe('What I felt')
    expect(categoryLabel('factor')).toBe('What I noticed')
  })

  it('does not use blame or deficit language like "mistake" or "failure"', () => {
    const values = ['activity', 'symptom', 'factor', 'supplement', 'other'] as const
    for (const v of values) {
      const label = categoryLabel(v).toLowerCase()
      expect(label).not.toContain('fail')
      expect(label).not.toContain('mistake')
      expect(label).not.toContain('bad')
    }
  })
})
