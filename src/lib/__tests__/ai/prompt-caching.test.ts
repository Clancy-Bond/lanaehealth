/**
 * Prompt-caching regression test.
 *
 * LanaeHealth's CLAUDE.md specifies a static/dynamic boundary pattern where
 * the static prefix is "cached, essentially free after first API call". To
 * realize that promise, every Claude call site must:
 *
 *   1. Pass `system` as an ARRAY of content blocks, not a string.
 *   2. Mark the FIRST (static) block with `cache_control.type === 'ephemeral'`.
 *   3. Leave the SECOND (dynamic) block WITHOUT a cache_control so it stays
 *      fresh per call.
 *
 * These tests exercise the cached assembler helper and the analyze.ts call
 * site to verify the shape. They also sanity-check the shared cache-metrics
 * helper that logs `cache_read_input_tokens` / `cache_creation_input_tokens`.
 *
 * No live Claude API call: everything is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Shared mock state ──────────────────────────────────────────────

const systemsSeenByClaude: unknown[] = []
let lastResponse: unknown = null

class MockAnthropic {
  messages = {
    create: async (params: {
      system: unknown
      messages: Array<{ role: string; content: string }>
      model: string
      max_tokens: number
    }) => {
      systemsSeenByClaude.push(params.system)
      const resp = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ findings: [] }),
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 25,
          cache_creation_input_tokens: 700,
          cache_read_input_tokens: 0,
        },
      }
      lastResponse = resp
      return resp
    },
  }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}))

// Mock the DB-backed permanent-core and handoff loaders so the assembler
// can run without hitting Supabase. A single chain shape that resolves to
// { data: null, error: { message: ... } } covers every builder path used
// by the assembler and analyze.ts helpers during this test.
vi.mock('@/lib/supabase', () => {
  const noRows = { data: null, error: { message: 'no rows' } }
  const terminal = {
    single: async () => noRows,
    maybeSingle: async () => noRows,
    then: (resolve: (v: typeof noRows) => unknown) => Promise.resolve(resolve(noRows)),
  }
  const chain: Record<string, (..._: unknown[]) => typeof chain | typeof terminal> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => terminal,
  }
  return {
    createServiceClient: () => ({
      from: () => chain,
    }),
    supabase: {},
  }
})

vi.mock('@/lib/context/permanent-core', () => ({
  generatePermanentCore: vi.fn(async () => 'MOCK_PERMANENT_CORE'),
}))

vi.mock('@/lib/context/summary-engine', () => ({
  getSummary: vi.fn(async () => 'MOCK_SUMMARY_CONTENT'),
  detectRelevantTopics: vi.fn(() => [] as string[]),
}))

vi.mock('@/lib/context/vector-store', () => ({
  searchByText: vi.fn(async () => []),
}))

vi.mock('@/lib/intelligence/knowledge-base', () => ({
  loadRelevantKBContext: vi.fn(async () => ({
    text: '',
    tokenCount: 0,
    documentsLoaded: [] as string[],
  })),
}))

// Analyze-path mocks (cache, data-prep, savedFindings fetch).
vi.mock('@/lib/ai/cache', () => ({
  getCachedAnalysis: vi.fn(async () => null),
  createAnalysisRun: vi.fn(async () => 'run-id-999'),
  saveAnalysisResults: vi.fn(async () => undefined),
  failAnalysisRun: vi.fn(async () => undefined),
}))

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
  systemsSeenByClaude.length = 0
  lastResponse = null
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

// ── 1. getFullSystemPromptCached shape ─────────────────────────────

describe('getFullSystemPromptCached', () => {
  it('returns a two-block array with ephemeral cache_control on the static prefix', async () => {
    const { getFullSystemPromptCached, STATIC_SYSTEM_PROMPT } = await import(
      '@/lib/context/assembler'
    )

    const { system } = await getFullSystemPromptCached('What is my resting HR?')

    expect(Array.isArray(system)).toBe(true)
    expect(system.length).toBe(2)

    // First block: STATIC prefix, ephemeral cache.
    expect(system[0].type).toBe('text')
    expect(system[0].text).toBe(STATIC_SYSTEM_PROMPT)
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })

    // Second block: DYNAMIC context, NO cache_control (recomputed per call).
    expect(system[1].type).toBe('text')
    expect(system[1].cache_control).toBeUndefined()
    expect(system[1].text).toContain('__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__')
  })

  it('static block is identical across calls (cache key stability)', async () => {
    const { getFullSystemPromptCached } = await import('@/lib/context/assembler')

    const a = await getFullSystemPromptCached('question one')
    const b = await getFullSystemPromptCached('totally different question two')

    expect(a.system[0].text).toBe(b.system[0].text)
    expect(a.system[0].cache_control).toEqual(b.system[0].cache_control)
  })
})

// ── 2. splitSystemPromptForCaching helper ──────────────────────────

describe('splitSystemPromptForCaching', () => {
  it('splits a pre-assembled string on the boundary marker', async () => {
    const { splitSystemPromptForCaching } = await import('@/lib/context/assembler')

    const system = splitSystemPromptForCaching(
      'STATIC_HEADER\n\n__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__\n\nDYNAMIC_BODY',
    )

    expect(system.length).toBe(2)
    expect(system[0].text).toBe('STATIC_HEADER')
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(system[1].text).toContain('DYNAMIC_BODY')
    expect(system[1].cache_control).toBeUndefined()
  })

  it('falls back to a single cached block when the marker is missing', async () => {
    const { splitSystemPromptForCaching } = await import('@/lib/context/assembler')

    const system = splitSystemPromptForCaching('NO_MARKER_AT_ALL')

    expect(system.length).toBe(1)
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })
  })
})

// ── 3. analyze.ts passes the cached array to messages.create ───────

describe('analyze.ts routes cached system array to Claude', () => {
  it('passes system as an array, first block ephemeral, second block plain', async () => {
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

    expect(systemsSeenByClaude.length).toBe(1)
    const system = systemsSeenByClaude[0] as Array<{
      type: string
      text: string
      cache_control?: { type: 'ephemeral' }
    }>

    // 1. system is an array, not a string.
    expect(Array.isArray(system)).toBe(true)
    expect(typeof system).not.toBe('string')

    // 2. first element has cache_control.type === 'ephemeral'.
    expect(system[0].cache_control).toBeDefined()
    expect(system[0].cache_control?.type).toBe('ephemeral')

    // 3. second element has NO cache_control (dynamic portion).
    expect(system[1].cache_control).toBeUndefined()
  })
})

// ── 4. logCacheMetrics helper ──────────────────────────────────────

describe('logCacheMetrics', () => {
  it('emits a [cache_metrics ...] line when usage counters are present', async () => {
    const { logCacheMetrics } = await import('@/lib/ai/cache-metrics')

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logCacheMetrics(
      {
        usage: {
          input_tokens: 50,
          output_tokens: 10,
          cache_read_input_tokens: 700,
          cache_creation_input_tokens: 0,
        },
      },
      'test-label',
    )

    expect(spy).toHaveBeenCalledTimes(1)
    const line = spy.mock.calls[0][0] as string
    expect(line).toContain('[cache_metrics')
    expect(line).toContain('label=test-label')
    expect(line).toContain('cache_read_input_tokens=700')
    expect(line).toContain('cache_creation_input_tokens=0')

    spy.mockRestore()
  })

  it('is silent when response has no usage field', async () => {
    const { logCacheMetrics } = await import('@/lib/ai/cache-metrics')

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    logCacheMetrics(null, 'ignored')
    logCacheMetrics(undefined, 'ignored')
    logCacheMetrics({}, 'ignored')

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('hadCacheHit returns true only for positive cache reads', async () => {
    const { hadCacheHit } = await import('@/lib/ai/cache-metrics')

    expect(hadCacheHit({ usage: { cache_read_input_tokens: 500 } })).toBe(true)
    expect(hadCacheHit({ usage: { cache_read_input_tokens: 0 } })).toBe(false)
    expect(hadCacheHit({ usage: {} })).toBe(false)
    expect(hadCacheHit(null)).toBe(false)
    expect(hadCacheHit(undefined)).toBe(false)
  })
})

// Use `lastResponse` reference to avoid unused-binding lint noise under strict
// builds. The variable exists for future assertions (e.g., verifying that the
// test actually received the mock response shape).
export const __probe_last_response = () => lastResponse
