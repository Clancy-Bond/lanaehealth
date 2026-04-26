/**
 * Tests for /api/import/universal column-name correctness.
 *
 * These tests verify that `handleConfirm` in the universal importer writes to
 * the real column names in Supabase:
 *   - medical_timeline uses `event_date` (NOT `date`).
 *   - medical_narrative has no `date` column; the date must be folded into content.
 *   - active_problems uses `problem` (NOT `name`).
 *
 * They also verify that the route calls `filterExistingRecords` to dedup rather
 * than the broken upsert+onConflict pattern (which referenced composite unique
 * constraints that do not exist in the live DB).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CanonicalRecord } from '@/lib/import/types'

// ── Capture structures ───────────────────────────────────────────────
type InsertOrUpsertCall = {
  table: string
  op: 'insert' | 'upsert'
  payload: Record<string, unknown>
  onConflict?: string
}
type SelectCall = {
  table: string
  cols: string
  filters: Array<{ col: string; value: unknown }>
}

const insertCalls: InsertOrUpsertCall[] = []
const selectCalls: SelectCall[] = []
let filterExistingWasCalled = false
let lastFilterExistingRecords: CanonicalRecord[] | null = null

// Ambient state for controlling what the mock returns from .select().eq().maybeSingle()
const mockExistingRow: { value: Record<string, unknown> | null } = { value: null }
const mockHealthProfileContent: { value: Record<string, unknown> | null } = { value: null }

// ── Mock @/lib/supabase ──────────────────────────────────────────────
vi.mock('@/lib/supabase', () => {
  const buildQuery = (table: string) => {
    const selectCall: SelectCall = { table, cols: '', filters: [] }

    const chain: Record<string, unknown> = {
      select: (cols: string) => {
        selectCall.cols = cols
        selectCalls.push(selectCall)
        return chain
      },
      eq: (col: string, value: unknown) => {
        selectCall.filters.push({ col, value })
        return chain
      },
      ilike: (col: string, value: unknown) => {
        selectCall.filters.push({ col, value })
        return chain
      },
      limit: (_n: number) => chain,
      single: async () => {
        // Used by health_profile allergies branch
        if (table === 'health_profile') {
          return { data: mockHealthProfileContent.value, error: null }
        }
        return { data: null, error: null }
      },
      maybeSingle: async () => {
        return { data: mockExistingRow.value, error: null }
      },
      insert: async (payload: Record<string, unknown>) => {
        insertCalls.push({ table, op: 'insert', payload })
        return { data: null, error: null }
      },
      upsert: async (payload: Record<string, unknown>, opts?: { onConflict?: string }) => {
        insertCalls.push({
          table,
          op: 'upsert',
          payload,
          onConflict: opts?.onConflict,
        })
        return { data: null, error: null }
      },
    }
    return chain
  }

  return {
    createServiceClient: () => ({
      from: (table: string) => buildQuery(table),
    }),
    supabase: {},
  }
})

// Spy on filterExistingRecords so we can assert it was invoked, but run the
// real deduplicator logic -- we still want its DB queries to be captured in
// selectCalls (so the test can verify the deduplicator no longer uses
// active_problems.name, etc.).
vi.mock('@/lib/import/deduplicator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/import/deduplicator')>(
    '@/lib/import/deduplicator',
  )
  return {
    ...actual,
    filterExistingRecords: vi.fn(async (records: CanonicalRecord[]) => {
      filterExistingWasCalled = true
      lastFilterExistingRecords = records
      // Pass through the real filter so DB existence checks still happen and
      // their .from/.select/.eq calls are captured by the supabase mock.
      return actual.filterExistingRecords(records)
    }),
  }
})

// Stub runImportPipeline -- not used for handleConfirm path but imported at
// module load, so stub it to avoid side effects.
vi.mock('@/lib/import', () => ({
  runImportPipeline: vi.fn(async () => ({
    detection: { format: 'unknown', confidence: 0, mimeType: '', fileExtension: '', sizeBytes: 0, hints: [] },
    parseResult: { records: [], warnings: [], errors: [], metadata: { totalExtracted: 0, byType: {}, dateRange: null, sourceName: null } },
  })),
}))

// Stub auth so the route resolves a user_id without a real session.
vi.mock('@/lib/auth/get-user', () => ({
  getCurrentUser: async () => null,
}))
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111'
process.env.OWNER_USER_ID = TEST_USER_ID

// ── Helpers ──────────────────────────────────────────────────────────
function makeRecord<T extends CanonicalRecord['type']>(
  type: T,
  date: string,
  data: Record<string, unknown>,
): CanonicalRecord {
  return {
    type,
    date,
    datetime: null,
    source: {
      format: 'fhir-bundle',
      fileName: 'test.json',
      appName: 'test',
      importedAt: '2026-04-16T00:00:00Z',
      parserVersion: '1.0',
    },
    confidence: 1,
    data: data as never,
    rawText: null,
    dedupeKey: `${type}:${date}:${JSON.stringify(data)}`,
  } satisfies CanonicalRecord
}

function makeConfirmRequest(records: CanonicalRecord[]): Request {
  return new Request('http://localhost:3005/api/import/universal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', records }),
  })
}

// ── Test suite ───────────────────────────────────────────────────────
describe('POST /api/import/universal confirm: writes use correct column names', () => {
  beforeEach(() => {
    insertCalls.length = 0
    selectCalls.length = 0
    filterExistingWasCalled = false
    lastFilterExistingRecords = null
    mockExistingRow.value = null
    mockHealthProfileContent.value = { items: [] }
    vi.clearAllMocks()
  })

  it('invokes filterExistingRecords on the full records array', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('lab_result', '2026-04-01', { testName: 'TSH', value: 5.1 })]
    await POST(makeConfirmRequest(records) as never)
    expect(filterExistingWasCalled).toBe(true)
    expect(lastFilterExistingRecords).toHaveLength(1)
  })

  it('inserts medication into medical_timeline with event_date (never date)', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('medication', '2026-04-01', { name: 'Zyrtec', dose: '10', unit: 'mg' })]
    await POST(makeConfirmRequest(records) as never)

    const medTimelineWrites = insertCalls.filter(c => c.table === 'medical_timeline')
    expect(medTimelineWrites.length).toBeGreaterThan(0)
    for (const call of medTimelineWrites) {
      expect(call.payload).toHaveProperty('event_date')
      expect(call.payload).not.toHaveProperty('date')
    }
  })

  it('inserts immunization into medical_timeline with event_date', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('immunization', '2026-01-15', { vaccine: 'Influenza', status: 'completed' })]
    await POST(makeConfirmRequest(records) as never)

    const medTimelineWrites = insertCalls.filter(c => c.table === 'medical_timeline')
    expect(medTimelineWrites.length).toBeGreaterThan(0)
    for (const call of medTimelineWrites) {
      expect(call.payload).toHaveProperty('event_date')
      expect(call.payload).not.toHaveProperty('date')
    }
  })

  it('inserts procedure into medical_timeline with event_date', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('procedure', '2026-02-20', { name: 'EKG', performer: 'Dr. Jones' })]
    await POST(makeConfirmRequest(records) as never)

    const medTimelineWrites = insertCalls.filter(c => c.table === 'medical_timeline')
    expect(medTimelineWrites.length).toBeGreaterThan(0)
    for (const call of medTimelineWrites) {
      expect(call.payload).toHaveProperty('event_date')
      expect(call.payload).not.toHaveProperty('date')
    }
  })

  it('inserts default/timeline_event into medical_timeline with event_date', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('timeline_event', '2026-03-01', { eventType: 'custom', title: 'X' })]
    await POST(makeConfirmRequest(records) as never)

    const medTimelineWrites = insertCalls.filter(c => c.table === 'medical_timeline')
    expect(medTimelineWrites.length).toBeGreaterThan(0)
    for (const call of medTimelineWrites) {
      expect(call.payload).toHaveProperty('event_date')
      expect(call.payload).not.toHaveProperty('date')
    }
  })

  it('inserts clinical_note into medical_narrative without a date column', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('clinical_note', '2026-04-13', { title: 'Visit note', content: 'Hello' })]
    await POST(makeConfirmRequest(records) as never)

    const narrativeWrites = insertCalls.filter(c => c.table === 'medical_narrative')
    expect(narrativeWrites.length).toBeGreaterThan(0)
    for (const call of narrativeWrites) {
      // medical_narrative schema has no `date` or `event_date` column
      expect(call.payload).not.toHaveProperty('date')
      expect(call.payload).not.toHaveProperty('event_date')
      expect(call.payload).toHaveProperty('section_title')
      expect(call.payload).toHaveProperty('content')
      // The date should have been folded into the content for provenance
      expect(String(call.payload.content)).toContain('2026-04-13')
    }
  })

  it('inserts condition into active_problems with `problem` column (never `name`)', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('condition', '2026-01-01', { name: 'POTS', status: 'active' })]
    await POST(makeConfirmRequest(records) as never)

    const apWrites = insertCalls.filter(c => c.table === 'active_problems')
    expect(apWrites.length).toBeGreaterThan(0)
    for (const call of apWrites) {
      expect(call.payload).toHaveProperty('problem')
      expect(call.payload).not.toHaveProperty('name')
      // icd_code is not a real column; must not be in payload
      expect(call.payload).not.toHaveProperty('icd_code')
    }
  })

  it('does not use upsert+onConflict for tables without composite unique constraints', async () => {
    const { POST } = await import('../route')
    const records = [
      makeRecord('lab_result', '2026-04-01', { testName: 'TSH', value: 5.1 }),
      makeRecord('appointment', '2026-04-20', { doctorName: 'Dr. Jones' }),
      makeRecord('condition', '2026-01-01', { name: 'POTS' }),
      makeRecord('vital_sign', '2026-04-13', { vitalType: 'heart_rate', value: 106, unit: 'bpm' }),
    ]
    await POST(makeConfirmRequest(records) as never)

    const tablesWithoutUnique = ['lab_results', 'appointments', 'active_problems']
    for (const table of tablesWithoutUnique) {
      const writes = insertCalls.filter(c => c.table === table)
      for (const w of writes) {
        expect(w.op).toBe('insert')
        // Must not pass an onConflict option (since the constraint does not exist)
        expect(w.onConflict).toBeUndefined()
      }
    }
  })

  it('does not reference active_problems.name in filterExistingRecords either', async () => {
    const { POST } = await import('../route')
    const records = [makeRecord('condition', '2026-01-01', { name: 'POTS' })]
    await POST(makeConfirmRequest(records) as never)

    // filterExistingRecords triggers .from('active_problems').select('id').eq(...)
    // -- verify the eq column is `problem`, not `name`
    const apSelects = selectCalls.filter(c => c.table === 'active_problems')
    expect(apSelects.length).toBeGreaterThan(0)
    for (const sc of apSelects) {
      for (const f of sc.filters) {
        expect(f.col).not.toBe('name')
      }
      // And at least one filter should be on `problem`
      const cols = sc.filters.map(f => f.col)
      expect(cols).toContain('problem')
    }
  })

  it('reports skippedAsDuplicate when filterExistingRecords finds matches', async () => {
    const { POST } = await import('../route')
    // Set the mock so the first existence check returns an existing row
    mockExistingRow.value = { id: 'existing-id' }
    const records = [makeRecord('lab_result', '2026-04-01', { testName: 'TSH', value: 5.1 })]
    const res = await POST(makeConfirmRequest(records) as never)
    const body = await res.json()
    expect(body.skippedAsDuplicate).toBe(1)
    expect(body.totalSaved).toBe(0)
  })
})
