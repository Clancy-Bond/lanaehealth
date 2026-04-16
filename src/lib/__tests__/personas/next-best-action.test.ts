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
  NEXT_BEST_ACTION_DEFINITION,
  parseActions,
} from '@/lib/intelligence/personas/next-best-action'

// ===========================================================================
// parseActions
// ===========================================================================

describe('parseActions', () => {
  it('parses well-formatted action list with pipe-delimited fields', () => {
    const raw = `Some preamble text.

ACTIONS:

1. Order ferritin + iron panel | Affects: iron_deficiency, fatigue_syndrome | Potential swing: +15 points | Difficulty: low | Urgency: soon
   Rationale: Ferritin below 30 in premenopausal women suggests iron deficiency even without anemia. This is the cheapest, easiest test to rule in/out.
2. 10-minute active standing test with HR/BP | Affects: pots_dysautonomia | Potential swing: +20 points | Difficulty: low | Urgency: urgent
   Rationale: Standing HR already 106 vs resting 48 (delta 58). A formal test would confirm POTS diagnosis per current criteria.
3. Anti-TPO + anti-thyroglobulin antibodies | Affects: hashimotos | Potential swing: +25 points | Difficulty: low | Urgency: routine
   Rationale: TSH 5.1 is borderline. Antibodies would differentiate autoimmune thyroiditis from non-autoimmune subclinical hypothyroidism.

APPOINTMENT_BRIEFS:
### Cardiology - 2026-08-17
- Key data to bring: Standing pulse 106, resting 48
- Questions to ask: Is tilt table test warranted?
- Tests to request: Active standing test
- Hypothesis context: POTS dysautonomia

FINDINGS:
- Three high-yield actions identified
DATA_QUALITY:
Good data coverage for most hypotheses
DELTA:
New actions prioritized based on updated hypothesis scores
HANDOFF:
Synthesizer should prioritize: iron panel results, standing test, and antibody panel`

    const actions = parseActions(raw)

    expect(actions).toHaveLength(3)

    expect(actions[0].action).toBe('Order ferritin + iron panel')
    expect(actions[0].affects).toEqual(['iron_deficiency', 'fatigue_syndrome'])
    expect(actions[0].potentialSwing).toBe('+15 points')
    expect(actions[0].difficulty).toBe('low')
    expect(actions[0].urgency).toBe('soon')
    expect(actions[0].rationale).toContain('Ferritin below 30')

    expect(actions[1].action).toBe('10-minute active standing test with HR/BP')
    expect(actions[1].affects).toEqual(['pots_dysautonomia'])
    expect(actions[1].potentialSwing).toBe('+20 points')
    expect(actions[1].difficulty).toBe('low')
    expect(actions[1].urgency).toBe('urgent')
    expect(actions[1].rationale).toContain('Standing HR already 106')

    expect(actions[2].action).toBe('Anti-TPO + anti-thyroglobulin antibodies')
    expect(actions[2].affects).toEqual(['hashimotos'])
    expect(actions[2].potentialSwing).toBe('+25 points')
    expect(actions[2].difficulty).toBe('low')
    expect(actions[2].urgency).toBe('routine')
  })

  it('returns empty array when no ACTIONS section', () => {
    const raw = `FINDINGS:
- Some findings here
DATA_QUALITY:
Good
DELTA:
Nothing new
HANDOFF:
Pass to next persona`

    const actions = parseActions(raw)
    expect(actions).toEqual([])
  })

  it('handles actions without rationale line', () => {
    const raw = `ACTIONS:

1. Order CBC | Affects: anemia | Potential swing: +10 points | Difficulty: low | Urgency: routine
2. Thyroid ultrasound | Affects: hashimotos, thyroid_nodule | Potential swing: +15 points | Difficulty: medium | Urgency: soon

FINDINGS:
- Two actions identified`

    const actions = parseActions(raw)

    expect(actions).toHaveLength(2)

    expect(actions[0].action).toBe('Order CBC')
    expect(actions[0].affects).toEqual(['anemia'])
    expect(actions[0].rationale).toBe('')

    expect(actions[1].action).toBe('Thyroid ultrasound')
    expect(actions[1].affects).toEqual(['hashimotos', 'thyroid_nodule'])
    expect(actions[1].rationale).toBe('')
  })
})

// ===========================================================================
// NEXT_BEST_ACTION_DEFINITION
// ===========================================================================

describe('NEXT_BEST_ACTION_DEFINITION', () => {
  it("name is 'next_best_action'", () => {
    expect(NEXT_BEST_ACTION_DEFINITION.name).toBe('next_best_action')
  })

  it("requiresHandoffFrom is 'research_librarian'", () => {
    expect(NEXT_BEST_ACTION_DEFINITION.requiresHandoffFrom).toBe('research_librarian')
  })

  it("systemPrompt contains 'uncertainty' and 'ACTIONS'", () => {
    const prompt = NEXT_BEST_ACTION_DEFINITION.systemPrompt
    expect(prompt).toContain('uncertainty')
    expect(prompt).toContain('ACTIONS')
  })
})
