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
  parseEvidenceItems,
  buildHypothesisTracker,
} from '@/lib/intelligence/personas/hypothesis-doctor'
import { DATA_RELIABILITY } from '@/lib/intelligence/types'

// ===========================================================================
// parseEvidenceItems
// ===========================================================================
describe('parseEvidenceItems', () => {
  it('parses valid JSON evidence items from raw output', () => {
    const raw = `Some preamble text.

EVIDENCE_ITEMS:
{"finding": "TSH 6.2 above reference range", "source_table": "lab_results", "source_date": "2026-04-15", "supports_hypothesis": "hashimotos", "is_supporting": true, "clinical_weight": 3.0, "fdr_corrected": false, "meets_criteria_rule": true, "is_anchored": false}
{"finding": "No goiter on exam", "source_table": "medical_timeline", "source_date": "2026-04-08", "supports_hypothesis": "hashimotos", "is_supporting": false, "clinical_weight": 1.5, "fdr_corrected": false, "meets_criteria_rule": false, "is_anchored": false}

FINDINGS:
- TSH is elevated
- More findings here`

    const items = parseEvidenceItems(raw)

    expect(items).toHaveLength(2)
    expect(items[0].finding).toBe('TSH 6.2 above reference range')
    expect(items[0].source_table).toBe('lab_results')
    expect(items[0].supports_hypothesis).toBe('hashimotos')
    expect(items[0].is_supporting).toBe(true)
    expect(items[0].clinical_weight).toBe(3.0)
    expect(items[1].finding).toBe('No goiter on exam')
    expect(items[1].is_supporting).toBe(false)
  })

  it('skips invalid JSON lines gracefully', () => {
    const raw = `EVIDENCE_ITEMS:
{"finding": "Valid item", "source_table": "lab_results", "source_date": "2026-04-15", "supports_hypothesis": "hashimotos", "is_supporting": true, "clinical_weight": 2.0, "fdr_corrected": false, "meets_criteria_rule": false, "is_anchored": false}
This is not valid JSON at all
{"finding": "Another valid", "source_table": "oura_daily", "source_date": "2026-04-10", "supports_hypothesis": "pots", "is_supporting": true, "clinical_weight": 1.0, "fdr_corrected": true, "meets_criteria_rule": false, "is_anchored": false}
FINDINGS:
- stuff`

    const items = parseEvidenceItems(raw)

    expect(items).toHaveLength(2)
    expect(items[0].finding).toBe('Valid item')
    expect(items[1].finding).toBe('Another valid')
  })

  it('returns empty array when no EVIDENCE_ITEMS section found', () => {
    const raw = `FINDINGS:
- Some findings here
DATA_QUALITY: 90%
DELTA: none
HANDOFF: pass along`

    const items = parseEvidenceItems(raw)
    expect(items).toEqual([])
  })

  it('handles mixed valid and invalid lines', () => {
    const raw = `EVIDENCE_ITEMS:

{"finding": "First valid", "source_table": "lab_results", "source_date": "2026-04-15", "supports_hypothesis": "hashimotos", "is_supporting": true, "clinical_weight": 3.0, "fdr_corrected": false, "meets_criteria_rule": true, "is_anchored": false}
not json
{broken json: true}
{"finding": "Second valid", "source_table": "daily_logs", "source_date": "2026-04-10", "supports_hypothesis": "hashimotos", "is_supporting": false, "clinical_weight": 1.0, "fdr_corrected": false, "meets_criteria_rule": false, "is_anchored": false}

FINDINGS:
- end`

    const items = parseEvidenceItems(raw)

    expect(items).toHaveLength(2)
    expect(items[0].finding).toBe('First valid')
    expect(items[1].finding).toBe('Second valid')
  })
})

// ===========================================================================
// buildHypothesisTracker
// ===========================================================================

const sampleItems = [
  {
    finding: 'TSH 6.2',
    source_table: 'lab_results',
    source_date: '2026-04-15',
    supports_hypothesis: 'hashimotos',
    is_supporting: true,
    clinical_weight: 3.0,
    fdr_corrected: false,
    meets_criteria_rule: true,
    is_anchored: false,
  },
  {
    finding: 'Fatigue worsening',
    source_table: 'daily_logs',
    source_date: '2026-04-10',
    supports_hypothesis: 'hashimotos',
    is_supporting: true,
    clinical_weight: 1.5,
    fdr_corrected: false,
    meets_criteria_rule: false,
    is_anchored: false,
  },
  {
    finding: 'Standing HR +58',
    source_table: 'lab_results',
    source_date: '2026-04-09',
    supports_hypothesis: 'pots',
    is_supporting: true,
    clinical_weight: 3.0,
    fdr_corrected: false,
    meets_criteria_rule: true,
    is_anchored: false,
  },
]

describe('buildHypothesisTracker', () => {
  it('groups evidence by hypothesis correctly', () => {
    const hypotheses = buildHypothesisTracker(sampleItems)

    const names = hypotheses.map((h) => h.name)
    expect(names).toContain('hashimotos')
    expect(names).toContain('pots')

    const hashimotos = hypotheses.find((h) => h.name === 'hashimotos')!
    expect(hashimotos.supporting_evidence).toHaveLength(2)
    expect(hashimotos.contradicting_evidence).toHaveLength(0)

    const pots = hypotheses.find((h) => h.name === 'pots')!
    expect(pots.supporting_evidence).toHaveLength(1)
    expect(pots.contradicting_evidence).toHaveLength(0)
  })

  it('supporting evidence produces higher score than contradicting', () => {
    const supportOnly = [
      {
        finding: 'Positive antibodies',
        source_table: 'lab_results',
        source_date: '2026-04-15',
        supports_hypothesis: 'hashimotos',
        is_supporting: true,
        clinical_weight: 3.0,
        fdr_corrected: true,
        meets_criteria_rule: true,
        is_anchored: false,
      },
    ]

    const contradictOnly = [
      {
        finding: 'Normal thyroid',
        source_table: 'lab_results',
        source_date: '2026-04-15',
        supports_hypothesis: 'hashimotos_alt',
        is_supporting: false,
        clinical_weight: 3.0,
        fdr_corrected: true,
        meets_criteria_rule: true,
        is_anchored: false,
      },
    ]

    const supportResult = buildHypothesisTracker(supportOnly)
    const contradictResult = buildHypothesisTracker(contradictOnly)

    expect(supportResult[0].score).toBeGreaterThan(contradictResult[0].score)
  })

  it('returns hypotheses sorted by score descending', () => {
    // Add an item with contradicting evidence for hashimotos to lower its score
    const mixedItems = [
      ...sampleItems,
      {
        finding: 'Normal thyroid ultrasound',
        source_table: 'imaging_studies',
        source_date: '2026-04-12',
        supports_hypothesis: 'hashimotos',
        is_supporting: false,
        clinical_weight: 3.0,
        fdr_corrected: true,
        meets_criteria_rule: true,
        is_anchored: false,
      },
    ]

    const hypotheses = buildHypothesisTracker(mixedItems)

    for (let i = 0; i < hypotheses.length - 1; i++) {
      expect(hypotheses[i].score).toBeGreaterThanOrEqual(hypotheses[i + 1].score)
    }
  })

  it('sets confidence category correctly based on computed score', () => {
    const hypotheses = buildHypothesisTracker(sampleItems)

    for (const h of hypotheses) {
      if (h.score >= 80) expect(h.confidence).toBe('ESTABLISHED')
      else if (h.score >= 60) expect(h.confidence).toBe('PROBABLE')
      else if (h.score >= 40) expect(h.confidence).toBe('POSSIBLE')
      else if (h.score >= 20) expect(h.confidence).toBe('SPECULATIVE')
      else expect(h.confidence).toBe('INSUFFICIENT')
    }
  })

  it('applies DATA_RELIABILITY weights from source_table', () => {
    const hypotheses = buildHypothesisTracker(sampleItems)

    const hashimotos = hypotheses.find((h) => h.name === 'hashimotos')!

    // lab_results evidence should have source_reliability 1.0
    const labEvidence = hashimotos.supporting_evidence.find(
      (e) => e.source_table === 'lab_results',
    )!
    expect(labEvidence.source_reliability).toBe(DATA_RELIABILITY['lab_results'])

    // daily_logs evidence should have source_reliability 0.6
    const logEvidence = hashimotos.supporting_evidence.find(
      (e) => e.source_table === 'daily_logs',
    )!
    expect(logEvidence.source_reliability).toBe(DATA_RELIABILITY['daily_logs'])
  })

  it('sets direction to stable by default', () => {
    const hypotheses = buildHypothesisTracker(sampleItems)
    for (const h of hypotheses) {
      expect(h.direction).toBe('stable')
    }
  })

  it('sets hypothesis_id from the hypothesis name', () => {
    const hypotheses = buildHypothesisTracker(sampleItems)
    for (const h of hypotheses) {
      expect(h.hypothesis_id).toBe(h.name)
    }
  })
})
