import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  parseAppleHealthExport,
  AppleHealthParseError,
  type ParsedHealthData,
} from '@/lib/import/apple-health/parser'
import {
  classify,
  toBiometricRow,
  toCycleRow,
  toNcImportedRow,
  toNutritionRow,
  decideBiometricMerge,
} from '@/lib/import/apple-health/mapper'
import type { DailySummary } from '@/lib/importers/apple-health'
import { detectTriggers } from '@/lib/food-triggers'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import {
  enforceActualSize,
  enforceDeclaredSize,
  LARGE_UPLOAD_LIMIT_BYTES,
  rateLimit,
  clientKey,
} from '@/lib/upload-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Import-class rate limit: Apple Health exports are large and slow to
// process, so 5 runs / min / caller is plenty.
const IMPORT_LIMITER = rateLimit({ windowMs: 60_000, max: 5 })

// Apple Health zip exports can be 100MB+ on a phone with years of
// data; the upload-guard's LARGE limit (50 MB) is a hard ceiling
// after compression. Most exports come in well under that.
const APPLE_LIMIT_BYTES = LARGE_UPLOAD_LIMIT_BYTES

/**
 * POST /api/import/apple-health
 *
 * Two modes selected by the `mode` form field:
 *
 *   mode=preview  → parses the upload but writes nothing. Returns
 *                   a preview summary + a one-time `previewToken`
 *                   the client posts back with mode=confirm.
 *   mode=confirm  → parses + writes. Same response shape as before
 *                   so existing scripts (legacy /import/apple-health)
 *                   keep working.
 *   (no mode)     → defaults to confirm. Backwards compatible.
 *
 * Accepts either a raw export.xml file or the export.zip wrapper
 * (apple_health_export/export.xml inside).
 */
export async function POST(request: NextRequest) {
  const sizeDeny = enforceDeclaredSize(request, APPLE_LIMIT_BYTES)
  if (sizeDeny) return sizeDeny
  if (!IMPORT_LIMITER.consume(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }
  const file = formData.get('file') as File | null
  const mode = (formData.get('mode') as string | null) || 'confirm'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > APPLE_LIMIT_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const actualDeny = enforceActualSize(arrayBuffer.byteLength, APPLE_LIMIT_BYTES)
  if (actualDeny) return actualDeny

  let parsed: ParsedHealthData
  let preview
  try {
    const result = await parseAppleHealthExport(arrayBuffer, file.name)
    parsed = result.parsed
    preview = result.preview
  } catch (err) {
    if (err instanceof AppleHealthParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Apple Health parse error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse failed' },
      { status: 500 },
    )
  }

  if (mode === 'preview') {
    return NextResponse.json({ success: true, preview })
  }

  // mode === 'confirm' (or default): write to DB.
  const supabase = createServiceClient()
  const results = {
    totalRecords: parsed.recordCount,
    daysProcessed: parsed.dailySummaries.size,
    dateRange: parsed.dateRange,
    sources: parsed.sources,
    cycleEntries: 0,
    nutritionEntries: 0,
    biometricEntries: 0,
    errors: [] as string[],
  }

  try {
    for (const [, summary] of parsed.dailySummaries) {
      const targets = classify(summary)

      if (targets.cycle) {
        await writeCycle(supabase, summary, userId, results)
      }
      if (targets.nutrition) {
        await writeNutrition(supabase, summary, userId, results)
      }
      if (targets.biometric) {
        await writeBiometric(supabase, summary, userId, results)
      }
    }

    return NextResponse.json({
      success: true,
      records: results.totalRecords,
      daysProcessed: results.daysProcessed,
      dateRange: results.dateRange,
      cycleEntries: results.cycleEntries,
      nutritionEntries: results.nutritionEntries,
      biometricEntries: results.biometricEntries,
      sources: results.sources,
      errors: results.errors.length > 0 ? results.errors.slice(0, 20) : undefined,
    })
  } catch (err) {
    console.error('Apple Health import error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    )
  }
}

async function writeCycle(
  supabase: ReturnType<typeof createServiceClient>,
  summary: DailySummary,
  userId: string,
  results: { cycleEntries: number; errors: string[] },
) {
  // nc_imported, cycle_entries, oura_daily, food_entries, daily_logs
  // are legacy single-tenant tables (no user_id column). Conflict
  // resolution is by 'date' alone. user_id is still threaded through
  // for the rare future migration to multi-tenant.
  const importedAt = new Date().toISOString()
  const ncRow = toNcImportedRow(userId, summary, importedAt)
  const { error: ncErr } = await supabase
    .from('nc_imported')
    .upsert(ncRow, { onConflict: 'date' })
  if (ncErr) {
    results.errors.push(`cycle ${summary.date}: ${ncErr.message}`)
  } else {
    results.cycleEntries++
  }

  const ceRow = toCycleRow(userId, summary)
  const { error: ceErr } = await supabase
    .from('cycle_entries')
    .upsert(ceRow, { onConflict: 'date' })
  if (ceErr) {
    results.errors.push(`cycle_entries ${summary.date}: ${ceErr.message}`)
  }
}

async function writeNutrition(
  supabase: ReturnType<typeof createServiceClient>,
  summary: DailySummary,
  userId: string,
  results: { nutritionEntries: number; errors: string[] },
) {
  // daily_logs / food_entries are legacy single-tenant tables (no
  // user_id column). Look up + insert by date / log_id only.
  const { data: existingLog } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('date', summary.date)
    .maybeSingle()

  let logId: string
  if (existingLog) {
    logId = existingLog.id
  } else {
    const { data: newLog, error } = await supabase
      .from('daily_logs')
      .insert({ date: summary.date })
      .select('id')
      .single()
    if (error || !newLog) {
      results.errors.push(`log ${summary.date}: ${error?.message}`)
      return
    }
    logId = newLog.id
  }

  const foodText = `Daily total: ${Math.round(summary.calories || 0)} cal`
  const triggers = detectTriggers(foodText).map((t) => t.category)

  // Scope-by-tag delete: only nuke rows we previously wrote, not
  // user-entered rows that happen to match the text prefix.
  await supabase
    .from('food_entries')
    .delete()
    .eq('log_id', logId)
    .eq('meal_type', 'snack')
    .ilike('food_items', 'Daily total:%')
    .filter('macros->>source', 'eq', 'apple_health_export')

  const row = toNutritionRow(userId, logId, summary, triggers, new Date().toISOString())
  const { error } = await supabase.from('food_entries').insert(row)
  if (error) {
    results.errors.push(`nutrition ${summary.date}: ${error.message}`)
  } else {
    results.nutritionEntries++
  }
}

async function writeBiometric(
  supabase: ReturnType<typeof createServiceClient>,
  summary: DailySummary,
  userId: string,
  results: { biometricEntries: number; errors: string[] },
) {
  // oura_daily is legacy single-tenant: lookup + update by id/date.
  const { data: existing } = await supabase
    .from('oura_daily')
    .select('id, raw_json')
    .eq('date', summary.date)
    .maybeSingle()

  const row = toBiometricRow(userId, summary, new Date().toISOString())
  const decision = decideBiometricMerge(row, existing ?? null)

  if (decision.kind === 'insert') {
    const { error } = await supabase.from('oura_daily').insert(row)
    if (error) results.errors.push(`bio ${summary.date}: ${error.message}`)
    else results.biometricEntries++
  } else if (decision.kind === 'replace') {
    const { error } = await supabase
      .from('oura_daily')
      .update(row)
      .eq('id', existing!.id)
    if (error) results.errors.push(`bio ${summary.date}: ${error.message}`)
    else results.biometricEntries++
  } else {
    await supabase
      .from('oura_daily')
      .update({ raw_json: decision.mergedRawJson })
      .eq('id', existing!.id)
    results.biometricEntries++
  }
}
