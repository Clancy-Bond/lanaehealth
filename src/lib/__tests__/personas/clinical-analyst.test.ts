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

import { CLINICAL_ANALYST_DEFINITION } from '@/lib/intelligence/personas/clinical-analyst'

describe('CLINICAL_ANALYST_DEFINITION', () => {
  it('has the correct name', () => {
    expect(CLINICAL_ANALYST_DEFINITION.name).toBe('clinical_analyst')
  })

  it('has the correct displayName', () => {
    expect(CLINICAL_ANALYST_DEFINITION.displayName).toBe('Clinical Analyst')
  })

  it('has a systemPrompt containing IFM and structured handoff markers', () => {
    const prompt = CLINICAL_ANALYST_DEFINITION.systemPrompt
    expect(prompt).toContain('IFM')
    expect(prompt).toContain('FINDINGS')
    expect(prompt).toContain('HANDOFF')
  })

  it('does not require a handoff from a previous persona (first in pipeline)', () => {
    expect(CLINICAL_ANALYST_DEFINITION.requiresHandoffFrom).toBeUndefined()
  })
})
