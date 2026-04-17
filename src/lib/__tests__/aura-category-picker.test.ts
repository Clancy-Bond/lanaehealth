/**
 * Tests for src/components/log/AuraCategoryPicker.tsx pure helpers.
 *
 * The picker's rendering logic lives inside React; here we cover the
 * pure business logic exported alongside the component so the selection
 * rules can be exercised without a DOM.
 *
 * Spec: docs/plans/2026-04-17-wave-2b-briefs.md brief A2.
 */

import { describe, it, expect, vi } from 'vitest'

// AuraCategoryPicker imports from @/lib/api/headache which transitively
// creates a Supabase client at module scope. The test env has no URL
// configured; stub the module so the import tree resolves without it.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({})),
  },
}))

import {
  shouldShowHemiplegicAdvisory,
  toggleAura,
} from '@/components/log/AuraCategoryPicker'
import type { AuraCategory } from '@/lib/api/headache'

describe('toggleAura', () => {
  it('adds a category that is not present', () => {
    expect(toggleAura([], 'visual')).toEqual(['visual'])
    expect(toggleAura(['visual'], 'sensory')).toEqual(['visual', 'sensory'])
  })

  it('removes a category that is present', () => {
    expect(toggleAura(['visual'], 'visual')).toEqual([])
    expect(toggleAura(['visual', 'sensory'], 'visual')).toEqual(['sensory'])
  })

  it('preserves order of untouched categories', () => {
    const current: AuraCategory[] = ['visual', 'sensory', 'speech']
    expect(toggleAura(current, 'sensory')).toEqual(['visual', 'speech'])
  })

  it('appends new categories to the end', () => {
    const current: AuraCategory[] = ['visual', 'motor']
    expect(toggleAura(current, 'speech')).toEqual(['visual', 'motor', 'speech'])
  })

  it('does not mutate the input array', () => {
    const current: AuraCategory[] = ['visual']
    const result = toggleAura(current, 'sensory')
    expect(current).toEqual(['visual'])
    expect(result).not.toBe(current)
  })

  it('supports toggling all four ICHD-3 categories independently', () => {
    let acc: AuraCategory[] = []
    acc = toggleAura(acc, 'visual')
    acc = toggleAura(acc, 'sensory')
    acc = toggleAura(acc, 'speech')
    acc = toggleAura(acc, 'motor')
    expect(acc).toEqual(['visual', 'sensory', 'speech', 'motor'])

    acc = toggleAura(acc, 'sensory')
    expect(acc).toEqual(['visual', 'speech', 'motor'])
  })
})

describe('shouldShowHemiplegicAdvisory', () => {
  it('is false when no aura is selected', () => {
    expect(shouldShowHemiplegicAdvisory([])).toBe(false)
  })

  it('is false for visual, sensory, or speech alone', () => {
    expect(shouldShowHemiplegicAdvisory(['visual'])).toBe(false)
    expect(shouldShowHemiplegicAdvisory(['sensory'])).toBe(false)
    expect(shouldShowHemiplegicAdvisory(['speech'])).toBe(false)
  })

  it('is false for combinations that do not include motor', () => {
    expect(shouldShowHemiplegicAdvisory(['visual', 'sensory'])).toBe(false)
    expect(
      shouldShowHemiplegicAdvisory(['visual', 'sensory', 'speech']),
    ).toBe(false)
  })

  it('is true whenever motor is included', () => {
    expect(shouldShowHemiplegicAdvisory(['motor'])).toBe(true)
    expect(shouldShowHemiplegicAdvisory(['visual', 'motor'])).toBe(true)
    expect(
      shouldShowHemiplegicAdvisory(['visual', 'sensory', 'speech', 'motor']),
    ).toBe(true)
  })
})
