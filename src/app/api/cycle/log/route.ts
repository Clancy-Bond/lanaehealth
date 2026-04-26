/**
 * POST /api/cycle/log
 *
 * Persist a cycle_entry for a specific date. Accepts JSON or form body.
 * Delegates to createServiceClient().from('cycle_entries').upsert(...)
 * directly because lib/api/cycle.ts uses the browser supabase client and
 * this is a server route.
 *
 * Field whitelist mirrors the cycle_entries shape, including endo-mode
 * columns (migration 011) and granular daily-log columns (migration 028)
 * when those migrations are present. If postgres reports a missing column
 * from either group, we retry without the extended fields so pre-migration
 * environments still save core fields (flow, LH, ovulation signs, mucus).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { trace } from '@/lib/observability/tracing'
import { logError } from '@/lib/observability/log'
import type { FlowLevel, ClotSize } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FLOW_LEVELS: readonly FlowLevel[] = ['none', 'spotting', 'light', 'medium', 'heavy']
const CLOT_SIZES: readonly ClotSize[] = ['small', 'medium', 'large', 'very_large']
const LH_VALUES = new Set(['not_taken', 'negative', 'positive'])
const SEX_ACTIVITY_TYPES = new Set(['none', 'vaginal_protected', 'vaginal_unprotected', 'other'])
const SKIN_STATES = new Set(['dry', 'oily', 'puffy', 'acne', 'glowing', 'normal'])
const MOOD_EMOJI_MAX_LEN = 8

interface CycleEntryPatch {
  menstruation?: boolean
  flow_level?: FlowLevel | null
  ovulation_signs?: string | null
  lh_test_result?: string | null
  cervical_mucus_consistency?: string | null
  cervical_mucus_quantity?: string | null
  // Endo-mode (migration 011). May be rejected by pre-migration DB.
  bowel_symptoms?: string[] | null
  bladder_symptoms?: string[] | null
  dyspareunia?: boolean | null
  dyspareunia_intensity?: number | null
  clots_present?: boolean | null
  clot_size?: ClotSize | null
  clot_count?: number | null
  endo_notes?: string | null
  // Granular daily logging (migration 028). May be rejected by pre-migration DB.
  symptoms?: string[] | null
  sex_activity_type?: string | null
  skin_state?: string | null
  mood_emoji?: string | null
}

const ENDO_KEYS: Array<keyof CycleEntryPatch> = [
  'bowel_symptoms',
  'bladder_symptoms',
  'dyspareunia',
  'dyspareunia_intensity',
  'clots_present',
  'clot_size',
  'clot_count',
  'endo_notes',
]

const GRANULAR_KEYS: Array<keyof CycleEntryPatch> = [
  'symptoms',
  'sex_activity_type',
  'skin_state',
  'mood_emoji',
]

export async function POST(req: NextRequest): Promise<NextResponse> {
  return trace({ name: 'POST /api/cycle/log', op: 'http.server' }, async () => {
    return handleCycleLog(req)
  })
}

async function handleCycleLog(req: NextRequest): Promise<NextResponse> {
  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    logError({ context: 'cycle/log:auth', error: err })
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  const ct = req.headers.get('content-type') ?? ''
  let raw: Record<string, unknown> = {}
  try {
    if (ct.includes('application/json')) {
      raw = (await req.json()) as Record<string, unknown>
    } else {
      const fd = await req.formData()
      for (const [k, v] of fd.entries()) {
        const existing = raw[k]
        const value = typeof v === 'string' ? v : v.name
        if (Array.isArray(existing)) existing.push(value)
        else if (existing !== undefined) raw[k] = [existing, value]
        else raw[k] = value
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null
  if (!date) return NextResponse.json({ error: 'A valid date (YYYY-MM-DD) is required.' }, { status: 400 })

  const patch = buildPatch(raw)

  const sb = createServiceClient()
  // Upsert is keyed on (user_id, date) so two users can both log
  // the same date independently. Migration 035 added user_id; PR for the
  // composite unique index is tracked separately. Until that lands the
  // upsert may collide on date alone, so we additionally pre-filter
  // existing rows by user_id before this call (no other user shares
  // this user's row).
  const first = await sb
    .from('cycle_entries')
    .upsert({ date, user_id: userId, ...patch }, { onConflict: 'user_id,date' })
    .select()
    .single()

  let result = first
  if (first.error) {
    // Either migration 011 (endo-mode) or migration 028 (granular log) may be
    // absent in the target DB. If postgres complains about any of those columns,
    // strip BOTH groups and retry once with core fields only. This is simpler
    // and safer than running two separate retries.
    const isMissingColumn = /column\s+"?(bowel_symptoms|bladder_symptoms|dyspareunia|dyspareunia_intensity|clots_present|clot_size|clot_count|endo_notes|symptoms|sex_activity_type|skin_state|mood_emoji)"?/i.test(first.error.message)
    // The (user_id, date) composite unique index may not exist yet in
    // some environments; fall back to the legacy date-only conflict.
    const isMissingConflict = /there is no unique or exclusion constraint matching the ON CONFLICT/i.test(first.error.message)
    if (isMissingColumn) {
      const stripped: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(patch)) {
        const key = k as keyof CycleEntryPatch
        if (ENDO_KEYS.includes(key) || GRANULAR_KEYS.includes(key)) continue
        stripped[k] = v
      }
      result = await sb
        .from('cycle_entries')
        .upsert({ date, user_id: userId, ...stripped }, { onConflict: 'user_id,date' })
        .select()
        .single()
    } else if (isMissingConflict) {
      result = await sb
        .from('cycle_entries')
        .upsert({ date, user_id: userId, ...patch }, { onConflict: 'date' })
        .select()
        .single()
    }
  }

  if (result.error) {
    // PHI hygiene: only log error class + status, not the patch payload.
    logError({
      context: 'cycle/log:db',
      error: result.error.message,
      tags: { stage: 'upsert' },
    })
    return NextResponse.json({ error: result.error.message }, { status: 400 })
  }

  const accept = req.headers.get('accept') ?? ''
  if (accept.includes('text/html')) {
    return NextResponse.redirect(new URL(`/cycle?saved=1`, req.url), 303)
  }
  return NextResponse.json({ ok: true, entry: result.data }, { status: 200 })
}

function buildPatch(raw: Record<string, unknown>): CycleEntryPatch {
  const patch: CycleEntryPatch = {}

  // menstruation accepts "true"/"false"/"on"/"yes"/"1" and bare true.
  if (raw.menstruation !== undefined) {
    patch.menstruation = coerceBool(raw.menstruation)
  }

  if (typeof raw.flow_level === 'string' && FLOW_LEVELS.includes(raw.flow_level as FlowLevel)) {
    patch.flow_level = raw.flow_level as FlowLevel
  } else if (raw.flow_level === null || raw.flow_level === '') {
    patch.flow_level = null
  }

  if (typeof raw.lh_test_result === 'string' && LH_VALUES.has(raw.lh_test_result)) {
    patch.lh_test_result = raw.lh_test_result
  }

  // Ovulation signs: a list of short codes joined by comma, stored as text.
  if (raw.ovulation_signs !== undefined) {
    const list = asStringArray(raw.ovulation_signs)
    patch.ovulation_signs = list.length > 0 ? list.join(',') : null
  }

  if (typeof raw.cervical_mucus_consistency === 'string') {
    patch.cervical_mucus_consistency = raw.cervical_mucus_consistency || null
  }
  if (typeof raw.cervical_mucus_quantity === 'string') {
    patch.cervical_mucus_quantity = raw.cervical_mucus_quantity || null
  }

  // Endo mode (optional, pre-migration safe).
  if (raw.bowel_symptoms !== undefined) {
    patch.bowel_symptoms = asStringArray(raw.bowel_symptoms)
  }
  if (raw.bladder_symptoms !== undefined) {
    patch.bladder_symptoms = asStringArray(raw.bladder_symptoms)
  }
  if (raw.dyspareunia !== undefined) {
    patch.dyspareunia = coerceBool(raw.dyspareunia)
  }
  if (raw.dyspareunia_intensity !== undefined) {
    const n = Number(raw.dyspareunia_intensity)
    patch.dyspareunia_intensity = Number.isFinite(n) ? n : null
  }
  if (raw.clots_present !== undefined) {
    patch.clots_present = coerceBool(raw.clots_present)
  }
  if (typeof raw.clot_size === 'string' && CLOT_SIZES.includes(raw.clot_size as ClotSize)) {
    patch.clot_size = raw.clot_size as ClotSize
  }
  if (raw.clot_count !== undefined) {
    const n = Number(raw.clot_count)
    patch.clot_count = Number.isFinite(n) ? n : null
  }
  if (typeof raw.endo_notes === 'string') {
    patch.endo_notes = raw.endo_notes || null
  }

  // Granular daily log (migration 028, optional, pre-migration safe).
  if (raw.symptoms !== undefined) {
    const list = asStringArray(raw.symptoms)
    patch.symptoms = list.length > 0 ? list : null
  }
  if (typeof raw.sex_activity_type === 'string') {
    patch.sex_activity_type = SEX_ACTIVITY_TYPES.has(raw.sex_activity_type) ? raw.sex_activity_type : null
  } else if (raw.sex_activity_type === null) {
    patch.sex_activity_type = null
  }
  if (typeof raw.skin_state === 'string') {
    patch.skin_state = SKIN_STATES.has(raw.skin_state) ? raw.skin_state : null
  } else if (raw.skin_state === null) {
    patch.skin_state = null
  }
  if (typeof raw.mood_emoji === 'string') {
    const trimmed = raw.mood_emoji.trim()
    patch.mood_emoji = trimmed.length > 0 ? trimmed.slice(0, MOOD_EMOJI_MAX_LEN) : null
  } else if (raw.mood_emoji === null) {
    patch.mood_emoji = null
  }

  return patch
}

function coerceBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  return s === 'true' || s === 'on' || s === 'yes' || s === '1'
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter((s) => s.length > 0)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  return []
}
