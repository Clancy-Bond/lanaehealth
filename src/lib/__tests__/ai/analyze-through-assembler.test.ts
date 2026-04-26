/**
 * Tests that src/lib/ai/analyze.ts routes every Claude API call through the
 * Context Assembler (`getFullSystemPrompt`). This enforces the project rule:
 *
 *   "Every Claude API call goes through the Context Assembler" (CLAUDE.md)
 *
 * The assembler guarantees:
 *   - STATIC system prompt (identity, SELF-DISTRUST) lands first
 *   - __SYSTEM_PROMPT_DYNAMIC_BOUNDARY__ marker before dynamic context
 *   - Layer 1 (permanent core) + Layer 2 (summaries) + Layer 3 (retrieval)
 *
 * Regression guard: the previous implementation passed raw SYSTEM_PROMPTS[type]
 * straight to `messages.create({ system: ... })`, skipping all of the above.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const STATIC_PART = 'ASSEMBLED_SYSTEM_PROMPT'
const DYNAMIC_PART = '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__\n\n<patient_context>core</patient_context>'
const ASSEMBLED_SYSTEM = [
  { type: 'text' as const, text: STATIC_PART, cache_control: { type: 'ephemeral' as const } },
  { type: 'text' as const, text: DYNAMIC_PART },
]

const assemblerCalls: Array<{ query: string; options: unknown }> = []
const messagesCreateCalls: Array<{
  system: unknown
  messages: Array<{ role: string; content: string }>
  model: string
  max_tokens: number
}> = []

vi.mock('@/lib/context/assembler', () => ({
  getFullSystemPromptCached: vi.fn(async (query: string, options: unknown) => {
    assemblerCalls.push({ query, options })
    return {
      system: ASSEMBLED_SYSTEM,
      tokenEstimate: 1234,
      charCount: STATIC_PART.length + DYNAMIC_PART.length,
      sections: { permanentCore: 'core', handoff: null, summaries: [], retrieval: null },
    }
  }),
}))

// Mock Anthropic SDK so no live API call is made.
class MockAnthropic {
  messages = {
    create: async (params: {
      system: unknown
      messages: Array<{ role: string; content: string }>
      model: string
      max_tokens: number
    }) => {
      messagesCreateCalls.push({
        system: params.system,
        messages: params.messages,
        model: params.model,
        max_tokens: params.max_tokens,
      })
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ findings: [] }),
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      }
    },
  }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}))

// Mock cache layer so it always returns no cached result and succeeds on writes.
vi.mock('@/lib/ai/cache', () => ({
  getCachedAnalysis: vi.fn(async () => null),
  createAnalysisRun: vi.fn(async () => 'run-id-123'),
  saveAnalysisResults: vi.fn(async () => undefined),
  failAnalysisRun: vi.fn(async () => undefined),
}))

// Mock supabase so the savedFindings fetch after save is inert.
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
  supabase: {},
}))

// Mock data-prep so context preparation does not touch database shapes.
vi.mock('@/lib/ai/data-prep', () => ({
  prepareAnalysisContext: vi.fn(() => ({
    patientSummary: { stub: 'patient' },
    labSummary: { stub: 'labs' },
    biometricSummary: { stub: 'biometrics' },
    cycleSummary: { stub: 'cycle' },
    apiEvidence: {},
  })),
  computeInputHash: vi.fn(() => 'hash-stub'),
}))

beforeEach(() => {
  assemblerCalls.length = 0
  messagesCreateCalls.length = 0
  process.env.ANTHROPIC_API_KEY = 'test-key'
  // OWNER_USER_ID is the legacy single-tenant fallback that
  // runFullAnalysis uses when no explicit userId is passed.
  process.env.OWNER_USER_ID = '11111111-1111-1111-1111-111111111111'
})

// ── Tests ──────────────────────────────────────────────────────────

describe('runFullAnalysis routes every Claude call through Context Assembler', () => {
  it('calls getFullSystemPrompt once per analysis type (single-type run)', async () => {
    const { runFullAnalysis } = await import('@/lib/ai/analyze')

    await runFullAnalysis(
      {
        symptoms: [],
        biometrics: [],
        labs: [],
        cycleEntries: [],
        healthProfile: {},
      } as never,
      {},
      'diagnostic',
    )

    // One analysis type -> one assembler call -> one messages.create call
    expect(assemblerCalls.length).toBe(1)
    expect(messagesCreateCalls.length).toBe(1)
  })

  it('passes the assembler-produced system array as the `system` param', async () => {
    const { runFullAnalysis } = await import('@/lib/ai/analyze')

    await runFullAnalysis(
      {
        symptoms: [],
        biometrics: [],
        labs: [],
        cycleEntries: [],
        healthProfile: {},
      } as never,
      {},
      'biomarker',
    )

    expect(messagesCreateCalls.length).toBe(1)
    const system = messagesCreateCalls[0].system as typeof ASSEMBLED_SYSTEM
    expect(Array.isArray(system)).toBe(true)
    expect(system).toEqual(ASSEMBLED_SYSTEM)
    // Second block carries the static/dynamic boundary marker.
    expect(system[1].text).toContain('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__')
  })

  it('user message carries BOTH the analysis-prompt head AND the pipeline evidence', async () => {
    const { runFullAnalysis } = await import('@/lib/ai/analyze')

    await runFullAnalysis(
      {
        symptoms: [],
        biometrics: [],
        labs: [],
        cycleEntries: [],
        healthProfile: {},
      } as never,
      {},
      'pathway',
    )

    expect(messagesCreateCalls.length).toBe(1)
    const userContent = messagesCreateCalls[0].messages[0].content

    // Analysis-type prompt head is present (pathway prompt starts with this string).
    expect(userContent).toContain('molecular biology expert')
    // Pipeline evidence is present (from the mocked prepareAnalysisContext).
    expect(userContent).toContain('pipeline_evidence')
    expect(userContent).toContain('patient')
  })

  it('uses includeAllSummaries for diagnostic runs (doctor mode)', async () => {
    const { runFullAnalysis } = await import('@/lib/ai/analyze')

    await runFullAnalysis(
      {
        symptoms: [],
        biometrics: [],
        labs: [],
        cycleEntries: [],
        healthProfile: {},
      } as never,
      {},
      'diagnostic',
    )

    expect(assemblerCalls.length).toBe(1)
    expect(assemblerCalls[0].options).toMatchObject({ includeAllSummaries: true })
  })

  it('calls assembler for a full 7-analysis run (full pipeline)', async () => {
    const { runFullAnalysis } = await import('@/lib/ai/analyze')

    await runFullAnalysis(
      {
        symptoms: [],
        biometrics: [],
        labs: [],
        cycleEntries: [],
        healthProfile: {},
      } as never,
      {},
      'full',
    )

    // Full pipeline fans out to 7 analysis types, each of which must go
    // through the assembler.
    expect(assemblerCalls.length).toBe(7)
    expect(messagesCreateCalls.length).toBe(7)

    // Every call must have the assembler system array, not a raw string.
    for (const call of messagesCreateCalls) {
      expect(Array.isArray(call.system)).toBe(true)
      expect(call.system).toEqual(ASSEMBLED_SYSTEM)
      const arr = call.system as typeof ASSEMBLED_SYSTEM
      expect(arr[1].text).toContain('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__')
    }
  })
})
