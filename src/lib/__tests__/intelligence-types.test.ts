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
  // Most relative-ordering tests need confirmatory evidence so the cap
  // doesn't flatten both sides of the comparison to 70. Shared helper:
  const confirmed = (o: Partial<EvidenceItem> = {}) =>
    makeEvidence({ meets_criteria_rule: true, is_anchored: true, ...o })

  it('scores higher with more supporting evidence', () => {
    // Include a contradicting item so the ratio in the scorer has room
    // to move. Pure all-supporting evidence both normalize to the same
    // ceiling regardless of count because raw == maxPossible.
    const contradict = [makeEvidence({ supports: false, finding: 'counterpoint' })]
    const oneSupport = [confirmed()]
    const twoSupport = [confirmed(), confirmed({ finding: 'second' })]

    const scoreOne = computeHypothesisScore(oneSupport, contradict)
    const scoreTwo = computeHypothesisScore(twoSupport, contradict)

    expect(scoreTwo).toBeGreaterThan(scoreOne)
  })

  it('reduces score with contradicting evidence', () => {
    const support = [confirmed()]
    const contradict = [makeEvidence({ supports: false })]

    const withoutContradict = computeHypothesisScore(support, [])
    const withContradict = computeHypothesisScore(support, contradict)

    expect(withContradict).toBeLessThan(withoutContradict)
  })

  it('applies FDR penalty: fdr_corrected=true scores higher than false', () => {
    const fdrTrue = [confirmed({ fdr_corrected: true })]
    const fdrFalse = [confirmed({ fdr_corrected: false })]

    const scoreCorrected = computeHypothesisScore(fdrTrue, [])
    const scoreUncorrected = computeHypothesisScore(fdrFalse, [])

    expect(scoreCorrected).toBeGreaterThan(scoreUncorrected)
  })

  it('applies criteria bonus: meets_criteria_rule=true scores higher', () => {
    const withCriteria = [confirmed({ meets_criteria_rule: true })]
    const withoutCriteria = [confirmed({ meets_criteria_rule: false })]

    const scoreCriteria = computeHypothesisScore(withCriteria, [])
    const scoreNoCriteria = computeHypothesisScore(withoutCriteria, [])

    expect(scoreCriteria).toBeGreaterThan(scoreNoCriteria)
  })

  it('caps score at PROBABLE ceiling without confirmatory evidence', () => {
    // Strong supporting evidence but NO criterion-meeting anchor
    // (e.g., symptom codes, clinical suspicion, weak correlations).
    const suspicionOnly = [
      makeEvidence({ clinical_weight: 5, meets_criteria_rule: false, is_anchored: false }),
      makeEvidence({ clinical_weight: 5, meets_criteria_rule: false, is_anchored: false, finding: 'b' }),
    ]

    const score = computeHypothesisScore(suspicionOnly, [])

    // Cap is 70 (top of PROBABLE). Must NOT reach ESTABLISHED.
    expect(score).toBeLessThan(80)
    expect(score).toBeLessThanOrEqual(70)
  })

  it('allows ESTABLISHED when meets_criteria_rule AND is_anchored are true', () => {
    // Imaging-confirmed or histology-confirmed finding counts as
    // criterion-meeting confirmatory evidence.
    const confirmedStrong = [
      confirmed({ clinical_weight: 5, finding: 'laparoscopy-confirmed endometriosis' }),
      confirmed({ clinical_weight: 5, finding: 'TVUS-visible endometriomas' }),
    ]

    const score = computeHypothesisScore(confirmedStrong, [])

    expect(score).toBeGreaterThanOrEqual(80)
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
