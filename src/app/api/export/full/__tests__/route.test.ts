/**
 * Tests for /api/export/full (Wave 2e F10).
 *
 * Focus:
 *   - rowsToCsv: RFC-4180 compliance (commas, quotes, newlines, nested JSON).
 *   - GET handler: unauthenticated calls return 401.
 *   - GET handler: authenticated call returns application/zip with
 *     README.md and the expected table entries.
 *
 * The Supabase service client is stubbed; each table returns a small
 * canned set of rows. JSZip runs for real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

// ---------- Supabase stub ----------

const fixtureRows: Record<string, Array<Record<string, unknown>>> = {
  daily_logs: [
    { id: '1', date: '2026-04-01', energy: 3, pain: 2, notes: 'tired, "quoted" note' },
    { id: '2', date: '2026-04-02', energy: 4, pain: 1, notes: 'line1\nline2' },
  ],
  oura_daily: [{ date: '2026-04-01', hrv: 42, rhr: 62 }],
  nc_imported: [],
  food_entries: [],
  lab_results: [{ id: 'l1', date: '2026-02-19', test: 'TSH', value: 5.1, flag: 'H' }],
  symptoms: [],
  pain_points: [],
  appointments: [],
  medical_timeline: [],
  cycle_entries: [],
  imaging_studies: [],
  active_problems: [],
  correlation_results: [],
  chat_messages: [{ id: 'c1', role: 'user', content: 'hello', tokens_used: 5 }],
  health_profile: [{ section: 'personal', content: { full_name: 'Lanae A. Bond' } }],
  medical_narrative: [],
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const chain = {
        select: (_cols: string) => chain,
        order: (_col: string, _opts: unknown) =>
          Promise.resolve({ data: fixtureRows[table] ?? [], error: null }),
      }
      // If no order is called, also return data on await.
      return {
        select: (_cols: string) => {
          const q = {
            order: (_col: string, _opts: unknown) =>
              Promise.resolve({ data: fixtureRows[table] ?? [], error: null }),
            then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
              resolve({ data: fixtureRows[table] ?? [], error: null }),
          }
          return q
        },
      }
    },
  }),
  supabase: {},
}))

// ---------- Imports after mocks ----------

import { rowsToCsv, GET } from '@/app/api/export/full/route'
import { NextRequest } from 'next/server'
import { resetRateLimitsForTests } from '@/lib/security/rate-limit'

// ---------- rowsToCsv ----------

describe('rowsToCsv', () => {
  it('returns an empty string for empty input', () => {
    expect(rowsToCsv([])).toBe('')
  })

  it('emits a header row that unions keys across rows', () => {
    const csv = rowsToCsv([
      { a: 1, b: 2 },
      { a: 3, c: 4 },
    ])
    const header = csv.split('\r\n')[0]
    expect(header).toBe('a,b,c')
  })

  it('escapes commas by wrapping in double quotes', () => {
    const csv = rowsToCsv([{ note: 'a, b, c' }])
    expect(csv).toContain('"a, b, c"')
  })

  it('escapes double quotes by doubling them', () => {
    const csv = rowsToCsv([{ note: 'she said "hi"' }])
    expect(csv).toContain('"she said ""hi"""')
  })

  it('escapes newlines by wrapping in double quotes', () => {
    const csv = rowsToCsv([{ note: 'line1\nline2' }])
    expect(csv).toContain('"line1\nline2"')
  })

  it('serializes nested objects as JSON', () => {
    const csv = rowsToCsv([{ content: { full_name: 'Lanae' } }])
    expect(csv).toContain('"{""full_name"":""Lanae""}"')
  })

  it('renders null and undefined as empty cells', () => {
    const csv = rowsToCsv([{ a: null, b: undefined, c: 0 }])
    const dataRow = csv.split('\r\n')[1]
    expect(dataRow).toBe(',,0')
  })
})

// ---------- GET handler ----------

describe('GET /api/export/full', () => {
  const APP_TOKEN = 'export-full-test-token'
  const originalApp = process.env.APP_AUTH_TOKEN

  beforeEach(() => {
    process.env.APP_AUTH_TOKEN = APP_TOKEN
    // Track B rate limit on full export is 1/hour per client; reset
    // between cases so the second successful call isn't 429'd.
    resetRateLimitsForTests()
  })

  function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
    const h = new Headers(headers)
    return new NextRequest(new URL(url), { headers: h })
  }

  it('returns 500 when APP_AUTH_TOKEN is not set on the server', async () => {
    delete process.env.APP_AUTH_TOKEN
    const res = await GET(makeReq('http://localhost/api/export/full'))
    expect(res.status).toBe(500)
    process.env.APP_AUTH_TOKEN = originalApp ?? APP_TOKEN
  })

  it('returns 401 without a Bearer', async () => {
    const res = await GET(makeReq('http://localhost/api/export/full'))
    expect(res.status).toBe(401)
  })

  it('returns 401 with a mismatched Bearer', async () => {
    const res = await GET(
      makeReq('http://localhost/api/export/full', { authorization: 'Bearer wrong' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 401 when the old ?token= query is used (query path was retired)', async () => {
    const res = await GET(
      makeReq(`http://localhost/api/export/full?token=${APP_TOKEN}`),
    )
    expect(res.status).toBe(401)
  })

  it('returns 200 + application/zip with README and expected entries when authenticated via Bearer', async () => {
    const res = await GET(
      makeReq('http://localhost/api/export/full', {
        authorization: `Bearer ${APP_TOKEN}`,
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/zip')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="lanaehealth-full-/)

    // Decode the ZIP and look for required files.
    const buf = Buffer.from(await res.arrayBuffer())
    const zip = await JSZip.loadAsync(buf)

    expect(zip.file('README.md')).not.toBeNull()
    expect(zip.file('manifest.json')).not.toBeNull()
    expect(zip.file('daily_logs.csv')).not.toBeNull()
    expect(zip.file('lab_results.csv')).not.toBeNull()
    expect(zip.file('chat_messages.json')).not.toBeNull()
    expect(zip.file('health_profile.json')).not.toBeNull()

    const readme = await zip.file('README.md')!.async('string')
    expect(readme).toMatch(/LanaeHealth Full Data Export/)
    expect(readme).toMatch(/daily_logs\.csv/)

    const dailyLogs = await zip.file('daily_logs.csv')!.async('string')
    expect(dailyLogs).toMatch(/id,date,energy,pain,notes/)
    // The fixture has an embedded newline that must be quoted.
    expect(dailyLogs).toContain('"line1\nline2"')

    const manifest = JSON.parse(
      await zip.file('manifest.json')!.async('string'),
    ) as { app: string; record_counts: Record<string, number> }
    expect(manifest.app).toBe('LanaeHealth')
    expect(manifest.record_counts.daily_logs).toBe(2)
    expect(manifest.record_counts.oura_daily).toBe(1)
  })
})
