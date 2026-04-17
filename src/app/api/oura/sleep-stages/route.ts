/**
 * Oura Sleep Stages API
 * GET /api/oura/sleep-stages?date=YYYY-MM-DD
 *
 * Fetches sleep stage breakdown for the Hypnogram visualization.
 * Queries oura_daily for aggregate values, then constructs stage blocks
 * based on the total minutes in each stage distributed across the sleep window.
 *
 * For a precise hypnogram we would fetch Oura's /sleep endpoint which returns
 * a 5-minute interval array. This version uses aggregates as a fallback when
 * detailed data is not available.
 *
 * Column notes for oura_daily:
 *   sleep_duration: seconds of total sleep (convert to minutes by /60)
 *   deep_sleep_min: already in minutes
 *   rem_sleep_min: already in minutes
 *   raw_json.oura.sleep_detail.light_sleep_duration: seconds
 *   raw_json.oura.sleep_detail.awake_time: seconds
 *   raw_json.oura.sleep_detail.bedtime_start / bedtime_end: ISO timestamp strings
 *
 * raw_json schema note: the Oura sync route stores its payload under
 * raw_json.oura so other importers (apple_health etc.) can coexist at
 * raw_json.apple_health. Older rows still have sleep_detail at the
 * raw_json root, so we read nested-first and fall back to the legacy
 * flat location for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type StageBlock = {
  startMinute: number
  stage: 'awake' | 'rem' | 'light' | 'deep'
  durationMinutes: number
}

type SleepDetail = {
  light_sleep_duration?: number | null
  awake_time?: number | null
  bedtime_start?: string | null
  bedtime_end?: string | null
}

export async function GET(req: NextRequest) {
  const sb = createServiceClient()
  const dateParam = req.nextUrl.searchParams.get('date')
  const targetDate = dateParam ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await sb
    .from('oura_daily')
    .select('date, sleep_duration, deep_sleep_min, rem_sleep_min, raw_json')
    .eq('date', targetDate)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({
      stages: [],
      totalMinutes: 0,
      bedtime: null,
      wakeTime: null,
      message: 'No sleep data for this night',
    })
  }

  const row = data as Record<string, unknown>
  const rawJson = (row.raw_json as Record<string, unknown> | null) ?? {}
  // Prefer the namespaced raw_json.oura.sleep_detail written by the current
  // sync route; fall back to raw_json.sleep_detail for rows that predate the
  // namespacing fix.
  const ouraSection = (rawJson.oura as Record<string, unknown> | undefined) ?? {}
  const sleepDetail =
    (ouraSection.sleep_detail as SleepDetail | undefined) ??
    (rawJson.sleep_detail as SleepDetail | undefined) ??
    {}

  const sleepDurationSec = (row.sleep_duration as number | null) ?? 0
  const deep = (row.deep_sleep_min as number | null) ?? 0
  const rem = (row.rem_sleep_min as number | null) ?? 0
  const lightSec = sleepDetail.light_sleep_duration ?? 0
  const awakeSec = sleepDetail.awake_time ?? 0

  const light = Math.round(lightSec / 60)
  const awake = Math.round(awakeSec / 60)
  const totalFromDuration = Math.round(sleepDurationSec / 60)
  const total = totalFromDuration > 0 ? totalFromDuration : deep + rem + light + awake

  if (total === 0) {
    return NextResponse.json({
      stages: [],
      totalMinutes: 0,
      bedtime: null,
      wakeTime: null,
      message: 'No sleep stage data available',
    })
  }

  // Reconstruct a plausible hypnogram from aggregates.
  // Real sleep architecture: light -> deep -> light -> REM cycles, ~90 min each.
  // We distribute stages into cycles approximating this pattern.
  const stages: StageBlock[] = []
  const cycleLength = 90 // minutes
  const numCycles = Math.max(1, Math.round(total / cycleLength))

  let startMinute = 0
  const deepPerCycle = deep / numCycles
  const remPerCycle = rem / numCycles
  const lightPerCycle = light / numCycles
  const awakePerCycle = awake / numCycles

  for (let c = 0; c < numCycles; c++) {
    // Early cycles have more deep, later cycles have more REM (realistic pattern)
    const deepWeight = numCycles > 1 ? 2 - (c / (numCycles - 1)) : 1 // 2..1
    const remWeight = numCycles > 1 ? 0.5 + (c / (numCycles - 1)) * 1.5 : 1 // 0.5..2

    const thisDeep = Math.max(0, Math.round(deepPerCycle * deepWeight / 1.5))
    const thisRem = Math.max(0, Math.round(remPerCycle * remWeight / 1.25))
    const thisLight = Math.max(0, Math.round(lightPerCycle))
    const thisAwake = Math.max(0, Math.round(awakePerCycle))

    // Light -> Deep -> Light -> REM pattern per cycle
    if (thisLight > 0) {
      stages.push({ startMinute, stage: 'light', durationMinutes: Math.round(thisLight / 2) })
      startMinute += Math.round(thisLight / 2)
    }
    if (thisDeep > 0) {
      stages.push({ startMinute, stage: 'deep', durationMinutes: thisDeep })
      startMinute += thisDeep
    }
    if (thisLight > 0) {
      stages.push({ startMinute, stage: 'light', durationMinutes: Math.round(thisLight / 2) })
      startMinute += Math.round(thisLight / 2)
    }
    if (thisRem > 0) {
      stages.push({ startMinute, stage: 'rem', durationMinutes: thisRem })
      startMinute += thisRem
    }
    if (thisAwake > 0 && c < numCycles - 1) {
      stages.push({ startMinute, stage: 'awake', durationMinutes: thisAwake })
      startMinute += thisAwake
    }
  }

  // Format bedtime/wakeTime if available (sourced from raw_json.sleep_detail)
  const bedtimeRaw = sleepDetail.bedtime_start ?? null
  const wakeTimeRaw = sleepDetail.bedtime_end ?? null
  const formatTime = (ts: string | null): string | null => {
    if (!ts) return null
    try {
      const d = new Date(ts)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return null
    }
  }

  return NextResponse.json({
    stages,
    totalMinutes: total,
    bedtime: formatTime(bedtimeRaw),
    wakeTime: formatTime(wakeTimeRaw),
  })
}
