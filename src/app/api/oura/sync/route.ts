// SERVICE-ROLE INTENTIONAL: This route is invoked from a Vercel Cron job
// and from user-initiated sync. The cron path has no user session, so it
// reads OWNER_USER_ID from env (via resolveUserId fallback) to scope the
// stamped user_id on inserted oura_daily rows. Service-role is required
// because the cron path bypasses Supabase Auth entirely. RLS is bypassed
// for both paths but every insert here explicitly carries user_id.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveUserId, UserIdUnresolvableError } from '@/lib/auth/resolve-user-id'
import {
  getValidAccessToken,
  fetchSleepData,
  fetchReadinessData,
  fetchStressData,
  fetchSpO2Data,
  fetchSleepDetail,
  fetchActivityData,
} from '@/lib/oura'
import { maybeTriggerAnalysis } from '@/lib/intelligence/auto-trigger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface SyncRequest {
  start_date?: string
  end_date?: string
}

export async function POST(request: NextRequest) {
  try {
    let userId: string
    try {
      userId = (await resolveUserId()).userId
    } catch (err) {
      if (err instanceof UserIdUnresolvableError) {
        return NextResponse.json({ error: 'unauthenticated (set OWNER_USER_ID for cron)' }, { status: 401 })
      }
      return NextResponse.json({ error: 'auth check failed' }, { status: 500 })
    }

    let startDate: string
    let endDate: string

    // Support both JSON body and default last-30-days
    try {
      const body = (await request.json()) as SyncRequest
      startDate = body.start_date || ''
      endDate = body.end_date || ''
    } catch {
      // No body provided, use defaults
      startDate = ''
      endDate = ''
    }

    // Default to last 30 days if not provided
    if (!startDate || !endDate) {
      const now = new Date()
      endDate = now.toISOString().split('T')[0]
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      startDate = thirtyDaysAgo.toISOString().split('T')[0]
    }

    const accessToken = await getValidAccessToken()
    const supabase = createServiceClient()

    // For large date ranges, chunk into 90-day batches to avoid API limits
    const chunks: { start: string; end: string }[] = []
    const startMs = new Date(startDate).getTime()
    const endMs = new Date(endDate).getTime()
    const chunkSize = 90 * 24 * 60 * 60 * 1000 // 90 days in ms

    for (let cursor = startMs; cursor < endMs; cursor += chunkSize) {
      const chunkEnd = Math.min(cursor + chunkSize, endMs)
      chunks.push({
        start: new Date(cursor).toISOString().split('T')[0],
        end: new Date(chunkEnd).toISOString().split('T')[0],
      })
    }

    // Build a map of date -> aggregated data across all chunks.
    // The raw Oura payload accumulates into ouraPayloadMap[date] under a single
    // object; at upsert time we merge it under raw_json.oura so other importers
    // (apple_health, etc.) keep their own namespaced keys on raw_json.
    const dateMap: Record<string, Record<string, unknown>> = {}
    const ouraPayloadMap: Record<string, Record<string, unknown>> = {}

    for (const chunk of chunks) {
      // Fetch data from multiple Oura endpoints in parallel per chunk
      const [sleepRes, readinessRes, stressRes, spo2Res, sleepDetailRes, activityRes] =
        await Promise.allSettled([
          fetchSleepData(accessToken, chunk.start, chunk.end),
          fetchReadinessData(accessToken, chunk.start, chunk.end),
          fetchStressData(accessToken, chunk.start, chunk.end),
          fetchSpO2Data(accessToken, chunk.start, chunk.end),
          fetchSleepDetail(accessToken, chunk.start, chunk.end),
          fetchActivityData(accessToken, chunk.start, chunk.end),
        ])

      // Parse results (each endpoint returns { data: [...] })
      const sleepDaily =
        sleepRes.status === 'fulfilled' ? sleepRes.value?.data || [] : []
      const readiness =
        readinessRes.status === 'fulfilled' ? readinessRes.value?.data || [] : []
      const stress =
        stressRes.status === 'fulfilled' ? stressRes.value?.data || [] : []
      const spo2 =
        spo2Res.status === 'fulfilled' ? spo2Res.value?.data || [] : []
      const sleepDetail =
        sleepDetailRes.status === 'fulfilled'
          ? sleepDetailRes.value?.data || []
          : []
      const activity =
        activityRes.status === 'fulfilled' ? activityRes.value?.data || [] : []

      function ensureDate(date: string) {
        if (!dateMap[date]) {
          dateMap[date] = { date }
        }
        if (!ouraPayloadMap[date]) {
          ouraPayloadMap[date] = {}
        }
      }

      // Process daily sleep scores
      for (const entry of sleepDaily) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].sleep_score = entry.score ?? null
        ouraPayloadMap[day].sleep_daily = entry
      }

      // Process readiness
      //
      // Oura's daily_readiness payload exposes two temperature fields:
      //   - temperature_deviation: absolute deviation from baseline. Often
      //     null on nights where the ring did not capture a clean reading.
      //   - temperature_trend_deviation: smoothed multi-day trend deviation.
      //     Lower noise; still populated when the absolute field is missing.
      // We persist `temperature_deviation` when present; otherwise we fall
      // back to the trend value so cycle-aware surfaces (BBT cover line,
      // signal fusion) get a usable signal instead of null. NC's published
      // methodology emphasizes a smoothed trend, not a single absolute
      // sample, for cover-line maths.
      for (const entry of readiness) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].readiness_score = entry.score ?? null
        const dev = entry.temperature_deviation
        const trend = entry.temperature_trend_deviation
        const tempVal =
          dev != null && Number.isFinite(Number(dev))
            ? Number(dev)
            : trend != null && Number.isFinite(Number(trend))
              ? Number(trend)
              : null
        dateMap[day].body_temp_deviation = tempVal
        ouraPayloadMap[day].readiness = entry
      }

      // Process stress.
      //
      // Pre-Wave-1 bug: `stress_score = stress_high ?? recovery_high`
      // conflated two different metrics. On low-stress days where
      // stress_high was null the column silently received recovery_high
      // (minutes in recovery), poisoning correlation analysis.
      //
      // Wave 1 fix (migration 031): write stress_high_min and
      // recovery_high_min to dedicated columns; keep stress_score
      // populated from stress_high only (default 0 when the day is all
      // recovery), so legacy readers see a clean stress signal.
      for (const entry of stress) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        const stressHigh =
          typeof entry.stress_high === 'number' ? entry.stress_high : null
        const recoveryHigh =
          typeof entry.recovery_high === 'number' ? entry.recovery_high : null
        dateMap[day].stress_high_min = stressHigh
        dateMap[day].recovery_high_min = recoveryHigh
        dateMap[day].stress_score = stressHigh ?? 0
        ouraPayloadMap[day].stress = entry
      }

      // Process SpO2.
      //
      // Wave 1 (migration 032): also extract breathing_disturbance_index,
      // Oura's apnea-screening / nocturnal disturbance proxy. Useful
      // for chronic sinus disease and POTS workups.
      for (const entry of spo2) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].spo2_avg = entry.spo2_percentage?.average ?? null
        const bdi = entry.breathing_disturbance_index
        dateMap[day].breathing_disturbance_index =
          typeof bdi === 'number' && Number.isFinite(bdi) ? bdi : null
        ouraPayloadMap[day].spo2 = entry
      }

      // Process sleep detail (HRV, deep sleep, REM, resting HR, respiratory rate).
      //
      // Wave 1 fixes:
      //   - Materialize `latency` (was skipped) into sleep_latency_min,
      //     converting seconds to whole minutes (migration 030).
      //   - Compute hrv_max from the intraday hrv.items 5-minute series
      //     (migration 034). Oura's /sleep endpoint does not return
      //     highest_hrv, so the previous `entry.highest_hrv ?? null`
      //     write was always null. The intraday array is already in
      //     raw_json so this is a free recompute.
      for (const entry of sleepDetail) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].sleep_duration = entry.total_sleep_duration ?? null
        dateMap[day].deep_sleep_min = entry.deep_sleep_duration
          ? Math.round(entry.deep_sleep_duration / 60)
          : null
        dateMap[day].rem_sleep_min = entry.rem_sleep_duration
          ? Math.round(entry.rem_sleep_duration / 60)
          : null
        dateMap[day].hrv_avg = entry.average_hrv ?? null
        dateMap[day].hrv_max = computeHrvMax(entry)
        dateMap[day].resting_hr = entry.lowest_heart_rate ?? null
        dateMap[day].respiratory_rate = entry.average_breath ?? null
        const latencySec =
          typeof entry.latency === 'number' && Number.isFinite(entry.latency)
            ? entry.latency
            : null
        dateMap[day].sleep_latency_min =
          latencySec != null ? Math.round(latencySec / 60) : null
        ouraPayloadMap[day].sleep_detail = entry
      }

      // Process daily activity.
      //
      // Wave 1 (migration 033): materialize the activity score and the
      // four intensity buckets (sedentary / low / medium / high minutes).
      // Steps and calories continue to be read from raw_json by callers
      // in src/lib/calories/activity.ts.
      for (const entry of activity) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        const score = entry.score
        dateMap[day].activity_score =
          typeof score === 'number' && Number.isFinite(score) ? score : null
        dateMap[day].sedentary_min = secondsToMinutes(entry.sedentary_time)
        dateMap[day].low_activity_min = secondsToMinutes(entry.low_activity_time)
        dateMap[day].medium_activity_min = secondsToMinutes(
          entry.medium_activity_time,
        )
        dateMap[day].high_activity_min = secondsToMinutes(
          entry.high_activity_time,
        )
        ouraPayloadMap[day].daily_activity = entry
      }
    }

    // Fetch existing raw_json for each touched date so other importers'
    // namespaced keys (e.g. raw_json.apple_health) are preserved across this
    // sync. Only raw_json.oura is overwritten. Scoped to this user.
    const touchedDates = Object.keys(dateMap)
    const existingRawMap: Record<string, Record<string, unknown>> = {}
    if (touchedDates.length > 0) {
      const { data: existingRows } = await supabase
        .from('oura_daily')
        .select('date, raw_json')
        .eq('user_id', userId)
        .in('date', touchedDates)
      if (existingRows) {
        for (const r of existingRows as { date: string; raw_json: Record<string, unknown> | null }[]) {
          existingRawMap[r.date] = r.raw_json ?? {}
        }
      }
    }

    // Upsert all dates into oura_daily. Merge oura payload into any existing
    // raw_json under the `oura` key -- overwriting only the oura slot and
    // leaving other importer keys intact. user_id stamped per row.
    const rows = Object.values(dateMap).map((row) => {
      const day = row.date as string
      const existingRaw = existingRawMap[day] ?? {}
      const mergedRaw = { ...existingRaw, oura: ouraPayloadMap[day] ?? {} }
      return {
        ...row,
        user_id: userId,
        raw_json: mergedRaw,
        synced_at: new Date().toISOString(),
      }
    })

    let upsertCount = 0
    if (rows.length > 0) {
      // Try (user_id, date) composite, fall back to date-only for legacy DBs.
      let { error: upsertError } = await supabase
        .from('oura_daily')
        .upsert(rows, { onConflict: 'user_id,date' })

      if (upsertError && /there is no unique or exclusion constraint matching the ON CONFLICT/i.test(upsertError.message)) {
        const retry = await supabase
          .from('oura_daily')
          .upsert(rows, { onConflict: 'date' })
        upsertError = retry.error
      }

      if (upsertError) {
        return NextResponse.json(
          { error: `Failed to upsert data: ${upsertError.message}` },
          { status: 500 }
        )
      }
      upsertCount = rows.length
    }

    // Trigger clinical intelligence analysis if significant data synced
    await maybeTriggerAnalysis('oura_daily', upsertCount)

    return NextResponse.json({
      success: true,
      synced_days: upsertCount,
      date_range: { start: startDate, end: endDate },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Convert a duration in seconds to whole minutes. Returns null when the
 * input is missing or non-finite. Exported via the route module solely
 * so the sync test file can hold the helper accountable.
 */
export function secondsToMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.round(value / 60)
}

/**
 * Compute peak HRV from Oura's intraday 5-minute series under
 * sleep_detail.hrv.items. Returns null when the array is missing,
 * empty, or contains no finite values.
 *
 * Why: Oura's /sleep endpoint exposes average_hrv at the daily level,
 * but does not return a `highest_hrv` field. The previous sync code
 * read `entry.highest_hrv ?? null` and so wrote null forever. The
 * intraday samples are already in raw_json, so we recompute the max
 * locally without an extra network call.
 */
export function computeHrvMax(entry: Record<string, unknown>): number | null {
  const detail = (entry as { hrv?: unknown }).hrv
  if (!detail || typeof detail !== 'object') return null
  const items = (detail as { items?: unknown }).items
  if (!Array.isArray(items) || items.length === 0) return null
  let max: number | null = null
  for (const item of items) {
    if (typeof item !== 'number' || !Number.isFinite(item)) continue
    if (max === null || item > max) max = item
  }
  if (max === null) return null
  return Math.round(max)
}
