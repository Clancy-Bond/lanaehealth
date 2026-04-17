import { describe, it, expect } from 'vitest'
import {
  NUTRITION_COACH_PERSONA,
  NUTRITION_COACH_STATIC_PROMPT,
  NUTRITION_COACH_SUBJECT,
  NUTRITION_COACH_MAX_TOKENS,
  NUTRITION_COACH_MODEL,
  looksNutritionRelevant,
} from '@/lib/personas/nutrition-coach'

/**
 * These tests lock in the voice rules at build time. If a future edit
 * drifts the persona toward diet prescriptions or shame framing, the
 * tests fail before the change ships. The banned-phrase list mirrors
 * docs/plans/2026-04-16-non-shaming-voice-rule.md.
 */

describe('nutrition-coach persona identity', () => {
  it('exports a stable subject tag for chat_messages filtering', () => {
    expect(NUTRITION_COACH_SUBJECT).toBe('nutrition_coach')
    expect(NUTRITION_COACH_PERSONA.subject).toBe('nutrition_coach')
  })

  it('points at the current Claude sonnet id used by /chat', () => {
    // Must match the main /chat route's model to keep prompt-cache prefixes
    // interoperable and to keep token budget behavior consistent.
    expect(NUTRITION_COACH_MODEL).toBe('claude-sonnet-4-6')
    expect(NUTRITION_COACH_PERSONA.model).toBe('claude-sonnet-4-6')
  })

  it('caps max tokens in a reasonable band', () => {
    expect(NUTRITION_COACH_MAX_TOKENS).toBeGreaterThanOrEqual(800)
    expect(NUTRITION_COACH_MAX_TOKENS).toBeLessThanOrEqual(4096)
  })

  it('bundles the static prompt into the persona object unchanged', () => {
    expect(NUTRITION_COACH_PERSONA.staticPrompt).toBe(NUTRITION_COACH_STATIC_PROMPT)
  })
})

describe('nutrition-coach voice rule compliance', () => {
  const prompt = NUTRITION_COACH_STATIC_PROMPT.toLowerCase()

  it('bans diet prescriptions by name', () => {
    expect(prompt).toMatch(/no diet prescriptions/)
    // Explicitly calls out keto so the 2021 Flo lawsuit pattern can never
    // re-emerge by accident.
    expect(prompt).toMatch(/keto/)
  })

  it('enforces observation-not-diagnosis framing', () => {
    expect(prompt).toMatch(/observation/)
    expect(prompt).toMatch(/never diagnosis|not diagnosis/)
  })

  it('bans weight-loss framing', () => {
    expect(prompt).toMatch(/weight-loss|weight loss/)
    // The word appears in the guardrail context, confirm it is a BAN not
    // an instruction to discuss weight loss.
    expect(prompt).toMatch(/no weight-loss|no weight loss|not diagnosis/)
  })

  it('explicitly bans shame words', () => {
    expect(prompt).toMatch(/no shame/)
    for (const banned of ['missed', 'failed', 'forgot', 'streak']) {
      expect(prompt).toContain(banned)
    }
  })

  it('requires source citations', () => {
    expect(prompt).toMatch(/cite/)
    expect(prompt).toMatch(/sources/)
  })

  it('sets a scope guardrail so off-topic questions get redirected', () => {
    expect(prompt).toMatch(/scope/)
    expect(prompt).toMatch(/nutrition coach|nutrition only/)
  })

  it('includes cycle awareness without forcing fertility framing', () => {
    expect(prompt).toMatch(/cycle/)
    expect(prompt).toMatch(/never pressure fertility|no weight-loss|no weight loss/)
  })

  it('includes a clinical handoff escalation for severe symptoms', () => {
    expect(prompt).toMatch(/clinical handoff/)
    expect(prompt).toMatch(/care team|clinician/)
  })
})

describe('looksNutritionRelevant keyword gate', () => {
  it('accepts clearly nutrition-related questions', () => {
    const examples = [
      'Why am I so bloated after pasta?',
      'How much iron am I getting from my meals this week?',
      'Is my protein intake low during my luteal phase?',
      'Should I salt my water for POTS?',
      'What snacks do I eat most often?',
    ]
    for (const e of examples) {
      expect(looksNutritionRelevant(e)).toBe(true)
    }
  })

  it('flags clearly off-topic questions', () => {
    const offTopic = [
      'What are my hypotheses right now?',
      'Book me an appointment with my PCP',
      'What is the capital of France?',
    ]
    for (const q of offTopic) {
      expect(looksNutritionRelevant(q)).toBe(false)
    }
  })

  it('is case-insensitive', () => {
    expect(looksNutritionRelevant('IRON intake?')).toBe(true)
    expect(looksNutritionRelevant('PROTEIN today')).toBe(true)
  })
})
