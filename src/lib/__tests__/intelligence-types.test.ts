import {
  DATA_RELIABILITY,
  computeTimeDecay,
  getConfidenceCategory,
  computeHypothesisScore,
  type EvidenceItem,
  type ConfidenceCategory,
} from '@/lib/intelligence/types'

// ---------------------------------------------------------------------------
// Helper: build an EvidenceItem with sane defaults
// ---------------------------------------------------------------------------
function makeEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    finding: 'test finding',
    source_table: 'lab_results',
    source_date: '2026-04-10',
    source_reliability: 1.0,
    supports: true,
    clinical_weight: 1.0,
    fdr_corrected: true,
    meets_criteria_rule: false,
    is_anchored: false,
    ...overrides,
  }
}

// ===========================================================================
// computeTimeDecay
// ===========================================================================
describe('computeTimeDecay', () => {
  it('returns ~1.0 for 0 days old', () => {
    expect(computeTimeDecay(0)).toBeCloseTo(1.0, 1)
  })

  it('returns ~0.74 for 30 days old', () => {
    // e^(-0.01 * 30) = e^(-0.3) ~ 0.7408
    expect(computeTimeDecay(30)).toBeCloseTo(0.74, 1)
  })

  it('returns floor of 0.3 for very old data (365 days)', () => {
    // e^(-0.01 * 365) = e^(-3.65) ~ 0.026, floored to 0.3
    expect(computeTimeDecay(365)).toBe(0.3)
  })

  it('returns 1.0 for anchored findings regardless of age', () => {
    expect(computeTimeDecay(0, true)).toBe(1.0)
    expect(computeTimeDecay(365, true)).toBe(1.0)
    expect(computeTimeDecay(9999, true)).toBe(1.0)
  })
})

// ===========================================================================
// getConfidenceCategory
// ===========================================================================
describe('getConfidenceCategory', () => {
  it('returns ESTABLISHED for score >= 80', () => {
    expect(getConfidenceCategory(80)).toBe('ESTABLISHED')
    expect(getConfidenceCategory(100)).toBe('ESTABLISHED')
  })

  it('returns PROBABLE for score 60-79', () => {
    expect(getConfidenceCategory(60)).toBe('PROBABLE')
    expect(getConfidenceCategory(79)).toBe('PROBABLE')
  })

  it('returns POSSIBLE for score 40-59', () => {
    expect(getConfidenceCategory(40)).toBe('POSSIBLE')
    expect(getConfidenceCategory(59)).toBe('POSSIBLE')
  })

  it('returns SPECULATIVE for score 20-39', () => {
    expect(getConfidenceCategory(20)).toBe('SPECULATIVE')
    expect(getConfidenceCategory(39)).toBe('SPECULATIVE')
  })

  it('returns INSUFFICIENT for score < 20', () => {
    expect(getConfidenceCategory(10)).toBe('INSUFFICIENT')
    expect(getConfidenceCategory(0)).toBe('INSUFFICIENT')
  })
})

// ===========================================================================
// computeHypothesisScore
// ===========================================================================
describe('computeHypothesisScore', () => {
  it('scores higher with more supporting evidence', () => {
    const oneSupport = [makeEvidence()]
    const twoSupport = [makeEvidence(), makeEvidence({ finding: 'second' })]

    const scoreOne = computeHypothesisScore(oneSupport, [])
    const scoreTwo = computeHypothesisScore(twoSupport, [])

    expect(scoreTwo).toBeGreaterThan(scoreOne)
  })

  it('reduces score with contradicting evidence', () => {
    const support = [makeEvidence()]
    const contradict = [makeEvidence({ supports: false })]

    const withoutContradict = computeHypothesisScore(support, [])
    const withContradict = computeHypothesisScore(support, contradict)

    expect(withContradict).toBeLessThan(withoutContradict)
  })

  it('applies FDR penalty: fdr_corrected=true scores higher than false', () => {
    const fdrTrue = [makeEvidence({ fdr_corrected: true })]
    const fdrFalse = [makeEvidence({ fdr_corrected: false })]

    const scoreCorrected = computeHypothesisScore(fdrTrue, [])
    const scoreUncorrected = computeHypothesisScore(fdrFalse, [])

    expect(scoreCorrected).toBeGreaterThan(scoreUncorrected)
  })

  it('applies criteria bonus: meets_criteria_rule=true scores higher', () => {
    const withCriteria = [makeEvidence({ meets_criteria_rule: true })]
    const withoutCriteria = [makeEvidence({ meets_criteria_rule: false })]

    const scoreCriteria = computeHypothesisScore(withCriteria, [])
    const scoreNoCriteria = computeHypothesisScore(withoutCriteria, [])

    expect(scoreCriteria).toBeGreaterThan(scoreNoCriteria)
  })

  it('returns score between 0 and 100', () => {
    const support = [
      makeEvidence({ clinical_weight: 10 }),
      makeEvidence({ clinical_weight: 10, finding: 'b' }),
    ]
    const contradict = [makeEvidence({ clinical_weight: 0.1, supports: false })]

    const score = computeHypothesisScore(support, contradict)

    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('returns 50 when supporting and contradicting are perfectly balanced', () => {
    const support = [makeEvidence({ clinical_weight: 1.0 })]
    const contradict = [makeEvidence({ clinical_weight: 1.0, supports: false })]

    const score = computeHypothesisScore(support, contradict)

    expect(score).toBe(50)
  })
})

// ===========================================================================
// DATA_RELIABILITY
// ===========================================================================
describe('DATA_RELIABILITY', () => {
  it('lab_results has reliability 1.0', () => {
    expect(DATA_RELIABILITY['lab_results']).toBe(1.0)
  })

  it('food_entries has lower reliability than lab_results', () => {
    expect(DATA_RELIABILITY['food_entries']).toBeLessThan(
      DATA_RELIABILITY['lab_results']
    )
  })

  it('oura_daily has reliability 0.7', () => {
    expect(DATA_RELIABILITY['oura_daily']).toBe(0.7)
  })

  it('daily_logs has reliability 0.6', () => {
    expect(DATA_RELIABILITY['daily_logs']).toBe(0.6)
  })
})
