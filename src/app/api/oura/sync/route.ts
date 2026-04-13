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

    // Build a map of date -> aggregated data across all chunks
    const dateMap: Record<string, Record<string, unknown>> = {}

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
      }

      // Process daily sleep scores
      for (const entry of sleepDaily) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].sleep_score = entry.score ?? null
        dateMap[day].raw_json = {
          ...((dateMap[day].raw_json as Record<string, unknown>) || {}),
          sleep_daily: entry,
        }
      }

      // Process readiness
      for (const entry of readiness) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].readiness_score = entry.score ?? null
        dateMap[day].body_temp_deviation = entry.temperature_deviation ?? null
        dateMap[day].raw_json = {
          ...((dateMap[day].raw_json as Record<string, unknown>) || {}),
          readiness: entry,
        }
      }

      // Process stress
      for (const entry of stress) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].stress_score =
          entry.stress_high ?? entry.recovery_high ?? null
        dateMap[day].raw_json = {
          ...((dateMap[day].raw_json as Record<string, unknown>) || {}),
          stress: entry,
        }
      }

      // Process SpO2
      for (const entry of spo2) {
        const day = entry.day || entry.date
        if (!day) continue
        ensureDate(day)
        dateMap[day].spo2_avg = entry.spo2_percentage?.average ?? null
        dateMap[day].raw_json = {
          ...((dateMap[day].raw_json as Record<string, unknown>) || {}),
          spo2: entry,
        }
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
        dateMap[day].raw_json = {
          ...((dateMap[day].raw_json as Record<string, unknown>) || {}),
          sleep_detail: entry,
        }
      }
    }

    // Upsert all dates into oura_daily
    const rows = Object.values(dateMap).map((row) => ({
      ...row,
      synced_at: new Date().toISOString(),
    }))

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
