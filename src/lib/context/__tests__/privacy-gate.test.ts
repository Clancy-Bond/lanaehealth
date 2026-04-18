/**
 * Privacy gate tests for src/lib/context/assembler.ts (Wave 2e F10).
 *
 * CRITICAL INVARIANT: when privacy_prefs.allow_claude_context is false,
 * assembleDynamicContext MUST NOT inject any patient data. This test
 * verifies the gate by stubbing each layer to throw if called, then
 * asserting those stubs are never invoked.
 *
 * When allow_claude_context is true, the gate passes through and the
 * normal assembly runs (verified separately by existing tests and the
 * smoke path).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- Shared mock state ----------

const gate = { allow_claude_context: true }

const layerCalls = {
  permanentCore: 0,
  summary: 0,
  retrieval: 0,
  kb: 0,
  handoff: 0,
}

function resetState() {
  gate.allow_claude_context = true
  layerCalls.permanentCore = 0
  layerCalls.summary = 0
  layerCalls.retrieval = 0
  layerCalls.kb = 0
  layerCalls.handoff = 0
}

// ---------- Mocks ----------

vi.mock('@/lib/api/privacy-prefs', () => ({
  getPrivacyPrefs: async () => ({
    patient_id: 'lanae',
    allow_claude_context: gate.allow_claude_context,
    allow_correlation_analysis: true,
    retain_history_beyond_2y: true,
    updated_at: '2026-04-17T00:00:00Z',
  }),
}))

vi.mock('@/lib/context/permanent-core', () => ({
  generatePermanentCore: async () => {
    layerCalls.permanentCore++
    return 'PERMANENT_CORE_SECRET_DATA'
  },
}))

vi.mock('@/lib/context/summary-engine', () => ({
  getSummary: async () => {
    layerCalls.summary++
    return 'SUMMARY_SECRET_DATA'
  },
  detectRelevantTopics: () => ['cv_orthostatic'],
}))

vi.mock('@/lib/context/vector-store', () => ({
  searchByText: async () => {
    layerCalls.retrieval++
    return [
      {
        contentDate: '2026-04-01',
        contentType: 'daily_log',
        narrative: 'RETRIEVAL_SECRET_DATA',
        cyclePhase: null,
        painLevel: null,
      },
    ]
  },
}))

vi.mock('@/lib/intelligence/knowledge-base', () => ({
  loadRelevantKBContext: async () => {
    layerCalls.kb++
    return { text: 'KB_SECRET_DATA', tokenCount: 100, documentsLoaded: ['doc1'] }
  },
}))

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({
            single: async () => {
              layerCalls.handoff++
              return { data: null, error: null }
            },
          }),
        }),
      }),
    }),
  }),
  supabase: {},
}))

// ---------- Imports after mocks ----------

import { assembleDynamicContext } from '@/lib/context/assembler'

beforeEach(() => resetState())

describe('assembler privacy gate (F10)', () => {
  it('BLOCKS every layer when allow_claude_context is false', async () => {
    gate.allow_claude_context = false
    const result = await assembleDynamicContext('How is my HRV?')

    // NO secret data should be in the assembled context.
    expect(result.context).not.toContain('PERMANENT_CORE_SECRET_DATA')
    expect(result.context).not.toContain('SUMMARY_SECRET_DATA')
    expect(result.context).not.toContain('RETRIEVAL_SECRET_DATA')
    expect(result.context).not.toContain('KB_SECRET_DATA')

    // And the layer functions were never called.
    expect(layerCalls.permanentCore).toBe(0)
    expect(layerCalls.summary).toBe(0)
    expect(layerCalls.retrieval).toBe(0)
    expect(layerCalls.kb).toBe(0)
    expect(layerCalls.handoff).toBe(0)

    // Sections are also empty.
    expect(result.sections.permanentCore).toBeNull()
    expect(result.sections.handoff).toBeNull()
    expect(result.sections.summaries).toEqual([])
    expect(result.sections.retrieval).toBeNull()

    // A privacy notice IS present so Claude knows why the context is empty.
    expect(result.context).toContain('privacy_notice')
    expect(result.context).toMatch(/disabled|suppressed|re-enable/i)
  })

  it('ALLOWS normal layer assembly when allow_claude_context is true', async () => {
    gate.allow_claude_context = true
    const result = await assembleDynamicContext('How is my HRV?')

    // At least one layer ran.
    expect(layerCalls.permanentCore).toBeGreaterThan(0)

    // Secret data from at least the permanent core flows through.
    expect(result.context).toContain('PERMANENT_CORE_SECRET_DATA')
    expect(result.sections.permanentCore).toEqual('PERMANENT_CORE_SECRET_DATA')

    // No privacy notice in the allowed path.
    expect(result.context).not.toContain('privacy_notice')
  })

  it('fails CLOSED (redacts) when the gate read throws', async () => {
    // Force getPrivacyPrefs to throw
    const { getPrivacyPrefs } = await import('@/lib/api/privacy-prefs')
    const original = getPrivacyPrefs
    const throwingMock = vi.fn(async () => {
      throw new Error('boom')
    })
    // Patch the module
    vi.doMock('@/lib/api/privacy-prefs', () => ({ getPrivacyPrefs: throwingMock }))

    // Re-import to pick up new mock
    vi.resetModules()
    const { assembleDynamicContext: assembleReloaded } = await import('@/lib/context/assembler')
    const result = await assembleReloaded('How is my HRV?')

    expect(result.context).not.toContain('PERMANENT_CORE_SECRET_DATA')
    expect(result.context).toContain('privacy_notice')

    // Cleanup -- put the original mock back so later tests see the permissive gate.
    vi.doMock('@/lib/api/privacy-prefs', () => ({ getPrivacyPrefs: original }))
  })
})
