// ---------------------------------------------------------------------------
// micro-care action registry -- tests
//
// Guards the shape and voice of the registry. Broken invariants here would
// show up as either (a) runtime DB rejections (unknown slug), (b) shame
// language leaking into the Lanae-facing UI, or (c) POTS/endo relevance
// quietly degrading over time.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import {
  MICRO_CARE_ACTIONS,
  getMicroCareAction,
  isValidMicroCareSlug,
} from '@/lib/micro-care/actions'

describe('MICRO_CARE_ACTIONS registry', () => {
  it('ships the 10-action brief starter set', () => {
    expect(MICRO_CARE_ACTIONS.length).toBe(10)
  })

  it('has unique slugs (DB requires a stable key)', () => {
    const slugs = MICRO_CARE_ACTIONS.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('includes the brief-mandated POTS actions (salt, hydrate, legs, compression)', () => {
    const slugs = MICRO_CARE_ACTIONS.map((a) => a.slug)
    expect(slugs).toContain('salt-tablet')
    expect(slugs).toContain('hydrate-500')
    expect(slugs).toContain('elevate-legs')
    expect(slugs).toContain('compression-check')
  })

  it('includes the brief-mandated endo + nervous-system actions', () => {
    const slugs = MICRO_CARE_ACTIONS.map((a) => a.slug)
    expect(slugs).toContain('heat-pad-pelvis')
    expect(slugs).toContain('box-breathing')
    expect(slugs).toContain('grounding-54321')
    expect(slugs).toContain('cold-wrist')
  })

  it('never uses shaming/compliance language in label or subtitle', () => {
    // The non-shaming voice rule bans these tokens in user-facing copy.
    const banned =
      /(streak|missed|failed|forgot|broken|off.track|goal.met|complete this task|adhere|compliance)/i
    for (const action of MICRO_CARE_ACTIONS) {
      expect(action.label).not.toMatch(banned)
      expect(action.subtitle).not.toMatch(banned)
    }
  })

  it('every action has a non-negative duration and a valid flow type', () => {
    const validFlows = new Set(['timer', 'breathing', 'grounding', 'none'])
    for (const action of MICRO_CARE_ACTIONS) {
      expect(action.durationSeconds).toBeGreaterThanOrEqual(0)
      expect(validFlows.has(action.flow)).toBe(true)
    }
  })
})

describe('getMicroCareAction', () => {
  it('returns the action for a known slug', () => {
    const a = getMicroCareAction('salt-tablet')
    expect(a).not.toBeNull()
    expect(a?.label).toBe('Salt tablet')
  })

  it('returns null for an unknown slug (never throws)', () => {
    expect(getMicroCareAction('does-not-exist')).toBeNull()
  })
})

describe('isValidMicroCareSlug', () => {
  it('accepts a known slug', () => {
    expect(isValidMicroCareSlug('box-breathing')).toBe(true)
  })
  it('rejects an unknown slug', () => {
    expect(isValidMicroCareSlug('streak-bonus')).toBe(false)
  })
})
