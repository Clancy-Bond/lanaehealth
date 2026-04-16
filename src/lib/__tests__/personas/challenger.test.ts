import { describe, it, expect, vi } from 'vitest'

// Mock supabase to avoid needing env vars for pure-function tests
vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
  supabase: {},
}))

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

import {
  CHALLENGER_DEFINITION,
  detectStagnation,
  detectDoubleCounting,
} from '@/lib/intelligence/personas/challenger'
import type { HypothesisRecord, EvidenceItem } from '@/lib/intelligence/types'

// ===========================================================================
// Helper to build a minimal HypothesisRecord for testing
// ===========================================================================

function makeHypothesis(overrides: Partial<HypothesisRecord> & { name: string }): HypothesisRecord {
  return {
    hypothesis_id: overrides.name,
    name: overrides.name,
    description: `Hypothesis: ${overrides.name}`,
    score: 60,
    confidence: 'PROBABLE',
    direction: 'stable',
    systems_affected: [],
    supporting_evidence: [],
    contradicting_evidence: [],
    challenger_notes: null,
    last_evaluated: new Date().toISOString().split('T')[0],
    what_would_change: [],
    alternative_explanations: [],
    ...overrides,
  }
}

function makeEvidence(finding: string, overrides?: Partial<EvidenceItem>): EvidenceItem {
  return {
    finding,
    source_table: 'lab_results',
    source_date: '2026-04-15',
    source_reliability: 1.0,
    supports: true,
    clinical_weight: 2.0,
    fdr_corrected: false,
    meets_criteria_rule: false,
    is_anchored: false,
    ...overrides,
  }
}

// ===========================================================================
// detectStagnation
// ===========================================================================

describe('detectStagnation', () => {
  it('detects stagnant hypotheses (last_evaluated > 30 days ago)', () => {
    const fiftyDaysAgo = new Date()
    fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50)
    const fiftyDaysAgoStr = fiftyDaysAgo.toISOString().split('T')[0]

    const hypotheses = [
      makeHypothesis({ name: 'hashimotos', last_evaluated: fiftyDaysAgoStr }),
      makeHypothesis({ name: 'pots', last_evaluated: new Date().toISOString().split('T')[0] }),
    ]

    const stagnant = detectStagnation(hypotheses)

    expect(stagnant).toContain('hashimotos')
    expect(stagnant).not.toContain('pots')
  })

  it('does not flag recent hypotheses', () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)
    const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0]

    const hypotheses = [
      makeHypothesis({ name: 'hashimotos', last_evaluated: tenDaysAgoStr }),
      makeHypothesis({ name: 'pots', last_evaluated: new Date().toISOString().split('T')[0] }),
    ]

    const stagnant = detectStagnation(hypotheses)

    expect(stagnant).toHaveLength(0)
  })

  it('returns empty array when all hypotheses are fresh', () => {
    const today = new Date().toISOString().split('T')[0]

    const hypotheses = [
      makeHypothesis({ name: 'hashimotos', last_evaluated: today }),
      makeHypothesis({ name: 'pots', last_evaluated: today }),
      makeHypothesis({ name: 'eds', last_evaluated: today }),
    ]

    const stagnant = detectStagnation(hypotheses)

    expect(stagnant).toEqual([])
  })
})

// ===========================================================================
// detectDoubleCounting
// ===========================================================================

describe('detectDoubleCounting', () => {
  it('detects same finding in multiple hypotheses', () => {
    const sharedFinding = makeEvidence('Fatigue reported daily for 2 weeks')

    const hypotheses = [
      makeHypothesis({
        name: 'hashimotos',
        supporting_evidence: [
          sharedFinding,
          makeEvidence('TSH 6.2 above range'),
        ],
      }),
      makeHypothesis({
        name: 'pots',
        supporting_evidence: [
          sharedFinding,
          makeEvidence('Standing HR +58 from resting'),
        ],
      }),
      makeHypothesis({
        name: 'eds',
        supporting_evidence: [
          makeEvidence('Joint hypermobility Beighton 7/9'),
        ],
      }),
    ]

    const doubles = detectDoubleCounting(hypotheses)

    expect(doubles).toHaveLength(1)
    expect(doubles[0].finding).toBe('Fatigue reported daily for 2 weeks')
    expect(doubles[0].hypotheses).toContain('hashimotos')
    expect(doubles[0].hypotheses).toContain('pots')
    expect(doubles[0].hypotheses).not.toContain('eds')
  })

  it('returns empty when no duplicate findings', () => {
    const hypotheses = [
      makeHypothesis({
        name: 'hashimotos',
        supporting_evidence: [makeEvidence('TSH 6.2')],
      }),
      makeHypothesis({
        name: 'pots',
        supporting_evidence: [makeEvidence('Standing HR +58')],
      }),
    ]

    const doubles = detectDoubleCounting(hypotheses)

    expect(doubles).toEqual([])
  })

  it('handles hypotheses with no evidence', () => {
    const hypotheses = [
      makeHypothesis({ name: 'hashimotos', supporting_evidence: [] }),
      makeHypothesis({ name: 'pots', supporting_evidence: [] }),
      makeHypothesis({
        name: 'eds',
        supporting_evidence: [makeEvidence('Joint hypermobility')],
      }),
    ]

    const doubles = detectDoubleCounting(hypotheses)

    expect(doubles).toEqual([])
  })
})

// ===========================================================================
// CHALLENGER_DEFINITION
// ===========================================================================

describe('CHALLENGER_DEFINITION', () => {
  it("name is 'challenger'", () => {
    expect(CHALLENGER_DEFINITION.name).toBe('challenger')
  })

  it("requiresHandoffFrom is 'hypothesis_doctor'", () => {
    expect(CHALLENGER_DEFINITION.requiresHandoffFrom).toBe('hypothesis_doctor')
  })

  it("systemPrompt contains 'devil' and 'anchoring' and 'WRONG'", () => {
    const prompt = CHALLENGER_DEFINITION.systemPrompt
    expect(prompt).toContain('devil')
    expect(prompt).toContain('anchoring')
    expect(prompt).toContain('WRONG')
  })
})
