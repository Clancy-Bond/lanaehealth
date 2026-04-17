import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  getValidAccessToken,
  fetchSleepData,
  fetchReadinessData,
  fetchStressData,
  fetchSpO2Data,
  fetchSleepDetail,
} from '@/lib/oura'
import { maybeTriggerAnalysis } from '@/lib/intelligence/auto-trigger'

export const maxDuration = 120

interface SyncRequest {
  start_date?: string
  end_date?: string
}

export async function POST(request: NextRequest) {
  try {
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
      const [sleepRes, readinessRes, stressRes, spo2Res, sleepDetailRes] =
        await Promise.allSettled([
          fetchSleepData(accessToken, chunk.start, chunk.end),
          fetchReadinessData(accessToken, chunk.start, chunk.end),
          fetchStressData(accessToken, chunk.start, chunk.end),
          fetchSpO2Data(accessToken, chunk.start, chunk.end),
          fetchSleepDetail(accessToken, chunk.start, chunk.end),
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
      for (const entry of readiness) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].readiness_score = entry.score ?? null
        dateMap[day].body_temp_deviation = entry.temperature_deviation ?? null
        ouraPayloadMap[day].readiness = entry
      }

      // Process stress
      for (const entry of stress) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].stress_score =
          entry.stress_high ?? entry.recovery_high ?? null
        ouraPayloadMap[day].stress = entry
      }

      // Process SpO2
      for (const entry of spo2) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].spo2_avg = entry.spo2_percentage?.average ?? null
        ouraPayloadMap[day].spo2 = entry
      }

      // Process sleep detail (HRV, deep sleep, REM, resting HR, respiratory rate)
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
        dateMap[day].hrv_max = entry.highest_hrv ?? null
        dateMap[day].resting_hr = entry.lowest_heart_rate ?? null
        dateMap[day].respiratory_rate = entry.average_breath ?? null
        ouraPayloadMap[day].sleep_detail = entry
      }
    }

    // Fetch existing raw_json for each touched date so other importers'
    // namespaced keys (e.g. raw_json.apple_health) are preserved across this
    // sync. Only raw_json.oura is overwritten.
    const touchedDates = Object.keys(dateMap)
    const existingRawMap: Record<string, Record<string, unknown>> = {}
    if (touchedDates.length > 0) {
      const { data: existingRows } = await supabase
        .from('oura_daily')
        .select('date, raw_json')
        .in('date', touchedDates)
      if (existingRows) {
        for (const r of existingRows as { date: string; raw_json: Record<string, unknown> | null }[]) {
          existingRawMap[r.date] = r.raw_json ?? {}
        }
      }
    }

    // Upsert all dates into oura_daily. Merge oura payload into any existing
    // raw_json under the `oura` key -- overwriting only the oura slot and
    // leaving other importer keys intact.
    const rows = Object.values(dateMap).map((row) => {
      const day = row.date as string
      const existingRaw = existingRawMap[day] ?? {}
      const mergedRaw = { ...existingRaw, oura: ouraPayloadMap[day] ?? {} }
      return {
        ...row,
        raw_json: mergedRaw,
        synced_at: new Date().toISOString(),
      }
    })

    let upsertCount = 0
    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('oura_daily')
        .upsert(rows, { onConflict: 'date' })

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
