// ---------------------------------------------------------------------------
// Topic Detection -- regression tests for dizziness keyword mapping
//
// Ensures dizziness-related queries route to the cv_orthostatic and
// neuro_presyncope micro-summaries so Claude receives the relevant context.
// See: docs/qa/2026-04-16-dizziness-topic-mapping.md
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest'

// Mock supabase to avoid needing env vars for pure-function detection tests
vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
  supabase: {},
}))

// Mock Anthropic SDK -- not called by detectRelevantTopics
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

import { detectRelevantTopics } from '@/lib/context/summary-engine'

describe('detectRelevantTopics -- dizziness keyword mapping', () => {
  it('matches cv_orthostatic and neuro_presyncope for "I felt dizzy when I stood up"', () => {
    const topics = detectRelevantTopics('I felt dizzy when I stood up')
    expect(topics).toContain('cv_orthostatic')
    expect(topics).toContain('neuro_presyncope')
  })

  it('matches both topics for "lightheadedness worse in heat"', () => {
    const topics = detectRelevantTopics('lightheadedness worse in heat')
    expect(topics).toContain('cv_orthostatic')
    expect(topics).toContain('neuro_presyncope')
  })

  it('matches both topics for "dizziness" alone', () => {
    const topics = detectRelevantTopics('dizziness')
    expect(topics).toContain('cv_orthostatic')
    expect(topics).toContain('neuro_presyncope')
  })

  it('matches both topics for "presyncope episode yesterday"', () => {
    const topics = detectRelevantTopics('presyncope episode yesterday')
    expect(topics).toContain('cv_orthostatic')
    expect(topics).toContain('neuro_presyncope')
  })

  it('matches both topics for "near-faint while standing"', () => {
    const topics = detectRelevantTopics('near-faint while standing')
    expect(topics).toContain('cv_orthostatic')
    expect(topics).toContain('neuro_presyncope')
  })

  it('does not match either topic for unrelated "no symptoms today"', () => {
    const topics = detectRelevantTopics('no symptoms today')
    expect(topics).not.toContain('cv_orthostatic')
    expect(topics).not.toContain('neuro_presyncope')
  })

  it('matches neuro_presyncope for actual syncope "I fainted at work"', () => {
    // neuro_presyncope is explicitly named "Presyncope and Syncope Episodes"
    // so real syncope queries must also route here. Presyncope and syncope are
    // a single symptom spectrum clinically; separating them would orphan
    // syncope queries with no destination topic.
    const topics = detectRelevantTopics('I fainted at work')
    expect(topics).toContain('neuro_presyncope')
  })
})
