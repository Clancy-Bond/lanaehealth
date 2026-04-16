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
  RESEARCH_LIBRARIAN_DEFINITION,
  parseStudyCards,
} from '@/lib/intelligence/personas/research-librarian'

// ===========================================================================
// parseStudyCards
// ===========================================================================

describe('parseStudyCards', () => {
  it('parses well-formatted study cards', () => {
    const raw = `Some preamble text.

STUDY_CARDS:

STUDY: Effect of POTS on Quality of Life in Young Women
TYPE: Cohort
SAMPLE: n=245
JOURNAL: Autonomic Neuroscience
EVIDENCE_GRADE: B
RELEVANCE: Directly applicable to patient's age group and symptoms
HYPOTHESIS_IMPACT: Supports pots_dysautonomia hypothesis because standing HR delta >30bpm is diagnostic

STUDY: TSH Reference Ranges in Young Adults
TYPE: Meta-analysis
SAMPLE: n=12000
JOURNAL: Thyroid
EVIDENCE_GRADE: A
RELEVANCE: Patient's TSH 5.1 falls in the borderline zone for subclinical hypothyroidism
HYPOTHESIS_IMPACT: Supports hashimotos hypothesis because narrower reference range suggests subclinical disease

GUIDELINE_ALERTS:
Some guideline text here.

FINDINGS:
- Found 2 relevant studies
DATA_QUALITY:
Good quality evidence available
DELTA:
New literature search completed
HANDOFF:
Completeness Checker should verify all literature is accounted for`

    const cards = parseStudyCards(raw)

    expect(cards).toHaveLength(2)

    expect(cards[0].title).toBe('Effect of POTS on Quality of Life in Young Women')
    expect(cards[0].type).toBe('Cohort')
    expect(cards[0].sample).toBe('n=245')
    expect(cards[0].journal).toBe('Autonomic Neuroscience')
    expect(cards[0].evidence_grade).toBe('B')
    expect(cards[0].relevance).toContain('age group')
    expect(cards[0].hypothesis_impact).toContain('pots_dysautonomia')

    expect(cards[1].title).toBe('TSH Reference Ranges in Young Adults')
    expect(cards[1].type).toBe('Meta-analysis')
    expect(cards[1].sample).toBe('n=12000')
    expect(cards[1].journal).toBe('Thyroid')
    expect(cards[1].evidence_grade).toBe('A')
  })

  it('returns empty array when no STUDY_CARDS section', () => {
    const raw = `FINDINGS:
- Some findings here
DATA_QUALITY:
Good
DELTA:
Nothing new
HANDOFF:
Pass to next persona`

    const cards = parseStudyCards(raw)
    expect(cards).toEqual([])
  })

  it('handles partial/malformed cards gracefully', () => {
    const raw = `STUDY_CARDS:

STUDY: Complete Card With All Fields
TYPE: RCT
SAMPLE: n=500
JOURNAL: NEJM
EVIDENCE_GRADE: A
RELEVANCE: Highly relevant
HYPOTHESIS_IMPACT: Supports hypothesis X

STUDY: Partial Card Missing Some Fields
TYPE: Case series
JOURNAL: Some Journal

STUDY: Another Partial Card
EVIDENCE_GRADE: C

FINDINGS:
Summary here`

    const cards = parseStudyCards(raw)

    // Should parse all three cards, filling missing fields with empty strings
    expect(cards).toHaveLength(3)

    // First card is complete
    expect(cards[0].title).toBe('Complete Card With All Fields')
    expect(cards[0].type).toBe('RCT')
    expect(cards[0].sample).toBe('n=500')
    expect(cards[0].journal).toBe('NEJM')
    expect(cards[0].evidence_grade).toBe('A')

    // Second card has partial fields
    expect(cards[1].title).toBe('Partial Card Missing Some Fields')
    expect(cards[1].type).toBe('Case series')
    expect(cards[1].journal).toBe('Some Journal')
    expect(cards[1].sample).toBe('')
    expect(cards[1].evidence_grade).toBe('')
    expect(cards[1].relevance).toBe('')
    expect(cards[1].hypothesis_impact).toBe('')

    // Third card has only evidence grade
    expect(cards[2].title).toBe('Another Partial Card')
    expect(cards[2].evidence_grade).toBe('C')
    expect(cards[2].type).toBe('')
  })
})

// ===========================================================================
// RESEARCH_LIBRARIAN_DEFINITION
// ===========================================================================

describe('RESEARCH_LIBRARIAN_DEFINITION', () => {
  it("name is 'research_librarian'", () => {
    expect(RESEARCH_LIBRARIAN_DEFINITION.name).toBe('research_librarian')
  })

  it("requiresHandoffFrom is 'challenger'", () => {
    expect(RESEARCH_LIBRARIAN_DEFINITION.requiresHandoffFrom).toBe('challenger')
  })

  it("systemPrompt contains 'literature' and 'EVIDENCE_GRADE'", () => {
    const prompt = RESEARCH_LIBRARIAN_DEFINITION.systemPrompt
    expect(prompt).toContain('literature')
    expect(prompt).toContain('EVIDENCE_GRADE')
  })
})
