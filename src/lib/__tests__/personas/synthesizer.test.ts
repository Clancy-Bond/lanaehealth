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
  SYNTHESIZER_DEFINITION,
  parseUrgentFindings,
  parseTopInsights,
  parseConsolidatedSummary,
} from '@/lib/intelligence/personas/synthesizer'

// ===========================================================================
// parseUrgentFindings
// ===========================================================================

describe('parseUrgentFindings', () => {
  it('parses urgent items from formatted output', () => {
    const raw = `CONTRADICTIONS:
- Analyst noted fatigue improving but doctor persona noted worsening. Raw HRV data confirms declining trend. Resolution: fatigue is worsening.

URGENT:
- Standing heart rate of 106 bpm with resting rate of 48 bpm suggests possible POTS. Cardiology referral recommended.
- TSH 5.1 with rising trend needs monitoring; consider thyroid antibody panel.

TOP_INSIGHTS:
1. Something
2. Something else
3. Third thing

CONSOLIDATED_SUMMARY:
A summary goes here.

FINDINGS:
- Synthesis complete
DATA_QUALITY:
Good coverage
DELTA:
New urgent findings flagged
HANDOFF:
Next cycle should monitor TSH trend`

    const urgent = parseUrgentFindings(raw)

    expect(urgent).toHaveLength(2)
    expect(urgent[0]).toContain('Standing heart rate of 106 bpm')
    expect(urgent[1]).toContain('TSH 5.1')
  })

  it('returns empty array when "No urgent findings"', () => {
    const raw = `CONTRADICTIONS:
- None

URGENT:
- No urgent findings

TOP_INSIGHTS:
1. Insight one

CONSOLIDATED_SUMMARY:
Summary here.

FINDINGS:
- Done
DATA_QUALITY:
Good
DELTA:
Nothing urgent
HANDOFF:
Continue monitoring`

    const urgent = parseUrgentFindings(raw)
    expect(urgent).toEqual([])
  })

  it('returns empty array when no URGENT section', () => {
    const raw = `CONTRADICTIONS:
- None

TOP_INSIGHTS:
1. Something

CONSOLIDATED_SUMMARY:
Summary.

FINDINGS:
- Done
DATA_QUALITY:
Good
DELTA:
Nothing
HANDOFF:
Next cycle`

    const urgent = parseUrgentFindings(raw)
    expect(urgent).toEqual([])
  })
})

// ===========================================================================
// parseTopInsights
// ===========================================================================

describe('parseTopInsights', () => {
  it('parses numbered insights', () => {
    const raw = `CONTRADICTIONS:
- None

URGENT:
- None

TOP_INSIGHTS:
1. Iron deficiency is the most likely cause of fatigue based on ferritin levels and symptom pattern.
2. Standing heart rate data strongly supports POTS diagnosis per current diagnostic criteria.
3. Thyroid function is borderline and trending upward, warranting antibody testing.

CONSOLIDATED_SUMMARY:
Summary goes here.

FINDINGS:
- Complete
DATA_QUALITY:
Good
DELTA:
Updated
HANDOFF:
Next`

    const insights = parseTopInsights(raw)

    expect(insights).toHaveLength(3)
    expect(insights[0]).toContain('Iron deficiency')
    expect(insights[1]).toContain('Standing heart rate')
    expect(insights[2]).toContain('Thyroid function')
  })

  it('returns up to 3 items', () => {
    const raw = `TOP_INSIGHTS:
1. First insight
2. Second insight
3. Third insight
4. Fourth insight that should be excluded
5. Fifth insight also excluded

CONSOLIDATED_SUMMARY:
Summary.`

    const insights = parseTopInsights(raw)
    expect(insights).toHaveLength(3)
    expect(insights[0]).toContain('First insight')
    expect(insights[2]).toContain('Third insight')
  })
})

// ===========================================================================
// parseConsolidatedSummary
// ===========================================================================

describe('parseConsolidatedSummary', () => {
  it('extracts summary text between markers', () => {
    const raw = `CONTRADICTIONS:
- None

URGENT:
- None

TOP_INSIGHTS:
1. Insight one

CONSOLIDATED_SUMMARY:
The patient is a 24-year-old female presenting with a complex multi-system picture involving fatigue, orthostatic intolerance, and borderline thyroid dysfunction. Oura biometric data shows declining HRV trends over the past 90 days, correlating with reported fatigue severity. The standing heart rate of 106 bpm against a resting rate of 48 bpm represents a delta of 58, exceeding the 30 bpm threshold for POTS diagnosis.

FINDINGS:
- Synthesis complete
DATA_QUALITY:
Good
DELTA:
Updated
HANDOFF:
Next cycle`

    const summary = parseConsolidatedSummary(raw)

    expect(summary).toContain('24-year-old female')
    expect(summary).toContain('POTS diagnosis')
    // Should not include markers from other sections
    expect(summary).not.toContain('FINDINGS:')
    expect(summary).not.toContain('DATA_QUALITY:')
  })

  it('returns empty string when not found', () => {
    const raw = `CONTRADICTIONS:
- None

URGENT:
- None

TOP_INSIGHTS:
1. Something

FINDINGS:
- Done
DATA_QUALITY:
Good
DELTA:
Nothing
HANDOFF:
Next`

    const summary = parseConsolidatedSummary(raw)
    expect(summary).toBe('')
  })
})

// ===========================================================================
// SYNTHESIZER_DEFINITION
// ===========================================================================

describe('SYNTHESIZER_DEFINITION', () => {
  it("name is 'synthesizer'", () => {
    expect(SYNTHESIZER_DEFINITION.name).toBe('synthesizer')
  })

  it("requiresHandoffFrom is 'next_best_action'", () => {
    expect(SYNTHESIZER_DEFINITION.requiresHandoffFrom).toBe('next_best_action')
  })

  it("systemPrompt contains 'contradictions' and 'URGENT'", () => {
    const prompt = SYNTHESIZER_DEFINITION.systemPrompt
    expect(prompt.toLowerCase()).toContain('contradictions')
    expect(prompt).toContain('URGENT')
  })
})
