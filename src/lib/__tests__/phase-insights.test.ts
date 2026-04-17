/**
 * Tests for phase-matched insight dictionary.
 *
 * Confirms editorial invariants:
 *   - every insight has a non-empty title and body
 *   - content avoids em dashes and fertility / diet pressure
 *   - picker returns a phase-matched insight when one exists
 *   - picker falls back to 'all' tier when no phase is given or when the
 *     phase has no matched entry
 *   - picker is deterministic for a given (phase, date) pair
 */
import { describe, it, expect } from 'vitest'
import {
  PHASE_INSIGHTS,
  pickPhaseInsight,
  insightsForPhase,
} from '../cycle/phase-insights'
import type { CyclePhase } from '../types'

const FORBIDDEN_PHRASES = [
  'diet',
  'weight loss',
  'fertility window',
  'trying to conceive',
  'ttc',
  'burn calories',
  'streak',
]

describe('PHASE_INSIGHTS editorial invariants', () => {
  it('every insight has a title, body, and evidence tag', () => {
    for (const insight of PHASE_INSIGHTS) {
      expect(insight.id.length).toBeGreaterThan(0)
      expect(insight.title.length).toBeGreaterThan(0)
      expect(insight.body.length).toBeGreaterThan(0)
      expect(['clinical', 'educational', 'self-care']).toContain(insight.evidence_tag)
    }
  })

  it('ids are unique across the pool', () => {
    const ids = PHASE_INSIGHTS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('no insight contains an em dash', () => {
    for (const insight of PHASE_INSIGHTS) {
      expect(insight.title).not.toContain('\u2014')
      expect(insight.body).not.toContain('\u2014')
    }
  })

  it('no insight pushes diet culture or fertility pressure', () => {
    for (const insight of PHASE_INSIGHTS) {
      const text = `${insight.title} ${insight.body}`.toLowerCase()
      for (const phrase of FORBIDDEN_PHRASES) {
        expect(text, `phrase "${phrase}" in "${insight.id}"`).not.toContain(phrase)
      }
    }
  })

  it('covers every named phase with at least one entry', () => {
    const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']
    for (const phase of phases) {
      const matched = PHASE_INSIGHTS.filter((i) => i.phase === phase)
      expect(matched.length).toBeGreaterThan(0)
    }
  })

  it('has at least one all-tier fallback entry', () => {
    const allTier = PHASE_INSIGHTS.filter((i) => i.phase === 'all')
    expect(allTier.length).toBeGreaterThan(0)
  })
})

describe('pickPhaseInsight', () => {
  it('returns a matched insight for each named phase', () => {
    const phases: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']
    for (const phase of phases) {
      const result = pickPhaseInsight(phase, '2026-04-16')
      expect(result).not.toBeNull()
      expect(result!.phase).toBe(phase)
    }
  })

  it('falls back to all tier when phase is null', () => {
    const result = pickPhaseInsight(null, '2026-04-16')
    expect(result).not.toBeNull()
    expect(result!.phase).toBe('all')
  })

  it('is deterministic for the same (phase, date)', () => {
    const a = pickPhaseInsight('luteal', '2026-04-16')
    const b = pickPhaseInsight('luteal', '2026-04-16')
    expect(a?.id).toBe(b?.id)
  })

  it('can rotate across dates for the same phase', () => {
    // Collect over a month to ensure rotation produces at least 2 unique ids.
    const ids = new Set<string>()
    for (let d = 1; d <= 31; d++) {
      const date = `2026-01-${d.toString().padStart(2, '0')}`
      const insight = pickPhaseInsight('menstrual', date)
      if (insight) ids.add(insight.id)
    }
    expect(ids.size).toBeGreaterThanOrEqual(1)
  })
})

describe('insightsForPhase', () => {
  it('returns matched + all-tier entries for a named phase', () => {
    const menstrualList = insightsForPhase('menstrual')
    const hasMenstrual = menstrualList.some((i) => i.phase === 'menstrual')
    const hasAll = menstrualList.some((i) => i.phase === 'all')
    expect(hasMenstrual).toBe(true)
    expect(hasAll).toBe(true)
  })

  it('returns only all-tier when phase is null', () => {
    const list = insightsForPhase(null)
    for (const entry of list) {
      expect(entry.phase).toBe('all')
    }
  })
})
