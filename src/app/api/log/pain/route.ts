/**
 * POST /api/log/pain
 *
 * Persists a multi-dimensional pain log:
 *   1. Always updates daily_logs.overall_pain with the canonical
 *      0-10 NRS / FACES intensity. This keeps existing reports,
 *      doctor summaries, and exports working.
 *   2. If the user filled out drill-down fields (quality, region,
 *      PEG, condition prompts), inserts a single pain_points row
 *      with the structured context_json.
 *
 * Zero data loss:
 *   - daily_logs.overall_pain is the only field this route mutates
 *     on the daily_logs row.
 *   - pain_points only has rows added, never modified or deleted.
 *   - context_json column is part of migration 035 and is additive;
 *     if migration 035 has not landed in this environment, the
 *     INSERT will surface an error and we return a soft warning so
 *     the canonical intensity write still counts as a success.
 *
 * Validation citations live next to each scale in the component
 * files (NRSSlider, FacesScale, PainQualityChips,
 * FunctionalImpactQuestions, ConditionPrompts) and in
 * /tmp/pain-scales-research.md.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import type {
  PainContextJson,
  PainQuality,
  Hit6SeverityFrequency,
  CompassOrthostatic,
} from '@/lib/types'

// Strict shape contract at the API trust boundary. Field-level
// normalization (qualities filter, region trim, length cap) still
// happens in the body of POST so a single bad enum value or oversize
// note does not 400 the whole save. The schema rejects anything the
// downstream sanitizers cannot recover from.
export const PainLogBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  intensity: z.number().finite().min(0).max(10),
  scale_used: z.enum(['nrs', 'faces']),
  qualities: z.array(z.string().max(40)).max(20).optional(),
  body_region: z.union([z.string().max(60), z.null()]).optional(),
  peg: z
    .object({
      enjoyment: z.number().finite().min(0).max(10),
      activity: z.number().finite().min(0).max(10),
    })
    .optional(),
  hit6_severity: z.enum(['never', 'rarely', 'sometimes', 'very_often', 'always']).optional(),
  compass_orthostatic: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
  trigger_guess: z.string().max(280).optional(),
})

type PainLogRequest = z.infer<typeof PainLogBodySchema>

// Allowed range for any 0-10 numeric input we accept on this route.
// Reject anything outside so we never write a corrupted score.
function clamp010(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n < 0 || n > 10) return null
  return Math.round(n)
}

// SCALE_USED_VALUES used to live here as a Set; the zod schema now
// owns that enum at the trust boundary. The runtime sets below still
// exist because individual elements of qualities[] / hit6 / compass are
// soft-validated downstream so a single bad chip does not 400 the save.
const QUALITY_VALUES = new Set<PainQuality>([
  'sharp',
  'dull',
  'throbbing',
  'burning',
  'aching',
  'stabbing',
  'shooting',
  'cramping',
  'pressure',
  'tingling',
  'numb',
])
const HIT6_VALUES = new Set<Hit6SeverityFrequency>([
  'never',
  'rarely',
  'sometimes',
  'very_often',
  'always',
])
const COMPASS_VALUES = new Set<CompassOrthostatic>([
  'none',
  'mild',
  'moderate',
  'severe',
])

export async function POST(req: Request) {
  let userId: string
  try {
    const r = await resolveUserId()
    userId = r.userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PainLogBodySchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: first?.message ?? 'invalid body' }, { status: 400 })
  }
  const body: PainLogRequest = parsed.data
  const intensity = clamp010(body.intensity)
  if (intensity == null) {
    return NextResponse.json({ error: 'intensity must be an integer 0..10' }, { status: 400 })
  }

  const sb = createServiceClient()

  // 1. Upsert today's daily_logs row and write canonical intensity.
  // User-scoped: only this user's daily_logs row for this date is touched.
  const { data: existingLog, error: fetchError } = await sb
    .from('daily_logs')
    .select('id, overall_pain')
    .eq('user_id', userId)
    .eq('date', body.date)
    .maybeSingle()
  if (fetchError) {
    return NextResponse.json({ error: `daily_logs fetch failed: ${fetchError.message}` }, { status: 500 })
  }

  let logId: string
  if (existingLog) {
    logId = existingLog.id as string
    const { error: updateErr } = await sb
      .from('daily_logs')
      .update({ overall_pain: intensity, updated_at: new Date().toISOString() })
      .eq('id', logId)
      .eq('user_id', userId)
    if (updateErr) {
      return NextResponse.json({ error: `daily_logs update failed: ${updateErr.message}` }, { status: 500 })
    }
  } else {
    const { data: created, error: createErr } = await sb
      .from('daily_logs')
      .insert({ date: body.date, overall_pain: intensity, user_id: userId })
      .select('id')
      .single()
    if (createErr || !created) {
      return NextResponse.json({ error: `daily_logs insert failed: ${createErr?.message ?? 'unknown'}` }, { status: 500 })
    }
    logId = created.id as string
  }

  // 2. If the drill-down has any structured detail, insert a
  //    pain_points row with context_json.
  const qualities = sanitizeQualities(body.qualities)
  const peg = sanitizePeg(body.peg)
  const hit6 = body.hit6_severity && HIT6_VALUES.has(body.hit6_severity) ? body.hit6_severity : undefined
  const compass = body.compass_orthostatic && COMPASS_VALUES.has(body.compass_orthostatic)
    ? body.compass_orthostatic
    : undefined
  const trigger = typeof body.trigger_guess === 'string' && body.trigger_guess.trim().length > 0
    ? body.trigger_guess.trim().slice(0, 280)
    : undefined
  const region = typeof body.body_region === 'string' && body.body_region.trim().length > 0
    ? body.body_region.trim().slice(0, 60)
    : null

  const hasDrilldown = qualities.length > 0 || peg != null || hit6 != null || compass != null || trigger != null || region != null

  let painPointId: string | null = null
  if (hasDrilldown) {
    const context: PainContextJson = {
      scale_used: body.scale_used,
      qualities,
      ...(peg ? { peg } : {}),
      ...(hit6 ? { hit6_severity: hit6 } : {}),
      ...(compass ? { compass_orthostatic: compass } : {}),
      ...(trigger ? { trigger_guess: trigger } : {}),
    }

    // pain_points has NOT NULL on x, y, intensity, body_region.
    // We don't have x/y from a chip set, so we record (50,50) which
    // by convention means "unspecified location, see body_region".
    const insertRow: Record<string, unknown> = {
      log_id: logId,
      user_id: userId,
      x: 50,
      y: 50,
      body_region: region ?? 'unspecified',
      intensity,
      // pain_type column is a single PainType enum on the legacy
      // schema; we set it to the first selected quality if it
      // overlaps, else leave null. Doctors care more about the full
      // qualities[] in context_json anyway.
      pain_type: pickLegacyPainType(qualities),
      context_json: context,
    }

    const { data: pp, error: ppErr } = await sb
      .from('pain_points')
      .insert(insertRow)
      .select('id')
      .single()

    if (ppErr) {
      // Drill-down failure should not lose the canonical intensity
      // we already saved. Return success on the canonical write but
      // include a soft warning so the client can surface it.
      return NextResponse.json(
        {
          ok: true,
          log_id: logId,
          intensity,
          warning: `Pain detail row failed: ${ppErr.message}`,
        },
        { status: 200 },
      )
    }
    painPointId = (pp?.id as string) ?? null
  }

  return NextResponse.json({
    ok: true,
    log_id: logId,
    intensity,
    pain_point_id: painPointId,
  })
}

function sanitizeQualities(input: unknown): PainQuality[] {
  if (!Array.isArray(input)) return []
  const out: PainQuality[] = []
  for (const v of input) {
    if (typeof v === 'string' && QUALITY_VALUES.has(v as PainQuality) && !out.includes(v as PainQuality)) {
      out.push(v as PainQuality)
    }
  }
  return out
}

function sanitizePeg(input: unknown): { enjoyment: number; activity: number } | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as { enjoyment?: unknown; activity?: unknown }
  const e = clamp010(obj.enjoyment)
  const a = clamp010(obj.activity)
  if (e == null || a == null) return null
  return { enjoyment: e, activity: a }
}

// Best-effort mapping from MPQ-derived qualities to the legacy
// PainType enum on pain_points. Only used so the legacy column has a
// non-null value when applicable. The structured context_json carries
// the full set.
function pickLegacyPainType(qualities: PainQuality[]) {
  const mapping: Partial<Record<PainQuality, string>> = {
    sharp: 'sharp',
    throbbing: 'throbbing',
    burning: 'burning',
    aching: 'aching',
    stabbing: 'stabbing',
    shooting: 'shooting',
    cramping: 'cramping',
    pressure: 'pressure',
    numb: 'numb',
  }
  for (const q of qualities) {
    const m = mapping[q]
    if (m) return m
  }
  return null
}
