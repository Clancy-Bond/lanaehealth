import { describe, it, expect, vi } from 'vitest'

// Mock supabase to avoid needing env vars for pure-function tests
vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
  supabase: {},
}))

// Mock Anthropic SDK -- not needed for parseHandoff tests
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}))

import { parseHandoff } from '@/lib/intelligence/persona-runner'

describe('parseHandoff', () => {
  it('parses a well-formatted output with all 4 sections', () => {
    const raw = `FINDINGS:
- TSH rising from 5.1 to 6.2
- Fatigue scores increasing over 6 weeks
- Cycle length extending to 34 days

DATA_QUALITY: 85% Oura coverage, 45% food diary coverage

DELTA: TSH trajectory changed from stable to rising

HANDOFF: Hypothesis Doctor should evaluate thyroid function trajectory and correlate with fatigue trend`

    const result = parseHandoff(raw)

    expect(result).not.toBeNull()
    expect(result!.findings).toEqual([
      'TSH rising from 5.1 to 6.2',
      'Fatigue scores increasing over 6 weeks',
      'Cycle length extending to 34 days',
    ])
    expect(result!.data_quality).toBe(
      '85% Oura coverage, 45% food diary coverage',
    )
    expect(result!.delta).toBe(
      'TSH trajectory changed from stable to rising',
    )
    expect(result!.handoff_message).toBe(
      'Hypothesis Doctor should evaluate thyroid function trajectory and correlate with fatigue trend',
    )
    // persona is set by the caller, not by parseHandoff
    expect(result!.persona).toBe('')
  })

  it('returns null when no markers found', () => {
    const raw = `This is just some free-form text without any section markers.
It has multiple lines but none of them match the expected format.`

    const result = parseHandoff(raw)
    expect(result).toBeNull()
  })

  it('handles multi-line FINDINGS correctly', () => {
    const raw = `FINDINGS:
- First finding spans
  across two lines
- Second finding is simple
- Third finding also has
  continuation text here
  and even more

DATA_QUALITY: 70% coverage

DELTA: no change

HANDOFF: pass to next persona`

    const result = parseHandoff(raw)

    expect(result).not.toBeNull()
    expect(result!.findings).toHaveLength(3)
    expect(result!.findings[0]).toBe('First finding spans across two lines')
    expect(result!.findings[1]).toBe('Second finding is simple')
    expect(result!.findings[2]).toBe(
      'Third finding also has continuation text here and even more',
    )
  })

  it('handles missing optional sections gracefully (no DELTA)', () => {
    const raw = `FINDINGS:
- Single important finding

DATA_QUALITY: 90% lab coverage

HANDOFF: Continue analysis with available data`

    const result = parseHandoff(raw)

    expect(result).not.toBeNull()
    expect(result!.findings).toEqual(['Single important finding'])
    expect(result!.data_quality).toBe('90% lab coverage')
    expect(result!.delta).toBe('')
    expect(result!.handoff_message).toBe(
      'Continue analysis with available data',
    )
  })
})
