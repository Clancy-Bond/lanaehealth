import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseAppleHealthXml } from '@/lib/importers/apple-health'
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

/**
 * POST /api/import/apple-health
 *
 * Accepts the export.xml file from Apple Health's "Export All Health Data".
 * Parses ALL records and upserts daily summaries into the database.
 */
export async function POST(request: NextRequest) {
  const sizeDeny = enforceDeclaredSize(request, LARGE_UPLOAD_LIMIT_BYTES)
  if (sizeDeny) return sizeDeny
  if (!IMPORT_LIMITER.consume(clientKey(request))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // Apple Health imports stamp every cycle / nutrition / biometric row
  // with this user_id so they never blend into another user's history.
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

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > LARGE_UPLOAD_LIMIT_BYTES) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
    }

    const xmlText = await file.text()
    const actualDeny = enforceActualSize(Buffer.byteLength(xmlText, 'utf8'), LARGE_UPLOAD_LIMIT_BYTES)
    if (actualDeny) return actualDeny

    if (!xmlText.includes('<HealthData') && !xmlText.includes('<Record')) {
      return NextResponse.json(
        { error: 'This does not look like an Apple Health export.xml file.' },
        { status: 400 }
      )
    }

    const parsed = parseAppleHealthXml(xmlText)
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

    // Process each day's summary
    for (const [date, summary] of parsed.dailySummaries) {
      // 1. Cycle data -> nc_imported + cycle_entries
      if (summary.basalTemp || summary.menstrualFlow || summary.cervicalMucus || summary.ovulationTest) {
        const isMenstruating =
          summary.menstrualFlow &&
          summary.menstrualFlow !== 'none' &&
          summary.menstrualFlow !== 'unspecified'

        const ncRow = {
          user_id: userId,
          date,
          temperature: summary.basalTemp,
          menstruation: isMenstruating ? 'menstruation' : null,
          flow_quantity: summary.menstrualFlow,
          cervical_mucus_consistency: summary.cervicalMucus,
          lh_test: summary.ovulationTest,
          imported_at: new Date().toISOString(),
          data_flags: 'apple_health_export',
        }
        let ncErr = (await supabase.from('nc_imported').upsert(ncRow, { onConflict: 'user_id,date' })).error
        if (ncErr && /no unique or exclusion constraint matching/i.test(ncErr.message)) {
          ncErr = (await supabase.from('nc_imported').upsert(ncRow, { onConflict: 'date' })).error
        }

        if (ncErr) {
          results.errors.push(`cycle ${date}: ${ncErr.message}`)
        } else {
          results.cycleEntries++
        }

        // Also update cycle_entries (this user)
        const ceRow = {
          user_id: userId,
          date,
          menstruation: !!isMenstruating,
          flow_level: summary.menstrualFlow,
          lh_test_result: summary.ovulationTest,
          cervical_mucus_consistency: summary.cervicalMucus,
        }
        let ceErr = (await supabase.from('cycle_entries').upsert(ceRow, { onConflict: 'user_id,date' })).error
        if (ceErr && /no unique or exclusion constraint matching/i.test(ceErr.message)) {
          await supabase.from('cycle_entries').upsert(ceRow, { onConflict: 'date' })
        }
      }

      // 2. Nutrition data -> daily_logs + food_entries
      if (summary.calories || summary.protein || summary.fat || summary.carbs) {
        await upsertNutrition(supabase, date, summary, results, userId)
      }

      // 3. Biometric + activity data -> oura_daily
      if (
        summary.heartRateAvg ||
        summary.hrv ||
        summary.restingHR ||
        summary.steps ||
        summary.sleepHours ||
        summary.weight ||
        summary.activeEnergy ||
        summary.bloodOxygen
      ) {
        await upsertBiometrics(supabase, date, summary, results, userId)
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
      { status: 500 }
    )
  }
}

async function upsertNutrition(
  supabase: ReturnType<typeof createServiceClient>,
  date: string,
  summary: DailySummary,
  results: { nutritionEntries: number; errors: string[] },
  userId: string,
) {
  // Get or create daily log (scoped to user_id so we don't accidentally
  // attach this user's food entries to another user's daily_log row).
  const { data: existingLog } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  let logId: string
  if (existingLog) {
    logId = existingLog.id
  } else {
    const { data: newLog, error } = await supabase
      .from('daily_logs')
      .insert({ user_id: userId, date })
      .select('id')
      .single()
    if (error || !newLog) {
      results.errors.push(`log ${date}: ${error?.message}`)
      return
    }
    logId = newLog.id
  }

  const foodText = `Daily total: ${Math.round(summary.calories || 0)} cal`
  const triggers = detectTriggers(foodText).map((t) => t.category)

  // Remove existing health-export entries for this day to prevent duplicates.
  //
  // SCOPING NOTE (QA W2.10): food_entries has no `source`/`import_source` column
  // in the live schema (columns: id, log_id, meal_type, food_items, calories,
  // macros, flagged_triggers, logged_at). To keep this delete from wiping
  // legitimate user-entered rows whose food_items text happens to start with
  // "Daily total:", we additionally scope by a jsonb tag embedded in `macros`:
  //   macros.source = 'apple_health_export'
  //
  // Every insert below sets that tag, so re-runs of THIS importer will match
  // both the text prefix AND the jsonb tag. Rows the user typed by hand will
  // not carry the tag and will be left alone.
  //
  // PARTIAL fix: rows written by older builds (before this tag existed) lack
  // the tag and will NOT be re-deleted on subsequent re-imports. Adding a
  // real `source TEXT` column + backfill is queued for Wave 3; that would
  // let us drop the text-prefix filter entirely.
  await supabase
    .from('food_entries')
    .delete()
    .eq('user_id', userId)
    .eq('log_id', logId)
    .eq('meal_type', 'snack')
    .ilike('food_items', 'Daily total:%')
    .filter('macros->>source', 'eq', 'apple_health_export')

  const { error } = await supabase.from('food_entries').insert({
    user_id: userId,
    log_id: logId,
    meal_type: 'snack',
    food_items: foodText,
    calories: Math.round(summary.calories || 0),
    macros: {
      // Source tag used by the scoped delete above. Do not remove without
      // updating the delete filter in this function.
      source: 'apple_health_export',
      protein: summary.protein,
      carbs: summary.carbs,
      fat: summary.fat,
      fiber: summary.fiber,
      sugar: summary.sugar,
      sodium: summary.sodium,
      iron: summary.iron,
      calcium: summary.calcium,
      vitamin_d: summary.vitaminD,
      vitamin_c: summary.vitaminC,
      caffeine: summary.caffeine,
      water: summary.water,
    },
    flagged_triggers: triggers,
    logged_at: new Date().toISOString(),
  })

  if (error) {
    results.errors.push(`nutrition ${date}: ${error.message}`)
  } else {
    results.nutritionEntries++
  }
}

async function upsertBiometrics(
  supabase: ReturnType<typeof createServiceClient>,
  date: string,
  summary: DailySummary,
  results: { biometricEntries: number; errors: string[] },
  userId: string,
) {
  const { data: existing } = await supabase
    .from('oura_daily')
    .select('id, raw_json')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle()

  const sleepScore = summary.sleepHours ? Math.min(100, Math.round(summary.sleepHours * 13)) : null

  const row = {
    user_id: userId,
    date,
    hrv_avg: summary.hrv,
    resting_hr: summary.restingHR,
    sleep_score: sleepScore,
    sleep_duration: summary.sleepHours ? Math.round(summary.sleepHours * 3600) : null,
    body_temp_deviation: summary.bodyTemp ? +(summary.bodyTemp - 36.6).toFixed(2) : null,
    raw_json: {
      source: 'apple_health_export',
      heart_rate_avg: summary.heartRateAvg,
      heart_rate_min: summary.heartRateMin,
      heart_rate_max: summary.heartRateMax,
      blood_oxygen: summary.bloodOxygen,
      respiratory_rate: summary.respiratoryRate,
      bp_systolic: summary.bpSystolic,
      bp_diastolic: summary.bpDiastolic,
      blood_glucose: summary.bloodGlucose,
      vo2_max: summary.vo2Max,
      weight_kg: summary.weight,
      bmi: summary.bmi,
      body_fat_pct: summary.bodyFat,
      steps: summary.steps,
      walking_distance: summary.walkingDistance,
      flights_climbed: summary.flightsClimbed,
      active_energy: summary.activeEnergy,
      exercise_minutes: summary.exerciseMinutes,
      sleep_hours: summary.sleepHours,
      body_temp: summary.bodyTemp,
      basal_temp: summary.basalTemp,
      sexual_activity: summary.sexualActivity,
    },
    synced_at: new Date().toISOString(),
  }

  if (!existing) {
    const { error } = await supabase.from('oura_daily').insert(row)
    if (error) results.errors.push(`bio ${date}: ${error.message}`)
    else results.biometricEntries++
  } else if (
    existing.raw_json?.source === 'apple_health_export' ||
    existing.raw_json?.source === 'apple_health'
  ) {
    // Replace existing Apple Health data (scoped to this user_id).
    const { error } = await supabase
      .from('oura_daily')
      .update(row)
      .eq('id', existing.id)
      .eq('user_id', userId)
    if (error) results.errors.push(`bio ${date}: ${error.message}`)
    else results.biometricEntries++
  } else {
    // Merge with existing Oura data (do not overwrite Oura-sourced fields).
    await supabase
      .from('oura_daily')
      .update({ raw_json: { ...existing.raw_json, apple_health: row.raw_json } })
      .eq('id', existing.id)
      .eq('user_id', userId)
    results.biometricEntries++
  }
}
