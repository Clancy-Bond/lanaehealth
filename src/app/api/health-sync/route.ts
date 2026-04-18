/**
 * POST /api/health-sync
 *
 * Bearer-token JSON endpoint built for an iOS Shortcut to push Natural
 * Cycles data (and any other Apple Health data that NC mirrors) into
 * LanaeHealth without a full export.xml round trip.
 *
 * The Shortcut reads HealthKit samples with "Find Health Samples" and
 * POSTs a minimal JSON payload here. Auth is a fixed token in the
 * Authorization header so the Shortcut can store it once and forget.
 *
 * Payload shape (any combination of the arrays below is accepted; all
 * are optional):
 *
 *   {
 *     "menstrualFlow":  [{ "date": "2026-04-18", "value": "medium" }],
 *     "basalTemp":      [{ "date": "2026-04-18", "celsius": 36.5 }],
 *     "cervicalMucus":  [{ "date": "2026-04-18", "value": "creamy" }],
 *     "ovulationTest":  [{ "date": "2026-04-18", "value": "positive" }]
 *   }
 *
 * The endpoint is intentionally forgiving: it also accepts an
 * alternative flat "samples" array in raw HealthKit form so a future
 * Shortcut that pipes "Find Health Samples" output directly does not
 * need reshape steps:
 *
 *   {
 *     "samples": [
 *       { "type": "HKCategoryTypeIdentifierMenstrualFlow",
 *         "startDate": "2026-04-18T09:00:00Z",
 *         "value": "medium" }
 *     ]
 *   }
 *
 * Response:
 *   { synced: { menstrualFlow: 1, basalTemp: 0, ... },
 *     dateRange: { from: "2026-04-18", to: "2026-04-18" },
 *     errors: [] }
 *
 * Every write is an upsert keyed on date, so the Shortcut is safe to
 * run daily or on a timer without creating dupes. Same nc_imported +
 * cycle_entries tables the full-export importer writes to.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type MenstrualFlowValue =
  | 'none'
  | 'unspecified'
  | 'light'
  | 'medium'
  | 'heavy'

type CervicalMucusValue =
  | 'dry'
  | 'sticky'
  | 'creamy'
  | 'watery'
  | 'egg_white'

type OvulationValue = 'negative' | 'positive' | 'indeterminate'

interface DateValue<V> {
  date: string
  value: V
}

interface BasalTempEntry {
  date: string
  celsius?: number
  fahrenheit?: number
}

interface RawSample {
  type: string
  startDate?: string
  endDate?: string
  date?: string
  value: string | number
}

interface Payload {
  menstrualFlow?: DateValue<MenstrualFlowValue>[]
  basalTemp?: BasalTempEntry[]
  cervicalMucus?: DateValue<CervicalMucusValue>[]
  ovulationTest?: DateValue<OvulationValue>[]
  samples?: RawSample[]
}

const HK_MENSTRUAL_FLOW_INT: Record<number, MenstrualFlowValue> = {
  1: 'unspecified',
  2: 'light',
  3: 'medium',
  4: 'heavy',
  5: 'none',
}

const HK_CERVICAL_MUCUS_INT: Record<number, CervicalMucusValue> = {
  1: 'dry',
  2: 'sticky',
  3: 'creamy',
  4: 'watery',
  5: 'egg_white',
}

const HK_OVULATION_INT: Record<number, OvulationValue> = {
  1: 'negative',
  2: 'positive',
  3: 'indeterminate',
}

function toDateIso(input: string | undefined | null): string | null {
  if (!input) return null
  // Accept "2026-04-18" and "2026-04-18T09:00:00Z"; slice to yyyy-mm-dd.
  const trimmed = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function normalizeMenstrualFlow(value: string | number): MenstrualFlowValue | null {
  if (typeof value === 'number') return HK_MENSTRUAL_FLOW_INT[value] ?? null
  const s = String(value).trim().toLowerCase()
  if (['none', 'unspecified', 'light', 'medium', 'heavy'].includes(s)) {
    return s as MenstrualFlowValue
  }
  const parsed = Number(s)
  if (!Number.isNaN(parsed) && HK_MENSTRUAL_FLOW_INT[parsed]) {
    return HK_MENSTRUAL_FLOW_INT[parsed]
  }
  return null
}

function normalizeCervicalMucus(value: string | number): CervicalMucusValue | null {
  if (typeof value === 'number') return HK_CERVICAL_MUCUS_INT[value] ?? null
  const s = String(value).trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  if (['dry', 'sticky', 'creamy', 'watery', 'egg_white', 'eggwhite'].includes(s)) {
    return (s === 'eggwhite' ? 'egg_white' : s) as CervicalMucusValue
  }
  const parsed = Number(s)
  if (!Number.isNaN(parsed) && HK_CERVICAL_MUCUS_INT[parsed]) {
    return HK_CERVICAL_MUCUS_INT[parsed]
  }
  return null
}

function normalizeOvulation(value: string | number): OvulationValue | null {
  if (typeof value === 'number') return HK_OVULATION_INT[value] ?? null
  const s = String(value).trim().toLowerCase()
  if (['negative', 'positive', 'indeterminate'].includes(s)) return s as OvulationValue
  const parsed = Number(s)
  if (!Number.isNaN(parsed) && HK_OVULATION_INT[parsed]) return HK_OVULATION_INT[parsed]
  return null
}

function basalTempCelsius(entry: BasalTempEntry): number | null {
  if (entry.celsius != null) return Number(entry.celsius)
  if (entry.fahrenheit != null) return (Number(entry.fahrenheit) - 32) * (5 / 9)
  return null
}

/** Fold raw HealthKit samples into the typed arrays for a uniform pipeline. */
function flattenSamples(payload: Payload): Payload {
  if (!payload.samples || payload.samples.length === 0) return payload
  const out: Payload = {
    menstrualFlow: payload.menstrualFlow ?? [],
    basalTemp: payload.basalTemp ?? [],
    cervicalMucus: payload.cervicalMucus ?? [],
    ovulationTest: payload.ovulationTest ?? [],
  }
  for (const s of payload.samples) {
    const date = toDateIso(s.date ?? s.startDate)
    if (!date) continue
    switch (s.type) {
      case 'HKCategoryTypeIdentifierMenstrualFlow': {
        const v = normalizeMenstrualFlow(s.value)
        if (v) out.menstrualFlow!.push({ date, value: v })
        break
      }
      case 'HKQuantityTypeIdentifierBasalBodyTemperature': {
        const celsius = Number(s.value)
        if (Number.isFinite(celsius)) out.basalTemp!.push({ date, celsius })
        break
      }
      case 'HKCategoryTypeIdentifierCervicalMucusQuality': {
        const v = normalizeCervicalMucus(s.value)
        if (v) out.cervicalMucus!.push({ date, value: v })
        break
      }
      case 'HKCategoryTypeIdentifierOvulationTestResult': {
        const v = normalizeOvulation(s.value)
        if (v) out.ovulationTest!.push({ date, value: v })
        break
      }
    }
  }
  return out
}

interface SyncResult {
  synced: {
    menstrualFlow: number
    basalTemp: number
    cervicalMucus: number
    ovulationTest: number
  }
  dateRange: { from: string | null; to: string | null }
  errors: string[]
}

export async function POST(request: NextRequest) {
  const token = process.env.HEALTH_SYNC_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'HEALTH_SYNC_TOKEN is not configured on the server.' },
      { status: 500 },
    )
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (provided !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let raw: Payload
  try {
    raw = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 })
  }

  const payload = flattenSamples(raw)
  const supabase = createServiceClient()

  const result: SyncResult = {
    synced: { menstrualFlow: 0, basalTemp: 0, cervicalMucus: 0, ovulationTest: 0 },
    dateRange: { from: null, to: null },
    errors: [],
  }
  const trackDate = (d: string | null) => {
    if (!d) return
    if (!result.dateRange.from || d < result.dateRange.from) result.dateRange.from = d
    if (!result.dateRange.to || d > result.dateRange.to) result.dateRange.to = d
  }

  // Build a single upsert row per date so we do not clobber other fields
  // each time a different HK category fires.
  interface NcRow {
    date: string
    menstruation?: 'MENSTRUATION' | 'SPOTTING' | null
    flow_quantity?: string | null
    temperature?: number | null
    cervical_mucus_consistency?: string | null
    lh_test?: string | null
  }
  interface CyRow {
    date: string
    menstruation?: boolean
    flow_level?: string | null
    lh_test_result?: string | null
    cervical_mucus_consistency?: string | null
  }
  const ncByDate = new Map<string, NcRow>()
  const cyByDate = new Map<string, CyRow>()
  const ncGet = (date: string): NcRow => {
    const existing = ncByDate.get(date)
    if (existing) return existing
    const fresh: NcRow = { date }
    ncByDate.set(date, fresh)
    return fresh
  }
  const cyGet = (date: string): CyRow => {
    const existing = cyByDate.get(date)
    if (existing) return existing
    const fresh: CyRow = { date }
    cyByDate.set(date, fresh)
    return fresh
  }

  for (const entry of payload.menstrualFlow ?? []) {
    const date = toDateIso(entry.date)
    if (!date) continue
    const flow = normalizeMenstrualFlow(entry.value)
    if (!flow) continue
    trackDate(date)
    const isMenstruating = flow !== 'none' && flow !== 'unspecified'
    const nc = ncGet(date)
    // flow='none' explicitly tells us the day is NOT a period; preserve
    // that by leaving flow_quantity null. Otherwise record NC's flow
    // quantity, which is also the signal the cycle-day helper reads.
    nc.menstruation = isMenstruating ? 'MENSTRUATION' : null
    nc.flow_quantity = isMenstruating ? flow : null
    const cy = cyGet(date)
    cy.menstruation = !!isMenstruating
    cy.flow_level = isMenstruating ? flow : null
    result.synced.menstrualFlow++
  }

  for (const entry of payload.basalTemp ?? []) {
    const date = toDateIso(entry.date)
    if (!date) continue
    const celsius = basalTempCelsius(entry)
    if (celsius == null || !Number.isFinite(celsius)) continue
    trackDate(date)
    ncGet(date).temperature = celsius
    result.synced.basalTemp++
  }

  for (const entry of payload.cervicalMucus ?? []) {
    const date = toDateIso(entry.date)
    if (!date) continue
    const v = normalizeCervicalMucus(entry.value)
    if (!v) continue
    trackDate(date)
    ncGet(date).cervical_mucus_consistency = v
    cyGet(date).cervical_mucus_consistency = v
    result.synced.cervicalMucus++
  }

  for (const entry of payload.ovulationTest ?? []) {
    const date = toDateIso(entry.date)
    if (!date) continue
    const v = normalizeOvulation(entry.value)
    if (!v) continue
    trackDate(date)
    ncGet(date).lh_test = v
    cyGet(date).lh_test_result = v
    result.synced.ovulationTest++
  }

  for (const row of ncByDate.values()) {
    const { error } = await supabase
      .from('nc_imported')
      .upsert(
        { ...row, imported_at: new Date().toISOString(), data_flags: 'apple_health_shortcut' },
        { onConflict: 'date' },
      )
    if (error) result.errors.push(`nc_imported ${row.date}: ${error.message}`)
  }

  for (const row of cyByDate.values()) {
    const { error } = await supabase
      .from('cycle_entries')
      .upsert(row, { onConflict: 'date' })
    if (error) result.errors.push(`cycle_entries ${row.date}: ${error.message}`)
  }

  return NextResponse.json(result, { status: 200 })
}

export async function GET(request: NextRequest) {
  // A GET-with-bearer probe lets the Shortcut test connectivity without
  // mutating state. Same auth as POST so a bad token does not leak.
  const token = process.env.HEALTH_SYNC_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'HEALTH_SYNC_TOKEN is not configured on the server.' },
      { status: 500 },
    )
  }
  const authHeader = request.headers.get('authorization') ?? ''
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (provided !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, endpoint: '/api/health-sync', accepts: 'POST JSON' })
}
