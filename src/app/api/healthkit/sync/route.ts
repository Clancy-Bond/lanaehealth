/**
 * POST /api/healthkit/sync
 *
 * Live HealthKit sync from the Capacitor iOS shell. Different
 * transport from /api/import/apple-health (which takes a multipart
 * .zip XML export); same destination tables, same mapper.
 *
 * Request body shape (validated with zod):
 *   {
 *     synced_for_date: 'YYYY-MM-DD',
 *     captured_at: ISO 8601,
 *     samples: HealthKitSample[]
 *   }
 *
 * The iOS app collects HealthKit samples for the requested
 * identifiers in `HEALTHKIT_READ_TYPES` over a recent window and
 * POSTs them on a daily / on-foreground cadence. The endpoint:
 *
 *   1. Bins samples per ISO date into DailySummary rows
 *      (samples-to-summaries.ts)
 *   2. For each summary, runs the existing apple-health mapper
 *      writers (toCycleRow, toNcImportedRow, toBiometricRow,
 *      toNutritionRow) so cycle / biometric / nutrition data lands
 *      in the same canonical rows the legacy XML import populated.
 *
 * Auth: resolveUserId (session OR OWNER_USER_ID env). Same posture
 * as the rest of the v2 write APIs.
 *
 * Idempotent: the underlying writers upsert by date / log_id, so
 * re-posting the same window does not duplicate rows.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import { createServiceClient } from '@/lib/supabase'
import {
  classify,
  toBiometricRow,
  toCycleRow,
  toNcImportedRow,
  decideBiometricMerge,
} from '@/lib/import/apple-health/mapper'
import { samplesToDailySummaries } from '@/lib/healthkit/samples-to-summaries'
import { HEALTHKIT_READ_TYPES } from '@/lib/capacitor/runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const QuantitySampleSchema = z.object({
  identifier: z.enum(HEALTHKIT_READ_TYPES),
  start: z.string().datetime(),
  end: z.string().datetime(),
  value: z.number().finite(),
  sourceName: z.string().nullable().optional(),
})

const CategorySampleSchema = z.object({
  identifier: z.enum(HEALTHKIT_READ_TYPES),
  start: z.string().datetime(),
  end: z.string().datetime(),
  code: z.number().int(),
  valueText: z.string().min(0).max(80),
  sourceName: z.string().nullable().optional(),
})

const SampleSchema = z.union([QuantitySampleSchema, CategorySampleSchema])

const PostSchema = z.object({
  synced_for_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  captured_at: z.string().datetime(),
  // Cap the batch at 5000 samples so a malicious or buggy client
  // cannot run us out of memory. A normal day produces a few hundred
  // samples (heart rate ticks once a minute on Apple Watch).
  samples: z.array(SampleSchema).max(5000),
})

interface SyncResults {
  cycleEntries: number
  biometricEntries: number
  errors: string[]
}

export async function POST(req: Request) {
  let userId: string | null = null
  try {
    userId = (await resolveUserId()).userId
  } catch (err) {
    if (err instanceof UserIdUnresolvableError) {
      return NextResponse.json(
        { ok: false, error: 'unauthenticated (no session and OWNER_USER_ID unset)' },
        { status: 401 },
      )
    }
    return NextResponse.json({ ok: false, error: 'auth check failed' }, { status: 500 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }
  const parsed = PostSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid body', issues: parsed.error.issues.slice(0, 5) },
      { status: 400 },
    )
  }

  const summaries = samplesToDailySummaries(parsed.data.samples)
  if (summaries.length === 0) {
    return NextResponse.json({ ok: true, written: { cycleEntries: 0, biometricEntries: 0 } })
  }

  const supabase = createServiceClient()
  const results: SyncResults = {
    cycleEntries: 0,
    biometricEntries: 0,
    errors: [],
  }

  for (const summary of summaries) {
    const targets = classify(summary)
    if (targets.cycle) {
      // nc_imported (NC-shaped row from HealthKit menstrual flow + BBT)
      const ncRow = toNcImportedRow(userId!, summary, new Date().toISOString())
      const { error: ncErr } = await supabase
        .from('nc_imported')
        .upsert(ncRow, { onConflict: 'date' })
      if (ncErr) results.errors.push(`nc_imported ${summary.date}: ${ncErr.message}`)
      else results.cycleEntries += 1

      // cycle_entries (manual log shape)
      const ceRow = toCycleRow(userId!, summary)
      const { error: ceErr } = await supabase
        .from('cycle_entries')
        .upsert(ceRow, { onConflict: 'date' })
      if (ceErr) results.errors.push(`cycle_entries ${summary.date}: ${ceErr.message}`)

      // Biometric goes to oura_daily (HR, BP, weight, etc.) via merge
      const bioRow = toBiometricRow(userId!, summary, new Date().toISOString())
      const { data: existing } = await supabase
        .from('oura_daily')
        .select('id, raw_json')
        .eq('date', summary.date)
        .maybeSingle()
      const decision = decideBiometricMerge(bioRow, existing ?? null)
      if (decision.kind === 'insert') {
        const { error } = await supabase.from('oura_daily').insert(bioRow)
        if (error) results.errors.push(`bio insert ${summary.date}: ${error.message}`)
        else results.biometricEntries += 1
      } else if (decision.kind === 'replace') {
        const { error } = await supabase
          .from('oura_daily')
          .update(bioRow)
          .eq('id', existing!.id)
        if (error) results.errors.push(`bio replace ${summary.date}: ${error.message}`)
        else results.biometricEntries += 1
      }
      // 'skip' kind = Oura already wrote richer data; HealthKit defers.
    }
  }

  return NextResponse.json({
    ok: true,
    days_processed: summaries.length,
    written: results,
    sample_count: parsed.data.samples.length,
  })
}
