/**
 * Regression tests for fix: cycle-intelligence must fold nc_imported
 * MENSTRUATION rows into menstrualDays and derive lastPeriodStart from
 * them when cycle_entries has no flagged rows.
 *
 * Design contract (docs/qa/design-decisions.md):
 *   - Only `nc_imported.menstruation === 'MENSTRUATION'` counts.
 *   - `'SPOTTING'` does NOT count as period start.
 *   - Union cycle_entries + nc_imported menstrual days, deduplicate by date.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase: we inject per-test data via the factory below.
let cycleEntriesRows: Array<{ date: string; menstruation: boolean | null; cervical_mucus_consistency?: string | null; lh_test_result?: string | null; flow_level?: string | null }> = []
let ouraRows: Array<{ date: string; body_temp_deviation: number | null; hrv_avg: number | null; resting_hr: number | null }> = []
let ncRows: Array<{ date: string; temperature: number | null; menstruation: string | null; cervical_mucus_consistency?: string | null }> = []

function makeQuery(rows: unknown[]) {
  // Chainable query stub. Every filter/order call returns the builder.
  // The terminal call is Promise-like (awaited by `Promise.all`).
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.gte = chain
  builder.lte = chain
  builder.eq = chain
  builder.order = chain
  builder.limit = chain
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: rows, error: null })
  return builder
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'cycle_entries') return makeQuery(cycleEntriesRows)
      if (table === 'oura_daily') return makeQuery(ouraRows)
      if (table === 'nc_imported') return makeQuery(ncRows)
      return makeQuery([])
    },
  }),
  supabase: {},
}))

import { analyzeCycleIntelligence } from '@/lib/ai/cycle-intelligence'

// Helper to compute expected cycleDay given lastPeriodStart and today.
function expectedCycleDay(lastPeriodStart: string): number {
  const today = new Date().toISOString().slice(0, 10)
  return (
    Math.floor(
      (new Date(today).getTime() - new Date(lastPeriodStart).getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1
  )
}

describe('analyzeCycleIntelligence: nc_imported menstruation folding', () => {
  beforeEach(() => {
    cycleEntriesRows = []
    ouraRows = []
    ncRows = []
  })

  it('A: cycles empty, nc has MENSTRUATION -> lastPeriodStart derived from nc', async () => {
    ncRows = [{ date: '2026-03-15', temperature: null, menstruation: 'MENSTRUATION' }]

    const result = await analyzeCycleIntelligence()

    // cycleDay should equal days from 2026-03-15 to today (+1).
    expect(result.cycleDay).toBe(expectedCycleDay('2026-03-15'))
    expect(result.currentPhase).not.toBe('unknown')
  })

  it('B: cycles empty, nc has only SPOTTING -> lastPeriodStart stays null', async () => {
    ncRows = [{ date: '2026-03-15', temperature: null, menstruation: 'SPOTTING' }]

    const result = await analyzeCycleIntelligence()

    // No MENSTRUATION rows means we cannot anchor a cycle start.
    expect(result.cycleDay).toBeNull()
    expect(result.currentPhase).toBe('unknown')
  })

  it('C: consecutive nc MENSTRUATION days back-walk to the first day', async () => {
    // Most recent period spans 3 consecutive days. Oldest is the true start.
    ncRows = [
      { date: '2026-03-15', temperature: null, menstruation: 'MENSTRUATION' },
      { date: '2026-03-16', temperature: null, menstruation: 'MENSTRUATION' },
      { date: '2026-03-17', temperature: null, menstruation: 'MENSTRUATION' },
    ]

    const result = await analyzeCycleIntelligence()

    // The engine walks backwards from 2026-03-17 and lands on 2026-03-15.
    expect(result.cycleDay).toBe(expectedCycleDay('2026-03-15'))
  })

  it('D: duplicate date across cycles + nc is deduplicated (single day, not stretched)', async () => {
    // Both sources report the same date. The union-of-sets must collapse to
    // one entry so the back-walk does not spuriously extend the period.
    cycleEntriesRows = [
      {
        date: '2026-03-15',
        menstruation: true,
        cervical_mucus_consistency: null,
        lh_test_result: null,
        flow_level: 'medium',
      },
    ]
    ncRows = [{ date: '2026-03-15', temperature: null, menstruation: 'MENSTRUATION' }]

    const result = await analyzeCycleIntelligence()

    expect(result.cycleDay).toBe(expectedCycleDay('2026-03-15'))
  })
})
