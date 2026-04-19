/**
 * POST /api/health-sync
 *
 * Bearer-token JSON endpoint built for an iOS Shortcut to push Natural
 * Cycles data (and any other Apple Health data that NC mirrors) into
 * LanaeHealth without a full export.xml round trip.
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
 * Alternative flat "samples" array in raw HealthKit form is also
 * accepted so a future Shortcut can forward `Find Health Samples`
 * output verbatim:
 *
 *   {
 *     "samples": [
 *       { "type": "HKCategoryTypeIdentifierMenstrualFlow",
 *         "startDate": "2026-04-18T09:00:00Z",
 *         "value": "medium" }
 *     ]
 *   }
 *
 * Security posture (Track C security sweep, finding C-002):
 *  - Constant-time bearer comparison (no timing oracle on the token).
 *  - Hard 1 MB request-body cap before parsing (413 on violation).
 *  - Zod schemas on every sub-array; per-request dedupe on date keys.
 *  - 60 req / min / token rate limit (429 when breached).
 *  - Errors never echo payload data. Supabase errors are logged
 *    server-side; the client only sees an opaque marker.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { timingSafeEqualStrings } from '@/lib/constant-time'
import { rateLimit, clientKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY_BYTES = 1_000_000 // 1 MB
const RATE_LIMIT = rateLimit({ windowMs: 60_000, max: 60 })

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

const MENSTRUAL_FLOW_ENUM = ['none', 'unspecified', 'light', 'medium', 'heavy'] as const
const CERVICAL_MUCUS_ENUM = ['dry', 'sticky', 'creamy', 'watery', 'egg_white'] as const
const OVULATION_ENUM = ['negative', 'positive', 'indeterminate'] as const

const DateString = z.string().min(1).max(64)
// Accept strings or numbers for values (the Shortcut pipes raw HealthKit
// output which is sometimes integers). Narrowing happens after parsing.
const LooseValue = z.union([z.string().max(64), z.number()])

const MenstrualFlowEntry = z.object({
  date: DateString,
  value: LooseValue,
}).passthrough()

const BasalTempEntry = z.object({
  date: DateString,
  celsius: z.number().finite().optional(),
  fahrenheit: z.number().finite().optional(),
}).passthrough()

const CervicalMucusEntry = z.object({
  date: DateString,
  value: LooseValue,
}).passthrough()

const OvulationEntry = z.object({
  date: DateString,
  value: LooseValue,
}).passthrough()

const RawSample = z.object({
  type: z.string().max(128),
  startDate: z.string().max(64).optional(),
  endDate: z.string().max(64).optional(),
  date: z.string().max(64).optional(),
  value: LooseValue,
}).passthrough()

const PayloadSchema = z.object({
  menstrualFlow: z.array(MenstrualFlowEntry).max(5000).optional(),
  basalTemp: z.array(BasalTempEntry).max(5000).optional(),
  cervicalMucus: z.array(CervicalMucusEntry).max(5000).optional(),
  ovulationTest: z.array(OvulationEntry).max(5000).optional(),
  samples: z.array(RawSample).max(20000).optional(),
}).passthrough()

type Payload = z.infer<typeof PayloadSchema>

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
  const trimmed = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function normalizeMenstrualFlow(value: string | number): MenstrualFlowValue | null {
  if (typeof value === 'number') return HK_MENSTRUAL_FLOW_INT[value] ?? null
  const s = String(value).trim().toLowerCase()
  if ((MENSTRUAL_FLOW_ENUM as readonly string[]).includes(s)) {
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
  if ((CERVICAL_MUCUS_ENUM as readonly string[]).includes(s) || s === 'eggwhite') {
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
  if ((OVULATION_ENUM as readonly string[]).includes(s)) return s as OvulationValue
  const parsed = Number(s)
  if (!Number.isNaN(parsed) && HK_OVULATION_INT[parsed]) return HK_OVULATION_INT[parsed]
  return null
}

function basalTempCelsius(entry: { celsius?: number; fahrenheit?: number }): number | null {
  if (entry.celsius != null && Number.isFinite(entry.celsius)) return Number(entry.celsius)
  if (entry.fahrenheit != null && Number.isFinite(entry.fahrenheit)) {
    return (Number(entry.fahrenheit) - 32) * (5 / 9)
  }
  return null
}

function flattenSamples(payload: Payload): Payload {
  if (!payload.samples || payload.samples.length === 0) return payload
  const out: Payload = {
    menstrualFlow: payload.menstrualFlow ?? [],
    basalTemp: payload.basalTemp ?? [],
    cervicalMucus: payload.cervicalMucus ?? [],
    ovulationTest: payload.ovulationTest ?? [],
  }
  for (const s of payload.samples) {
    const date = toDateIso(s.date ?? s.startDate ?? null)
    if (!date) continue
    switch (s.type) {
      case 'HKCategoryTypeIdentifierMenstrualFlow': {
        const v = normalizeMenstrualFlow(s.value as string | number)
        if (v) out.menstrualFlow!.push({ date, value: v })
        break
      }
      case 'HKQuantityTypeIdentifierBasalBodyTemperature': {
        const celsius = Number(s.value)
        if (Number.isFinite(celsius)) out.basalTemp!.push({ date, celsius })
        break
      }
      case 'HKCategoryTypeIdentifierCervicalMucusQuality': {
        const v = normalizeCervicalMucus(s.value as string | number)
        if (v) out.cervicalMucus!.push({ date, value: v })
        break
      }
      case 'HKCategoryTypeIdentifierOvulationTestResult': {
        const v = normalizeOvulation(s.value as string | number)
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

function authorize(request: NextRequest): NextResponse | null {
  const token = process.env.HEALTH_SYNC_TOKEN
  if (!token) {
    // Fail-closed: the route is off until the secret is configured.
    return NextResponse.json({ error: 'unconfigured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization') ?? ''
  const provided = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  if (!timingSafeEqualStrings(provided, token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

function enforceRateLimit(request: NextRequest): NextResponse | null {
  const key = clientKey(request)
  if (!RATE_LIMIT.consume(key)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  return null
}

async function readBoundedText(request: NextRequest): Promise<string | NextResponse> {
  const declared = request.headers.get('content-length')
  if (declared) {
    const declaredBytes = Number(declared)
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    }
  }
  const body = await request.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }
  return body
}

export async function POST(request: NextRequest) {
  const denyAuth = authorize(request)
  if (denyAuth) return denyAuth

  const denyRate = enforceRateLimit(request)
  if (denyRate) return denyRate

  const bodyOrDeny = await readBoundedText(request)
  if (typeof bodyOrDeny !== 'string') return bodyOrDeny

  let parsedJson: unknown
  try {
    parsedJson = bodyOrDeny.length === 0 ? {} : JSON.parse(bodyOrDeny)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const zod = PayloadSchema.safeParse(parsedJson)
  if (!zod.success) {
    // Do not echo zod.error.issues -- they can carry payload snippets.
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const payload = flattenSamples(zod.data)
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
    const flow = normalizeMenstrualFlow(entry.value as string | number)
    if (!flow) continue
    trackDate(date)
    const isMenstruating = flow !== 'none' && flow !== 'unspecified'
    const nc = ncGet(date)
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
    const v = normalizeCervicalMucus(entry.value as string | number)
    if (!v) continue
    trackDate(date)
    ncGet(date).cervical_mucus_consistency = v
    cyGet(date).cervical_mucus_consistency = v
    result.synced.cervicalMucus++
  }

  for (const entry of payload.ovulationTest ?? []) {
    const date = toDateIso(entry.date)
    if (!date) continue
    const v = normalizeOvulation(entry.value as string | number)
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
    if (error) {
      console.error('[health-sync] nc_imported upsert failed', { date: row.date, message: error.message })
      result.errors.push('write_failed')
    }
  }

  for (const row of cyByDate.values()) {
    const { error } = await supabase
      .from('cycle_entries')
      .upsert(row, { onConflict: 'date' })
    if (error) {
      console.error('[health-sync] cycle_entries upsert failed', { date: row.date, message: error.message })
      result.errors.push('write_failed')
    }
  }

  return NextResponse.json(result, { status: 200 })
}

export async function GET(request: NextRequest) {
  // A GET-with-bearer probe lets the Shortcut test connectivity without
  // mutating state. Same auth and rate limit as POST.
  const denyAuth = authorize(request)
  if (denyAuth) return denyAuth
  const denyRate = enforceRateLimit(request)
  if (denyRate) return denyRate
  return NextResponse.json({ ok: true, endpoint: '/api/health-sync', accepts: 'POST JSON' })
}

// Exposed for tests so each case starts with a clean bucket.
export function __resetRateLimitForTests() {
  RATE_LIMIT.reset()
}
